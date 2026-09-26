"use client";

// 리포트 뷰어의 React 껍데기. 렌더링은 하지 않는다 — 목업이 아직 없어서 껍데기를 나중에 씌울 수
// 있게 데이터 계층만 먼저 짓는다.
//
// **논리는 여기 없다.** 페이지 구성·prefetch·총평 시점·중복 요청 방지는 전부
// `sajuReaderCore.ts` 에 있고, 이 파일은 그걸 React 에 붙이는 일만 한다. 그렇게 나눈 이유는
// 그 논리가 **돈이 나가는 POST 를 몇 번 보내는가**를 결정하는데(섹션 약 20원, 이미지 8원),
// 저장소에 React 렌더러가 없어서 훅 안에 두면 테스트로 고정할 수 없기 때문이다. 코어 쪽
// 머리말에 자세히 적어 뒀다.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { getSajuProduct } from "@/lib/saju/products";
import { createSajuReaderCore, type ReaderSnapshot } from "./sajuReaderCore";

export type { ReaderError, ReaderPage, ReaderSnapshot } from "./sajuReaderCore";

export type SajuReader = ReaderSnapshot & {
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** 다시 뽑기(§8). 8원이 나가므로 사용자가 누를 때만 부른다. */
  regenerateImage: () => void;
  /** 생성이 실패한 섹션을 사용자가 다시 요청하는 자리. 자리표에는 아무 일도 하지 않는다. */
  retryPage: (pageNumber: number) => void;
  /** 후기를 남긴다. 성공하면 `null`, 실패하면 화면에 보여줄 메시지. */
  submitReview: (stars: number, body: string) => Promise<string | null>;
};

/** 로그인 전(토큰이 없을 때) 쓰는 빈 스냅샷. 매번 새 객체를 만들면 `useSyncExternalStore` 가
 *  무한 렌더로 본다 — 그래서 모듈 상수로 둔다. */
const EMPTY: ReaderSnapshot = {
  view: null,
  loading: true,
  loadError: null,
  page: null,
  index: 0,
  pageCount: 0,
  hasImagePage: false,
};

export function useSajuReader(readingId: string): SajuReader {
  const { user } = useRooms();

  // 리포트나 로그인 사용자가 바뀌면 코어를 새로 만든다 — 이전 리포트의 상태(받아 둔 페이지,
  // 진행 중인 요청, blob 주소)가 섞이지 않게 한다.
  const core = useMemo(() => {
    if (!user) return null;
    return createSajuReaderCore({
      readingId,
      // 인증은 코어 밖에 둔다. 코어는 토큰을 모르고, 그래서 테스트가 가짜 `fetch` 만 끼우면 된다.
      fetch: async (path, init) => {
        const token = await user.getIdToken();
        return fetch(path, {
          ...init,
          headers: { ...init?.headers, Authorization: `Bearer ${token}` },
        });
      },
      productHasImage: (slug) => Boolean(getSajuProduct(slug)?.image),
      createObjectUrl: (blob) => URL.createObjectURL(blob),
      revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    });
  }, [readingId, user]);

  useEffect(() => {
    if (!core) return;
    void core.load();
    return () => core.dispose();
  }, [core]);

  const subscribe = useCallback(
    (listener: () => void) => (core ? core.subscribe(listener) : () => {}),
    [core]
  );
  const getSnapshot = useCallback(() => (core ? core.getSnapshot() : EMPTY), [core]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const goTo = useCallback((index: number) => core?.goTo(index), [core]);
  const next = useCallback(() => core?.next(), [core]);
  const prev = useCallback(() => core?.prev(), [core]);
  const regenerateImage = useCallback(() => core?.regenerateImage(), [core]);
  const retryPage = useCallback((pageNumber: number) => core?.retryPage(pageNumber), [core]);
  // 코어가 없으면(로그인 전) 실패 메시지를 돌려준다. 이 자리는 총평 장 안이라 로그인 없이는
  // 닿지 않지만, `undefined` 를 돌려주면 폼이 성공으로 읽는다.
  const submitReview = useCallback(
    async (stars: number, body: string) =>
      core ? core.submitReview(stars, body) : "잠시 후 다시 시도해 주세요.",
    [core]
  );

  return { ...snapshot, goTo, next, prev, regenerateImage, retryPage, submitReview };
}
