// 리포트 뷰어의 오케스트레이션. **React 가 한 줄도 없다.**
//
// 왜 React 밖으로 뺐나: 이 파일이 하는 일은 전부 **돈이 나가는 POST 를 몇 번 보내는가**다
// (섹션 약 20원, 이미지 8원). 중복 요청은 그대로 중복 과금이고, 그 실패는 화면에 에러로 뜨지
// 않는다 — "가끔 좀 느림" 으로만 보인다. 그래서 반드시 테스트로 고정해야 하는데, 저장소에
// React 렌더러(`react-test-renderer`·jsdom)가 없어서 훅 안에 있으면 `node --test` 로 부를 수
// 없다. 의존성을 새로 들이는 대신 **논리를 React 에서 떼어냈다.**
//
// `useSajuReader.ts` 는 이제 이 코어를 `useSyncExternalStore` 로 읽는 얇은 껍데기다.
//
// 설계의 근거는 §6 하나다. 10섹션을 한 번에 만들면 147초인데 한 섹션은 660자라 읽는 데 1분이
// 걸린다. **읽는 속도가 생성 속도를 절대 못 따라잡으므로**, 사용자가 N 을 읽는 동안 N+1 을 미리
// 만들어 두면 147초가 통째로 사라진다.
import type { SajuAnswer } from "@/lib/saju/generate/answer";
import type { SajuReview } from "@/lib/saju/review";
import type { SajuClosing } from "@/lib/saju/generate/closing";
import type { SajuReadingImage } from "@/lib/saju/storage";
import type { OutlineEntry, SajuChartView, SajuReadingPageView, SajuReadingView } from "@/lib/saju/view";

/** 저장된 섹션 본문 한 장(실패 자리표가 아닌 쪽). 화면이 실제로 받는 모양(`SajuReadingPageView`)
 *  이다 — 화면이 보면 안 되는 값은 `view.ts` 가 걸러 내려준다. */
type SectionPage = Extract<SajuReadingPageView, { kind: "section" }>;

/**
 * 생성이 안 된 이유.
 *
 * `retryable` 이 이 타입의 존재 이유다. **끝난 실패와 일시적 실패를 화면이 구분해야 한다** —
 * 안 나누면 화면은 둘 다에 "다시 시도"를 붙이고, 사용자는 절대 성공하지 않는 버튼을 계속 누른다.
 */
export type ReaderError = { message: string; retryable: boolean };

/**
 * 뷰어가 그릴 한 장. **인덱스는 화면의 장 번호이고 `pageNumber` 는 섹션 번호다.** 둘이 다른
 * 이유는 0페이지(목차)와 이미지 장이 섹션이 아니기 때문이다 — 같은 숫자로 뭉치면 "3번째 장"이
 * 섹션 3인지 2인지가 화면과 서버에서 갈린다.
 */
export type ReaderPage =
  | { kind: "toc"; index: number; entries: OutlineEntry[] }
  | { kind: "section"; index: number; pageNumber: number; title: string; section: SectionPage }
  /** 아직 없다 — 지금 만들고 있거나, 만들다 실패해서 `error` 가 붙었다. */
  | { kind: "section-pending"; index: number; pageNumber: number; title: string; error: ReaderError | null }
  /**
   * 3회까지 실패해 자리표만 남은 섹션(§9). **"다시 시도"를 권하지 말 것** — 이미 세 번 했고
   * 운영자 알림도 나갔다. 버튼을 주면 사용자가 눌러도 아무 일이 안 일어난다.
   */
  | { kind: "section-failed"; index: number; pageNumber: number; title: string; attempts: number }
  | {
      kind: "image";
      index: number;
      /** `<img src>` 에 걸 값. 인증 때문에 바이트를 받아 만든 blob 주소다(`loadImageUrl` 참고). */
      objectUrl: string | null;
      regeneratedCount: number;
      busy: boolean;
      error: string | null;
    }
  /** 사연 답변 장. **총평 바로 앞**이고, 사연을 안 적은 리포트에는 아예 없다. */
  | {
      kind: "answer";
      index: number;
      /** 사용자가 적은 사연 원문. 그대로 보여준다(2026-09-26 사용자 결정) — 사주담이 이걸
       *  하는 이유가 "내 질문이 읽혔다"는 확인이다. */
      question: string;
      answer: SajuAnswer | null;
      /** 근거 참조가 가리키는 실제 값(간지·십신·별)이 있는 곳. 답변 데이터에는 **참조만**
       *  들어 있어서 명식 없이는 근거 칸을 그릴 수 없다(`chartRefs.ts`). 화면이
       *  `view` 에서 따로 꺼내지 않고 여기 실어 주는 이유는 `page.tsx` 가 `switch` 하나만
       *  하도록 두기 위해서다 — 거기서 `view` 를 꺼내면 널 단언이 생긴다. */
      chart: SajuChartView;
      partnerNickname: string | null;
      busy: boolean;
      error: ReaderError | null;
    }
  | {
      kind: "closing";
      index: number;
      closing: SajuClosing | null;
      busy: boolean;
      error: ReaderError | null;
      /** 이 리포트에 내가 남긴 후기. 있으면 화면이 폼 대신 읽기 전용을 그린다. */
      myReview: SajuReview | null;
    };

/** 화면이 읽는 전부. 액션은 코어가 들고 있으므로 여기 없다. */
export type ReaderSnapshot = {
  view: SajuReadingView | null;
  loading: boolean;
  loadError: string | null;
  page: ReaderPage | null;
  index: number;
  pageCount: number;
  hasImagePage: boolean;
};

/** `fetch` 중 이 코어가 쓰는 부분만. 테스트가 가짜를 끼울 수 있게 좁혀 둔다. */
export type ReaderResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  blob?: () => Promise<Blob>;
};

export type ReaderDeps = {
  readingId: string;
  /** 인증 헤더를 붙여 보내는 쪽은 호출자다 — 코어는 토큰을 모른다. */
  fetch: (path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<ReaderResponse>;
  /** 이 상품이 이미지 장을 갖는가. 상품 레지스트리 조회를 주입으로 받아 코어를 순수하게 둔다. */
  productHasImage: (productSlug: string) => boolean;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
};

const RETRYABLE: ReaderError = {
  message: "잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
  retryable: true,
};
/** 상품 정의가 사라져서 아직 안 만든 장을 만들 수 없다. 기다려서 풀리는 일이 아니다. */
const PRODUCT_GONE: ReaderError = { message: "이 장은 준비되지 않았어요.", retryable: false };
/** 골격 생성이 실패해 환불 처리된 건(§9). */
const READING_FAILED: ReaderError = {
  message: "이 리포트는 생성에 실패해 환불 처리됐어요.",
  retryable: false,
};

type PageOutcome =
  | { type: "ready"; page: SajuReadingPageView }
  | { type: "missing_previous"; missing: number }
  | { type: "error"; error: ReaderError };

export type SajuReaderCore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => ReaderSnapshot;
  /** 첫 조회. 끝나면 지금 장에 필요한 생성을 시작한다. */
  load: () => Promise<void>;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** 다시 뽑기(§8). 8원이 나가므로 사용자가 누를 때만 부른다. */
  regenerateImage: () => void;
  /** 실패한 섹션을 사용자가 다시 요청하는 자리. 자리표·끝난 실패에는 아무 일도 하지 않는다. */
  retryPage: (pageNumber: number) => void;
  /** 후기를 남긴다. 성공하면 `null`, 실패하면 화면에 보여줄 메시지를 돌려준다.
   *
   *  **돈이 나가는 자리가 아니다** — 그래서 이 파일이 지키는 "POST 는 과금" 규칙과 무관하다.
   *  POST 인 이유는 평범하다: 부작용이 있는 쓰기다. */
  submitReview: (stars: number, body: string) => Promise<string | null>;
  /** 언마운트. blob 주소를 놓아주고 이후 상태 변경을 멈춘다. */
  dispose: () => void;
};

export function createSajuReaderCore(deps: ReaderDeps): SajuReaderCore {
  const base = `/api/saju/readings/${deps.readingId}`;
  const listeners = new Set<() => void>();
  let disposed = false;

  // ── 날 상태 ────────────────────────────────────────────────────────────────
  let view: SajuReadingView | null = null;
  let loading = true;
  let loadError: string | null = null;
  let index = 0;
  let pages = new Map<number, SajuReadingPageView>();
  let pageErrors = new Map<number, ReaderError>();
  let answer: SajuAnswer | null = null;
  let answerBusy = false;
  let answerError: ReaderError | null = null;
  let myReview: SajuReview | null = null;
  let closing: SajuClosing | null = null;
  let closingBusy = false;
  let closingError: ReaderError | null = null;
  let image: SajuReadingImage | null = null;
  let imageObjectUrl: string | null = null;
  let imageBusy = false;
  let imageError: string | null = null;

  // ── 중복 요청 방지 ──────────────────────────────────────────────────────────
  // 서버도 같은 생성을 묶고 있지만(`produce.ts` 의 `share()`), **클라이언트가 안 보내는 게
  // 먼저다.** prefetch 와 사용자의 이동이 같은 장을 동시에 노리는 건 정상 흐름에서 늘 생긴다.
  const pageInFlight = new Map<number, Promise<void>>();
  let answerInFlight: Promise<void> | null = null;
  let closingInFlight: Promise<void> | null = null;
  let imageInFlight: Promise<void> | null = null;
  /** 이미지 첫 생성을 리포트당 한 번만 시도하기 위한 표시. */
  let imageKickedOff = false;

  let snapshot: ReaderSnapshot = {
    view: null,
    loading: true,
    loadError: null,
    page: null,
    index: 0,
    pageCount: 0,
    hasImagePage: false,
  };

  function sectionCount(): number {
    return view?.sectionCount ?? 0;
  }

  /** 이미지 장이 있는지는 **상품 정의**가 정한다(19개 중 3개). `image` 로 판단할 수 없다 —
   *  그건 "아직 안 그렸다"와 "이 상품엔 이미지가 없다"를 구분하지 못한다. 다만 상품이
   *  레지스트리에서 빠졌는데 이미지가 이미 있는 옛 리포트라면 그 장을 지우지 않는다(이미 돈을
   *  받은 결과물이라 읽기는 막지 않는다 — `view.ts` 머리말과 같은 판단). */
  function hasImagePage(): boolean {
    if (!view) return false;
    return deps.productHasImage(view.productSlug) || image !== null;
  }

  function imageIndex(): number {
    return hasImagePage() ? sectionCount() + 1 : -1;
  }

  /** 사연 답변 장이 있는가. **`userInput` 이 정한다** — `userAnswer` 로 판단하면 "사연이
   *  없어서 없는 장"과 "아직 안 만들어진 장"이 같아 보이고, 아직 안 만든 리포트에서 장이
   *  통째로 사라졌다가 생성 뒤에 끼어드는 일이 생긴다(장 번호가 도중에 밀린다). */
  function hasAnswerPage(): boolean {
    return Boolean(view?.userInput?.trim());
  }

  /** 답변 장의 인덱스. 이미지가 있으면 그 다음, 없으면 마지막 섹션 다음이다 — 둘 다
   *  **총평 바로 앞**이라는 같은 규칙의 두 모습이다. */
  function answerIndex(): number {
    if (!hasAnswerPage()) return -1;
    return hasImagePage() ? imageIndex() + 1 : sectionCount() + 1;
  }

  function pageCount(): number {
    // 목차 1 + 섹션 N + (이미지) + (답변) + 총평 1
    return sectionCount() + (hasImagePage() ? 1 : 0) + (hasAnswerPage() ? 1 : 0) + 2;
  }

  /** 총평을 언제 거는가(§6). **총평 바로 앞 장에 들어설 때**다 — 사용자가 그 장을 읽는 동안
   *  만들면 지연이 보이지 않는다. 마지막 장에서 걸면 사용자가 총평 페이지에서 그대로 기다린다.
   *
   *  예전엔 `hasImagePage() ? imageIndex() : sectionCount()` 로 갈라 썼는데, 그 둘은 사실
   *  **`pageCount() - 2` 하나**였다(직접 대입해 확인). 답변 장이 끼어들면서 갈래가 셋이 될
   *  뻔한 자리라, 규칙 하나로 되돌렸다 — 앞으로 장이 더 붙어도 여기는 안 바뀐다. */
  function closingTriggerIndex(): number {
    return Math.max(pageCount() - 2, 0);
  }

  function currentPage(): ReaderPage | null {
    if (!view) return null;
    const i = index;
    if (i === 0) return { kind: "toc", index: i, entries: view.outline };

    if (i >= 1 && i <= sectionCount()) {
      const pageNumber = i;
      // 제목은 목차와 같은 곳에서 온다(`outline[n-1].title`). 자리표에는 제목이 없으므로
      // 이 경로가 유일한 출처다 — 두 곳에 두면 목차와 본문의 제목이 갈린다.
      const title = view.outline[pageNumber - 1]?.title ?? "";
      const stored = pages.get(pageNumber);
      if (stored?.kind === "section") return { kind: "section", index: i, pageNumber, title, section: stored };
      if (stored?.kind === "failed") {
        return { kind: "section-failed", index: i, pageNumber, title, attempts: stored.attempts };
      }
      return { kind: "section-pending", index: i, pageNumber, title, error: pageErrors.get(pageNumber) ?? null };
    }

    if (i === imageIndex()) {
      return {
        kind: "image",
        index: i,
        objectUrl: imageObjectUrl,
        regeneratedCount: image?.regeneratedCount ?? 0,
        busy: imageBusy,
        error: imageError,
      };
    }

    if (i === answerIndex()) {
      return {
        kind: "answer",
        index: i,
        question: view.userInput,
        answer,
        chart: view.chart,
        partnerNickname: view.partnerNickname,
        busy: answerBusy,
        error: answerError,
      };
    }

    return { kind: "closing", index: i, closing, busy: closingBusy, error: closingError, myReview };
  }

  /** 스냅샷을 새로 만들고 구독자에게 알린다. `useSyncExternalStore` 가 객체 동일성으로 변경을
   *  판단하므로 **변경이 있을 때만** 부른다. */
  function publish() {
    if (disposed) return;
    snapshot = {
      view,
      loading,
      loadError,
      page: currentPage(),
      index,
      pageCount: pageCount(),
      hasImagePage: hasImagePage(),
    };
    for (const listener of listeners) listener();
  }

  async function readJson(res: ReaderResponse): Promise<Record<string, unknown>> {
    try {
      return ((await res.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // ── 첫 조회 ────────────────────────────────────────────────────────────────
  // 페이지를 전부 실어 오는 게 과해 보이지만 한 편이 최대 21장이고, 재접속하면 읽던 데까지
  // 이어 봐야 하므로(§6 미해결 ③) 어차피 다 필요하다.
  async function load(): Promise<void> {
    loading = true;
    loadError = null;
    publish();
    try {
      const res = await deps.fetch(base);
      if (disposed) return;
      if (!res.ok) {
        const body = await readJson(res);
        loadError = body.error === "not_found" ? "리포트를 찾을 수 없어요." : RETRYABLE.message;
        return;
      }
      const loaded = (await res.json()) as SajuReadingView;
      if (disposed) return;
      view = loaded;
      pages = new Map(loaded.pages.map((p) => [p.pageNumber, p]));
      answer = loaded.userAnswer;
      myReview = loaded.myReview;
      closing = loaded.closing;
      image = loaded.image;
      // 읽던 자리에서 이어 본다(§6 미해결 ③). 저장된 값이 지금 장 수보다 크면(상품이 바뀐
      // 옛 리포트) clamp 가 마지막 장으로 떨어뜨려 빈 화면을 그리지 않는다.
      index = clamp(loaded.lastReadPage);
    } catch {
      if (!disposed) loadError = RETRYABLE.message;
    } finally {
      if (!disposed) {
        loading = false;
        publish();
        if (view) drive();
      }
    }
  }

  function clamp(next: number): number {
    return Math.min(Math.max(next, 0), Math.max(pageCount() - 1, 0));
  }

  // ── 섹션 생성 ──────────────────────────────────────────────────────────────

  async function postPage(pageNumber: number): Promise<PageOutcome> {
    const res = await deps.fetch(`${base}/pages/${pageNumber}`, { method: "POST" });
    const body = await readJson(res);
    if (res.ok && body.page) return { type: "ready", page: body.page as SajuReadingPageView };
    if (res.status === 409 && body.error === "missing_previous" && typeof body.missing === "number") {
      return { type: "missing_previous", missing: body.missing };
    }
    // 아래 둘은 **기다려서 풀리지 않는다.** 재시도를 권하면 사용자가 영원히 다시 누른다.
    if (res.status === 409 && body.error === "reading_failed") return { type: "error", error: READING_FAILED };
    if (res.status === 409 && body.error === "product_gone") return { type: "error", error: PRODUCT_GONE };
    return { type: "error", error: RETRYABLE };
  }

  function ensurePage(pageNumber: number): Promise<void> {
    if (disposed) return Promise.resolve();
    if (pageNumber < 1 || pageNumber > sectionCount()) return Promise.resolve();
    if (pages.has(pageNumber)) return Promise.resolve();
    // **여기가 중복 과금을 막는 자리다.** 같은 번호가 이미 날아가 있으면 그 약속을 그대로 준다.
    const running = pageInFlight.get(pageNumber);
    if (running) return running;

    const task = (async () => {
      try {
        let outcome = await postPage(pageNumber);

        // `missing_previous` 자가 회복. 정상 흐름에서는 나지 않는다 — 앞 장을 읽어야 뒤로 오기
        // 때문이다. 그래도 나면(주소 직접 입력, 앞 장 생성이 실패한 뒤 새로고침) 화면이 멈추면
        // 안 되므로 빠진 번호부터 채우고 다시 시도한다.
        //
        // 두 가지를 반드시 막아야 한다.
        //
        // 1. **상한.** 서버가 매번 같은 번호를 돌려주면 POST 가 무한히 나가고 과금이 샌다.
        // 2. **`missing` 이 앞 번호라는 것.** 게이트는 늘 `pageNumber - 1` 을 주지만(`storage.ts`
        //    의 `pageGateReason`), 그게 아닌 값이 오면 회복을 따라가면 안 된다. `missing` 이 자기
        //    번호면 `await` 가 **자기 자신의 약속**을 기다려 영구 교착이고(이 번호는 이미
        //    `pageInFlight` 에 있다), 두 번호가 서로를 가리키면 둘이 맞물려 멈춘다. 화면이 조용히
        //    죽는 쪽이 에러를 보이는 쪽보다 나쁘다. 엄격히 감소할 때만 따라간다.
        for (
          let guard = 0;
          outcome.type === "missing_previous" &&
          outcome.missing < pageNumber &&
          guard <= sectionCount() + 2;
          guard++
        ) {
          await ensurePage(outcome.missing);
          outcome = await postPage(pageNumber);
        }

        if (disposed) return;

        if (outcome.type === "ready") {
          pages = new Map(pages).set(pageNumber, outcome.page);
          if (pageErrors.has(pageNumber)) {
            pageErrors = new Map(pageErrors);
            pageErrors.delete(pageNumber);
          }
          publish();
          return;
        }

        // 여기 오는 또 하나의 길은 위 루프가 상한에서 멈춘 경우다(`missing_previous` 무한 반복).
        // 그건 서버 상태가 이상한 것이라 다시 눌러도 같으니 재시도를 권하지 않는다.
        pageErrors = new Map(pageErrors).set(
          pageNumber,
          outcome.type === "error" ? outcome.error : PRODUCT_GONE
        );
        publish();
      } catch {
        if (disposed) return;
        pageErrors = new Map(pageErrors).set(pageNumber, RETRYABLE);
        publish();
      } finally {
        pageInFlight.delete(pageNumber);
      }
    })();

    pageInFlight.set(pageNumber, task);
    return task;
  }

  // ── 총평 ───────────────────────────────────────────────────────────────────

  /** 사연 답변을 확보한다. 총평(`ensureClosing`)과 모양이 같다 — 전제도 같고(모든 섹션 완료)
   *  덜 찼을 때 빠진 번호를 받아 스스로 메우는 회복 방식도 같다.
   *
   *  **총평과 따로 거는 이유**: 서버는 총평을 만들 때 답변을 먼저 만들지만(`produce.ts`),
   *  그러면 답변이 총평과 **같은 시점에** 끝난다. 화면에서 답변 장은 총평보다 앞이라,
   *  그때까지 기다리면 사용자는 답변 장에서 총평이 끝나기를 기다리게 된다. */
  function ensureAnswer(): Promise<void> {
    if (disposed || answer || !hasAnswerPage()) return Promise.resolve();
    if (answerInFlight) return answerInFlight;

    const task = (async () => {
      answerBusy = true;
      answerError = null;
      publish();
      try {
        for (let guard = 0; guard <= sectionCount() + 2; guard++) {
          const res = await deps.fetch(`${base}/answer`, { method: "POST" });
          const body = await readJson(res);
          if (res.ok && body.answer) {
            answer = body.answer as SajuAnswer;
            return;
          }
          if (res.status === 409 && body.error === "sections_incomplete" && Array.isArray(body.missing)) {
            for (const n of body.missing as number[]) await ensurePage(n);
            continue;
          }
          answerError = res.status === 409 && body.error === "product_gone" ? PRODUCT_GONE : RETRYABLE;
          return;
        }
        answerError = RETRYABLE;
      } catch {
        answerError = RETRYABLE;
      } finally {
        answerBusy = false;
        answerInFlight = null;
        if (!disposed) publish();
      }
    })();

    answerInFlight = task;
    return task;
  }

  function ensureClosing(): Promise<void> {
    if (disposed || closing) return Promise.resolve();
    if (closingInFlight) return closingInFlight;

    const task = (async () => {
      closingBusy = true;
      closingError = null;
      publish();
      try {
        for (let guard = 0; guard <= sectionCount() + 2; guard++) {
          const res = await deps.fetch(`${base}/closing`, { method: "POST" });
          const body = await readJson(res);
          if (res.ok && body.closing) {
            closing = body.closing as SajuClosing;
            return;
          }
          // 너무 일찍 불렀다. 서버가 **빠진 번호들을 그대로** 준다 — 개수에서 번호를 역산하지
          // 않는다. 역산은 "1..N 이 연속으로 찬다"에 기대는데, 그게 깨지는 날 조용히 엉뚱한
          // 페이지를 만들게 된다.
          if (res.status === 409 && body.error === "sections_incomplete" && Array.isArray(body.missing)) {
            for (const n of body.missing as number[]) await ensurePage(n);
            continue;
          }
          // 상품 정의가 사라진 건은 섹션을 마저 만들 수 없어서 총평도 영원히 안 나온다.
          closingError = res.status === 409 && body.error === "product_gone" ? PRODUCT_GONE : RETRYABLE;
          return;
        }
        closingError = RETRYABLE;
      } catch {
        closingError = RETRYABLE;
      } finally {
        closingBusy = false;
        closingInFlight = null;
        publish();
      }
    })();

    closingInFlight = task;
    return task;
  }

  // ── 이미지 ─────────────────────────────────────────────────────────────────
  //
  // `image.url` 은 `/api/saju/readings/{id}/image` 이고 그 GET 은 `Authorization: Bearer` 를
  // 요구한다. `<img src>` 는 헤더를 못 실으므로 **주소를 그대로 걸면 401 이다.** 그래서 바이트를
  // 받아 blob 주소로 바꿔 넘긴다.
  async function loadImageUrl(): Promise<string | null> {
    const res = await deps.fetch(`${base}/image`);
    if (res.status === 404) return null;
    if (!res.ok || !res.blob) throw new Error("image_fetch_failed");
    return deps.createObjectUrl(await res.blob());
  }

  function runImage(regenerate: boolean): Promise<void> {
    if (disposed) return Promise.resolve();
    if (imageInFlight) return imageInFlight;

    const task = (async () => {
      imageBusy = true;
      imageError = null;
      publish();
      try {
        // POST 는 **부를 때마다 새로 그린다.** 그래서 처음 없을 때와 사용자가 다시 뽑을 때만
        // 보낸다 — 조건을 빼면 방문마다 8원이 나간다.
        if (regenerate || image === null) {
          const res = await deps.fetch(`${base}/image`, { method: "POST" });
          const body = await readJson(res);
          if (!res.ok || !body.image) {
            imageError = RETRYABLE.message;
            return;
          }
          image = body.image as SajuReadingImage;
        }
        const url = await loadImageUrl();
        if (disposed) {
          if (url) deps.revokeObjectUrl(url);
          return;
        }
        // 앞서 만든 blob 주소는 반드시 놓아준다 — 다시 뽑기를 여러 번 누르면 그만큼 샌다.
        if (imageObjectUrl) deps.revokeObjectUrl(imageObjectUrl);
        imageObjectUrl = url;
      } catch {
        imageError = RETRYABLE.message;
      } finally {
        imageBusy = false;
        imageInFlight = null;
        publish();
      }
    })();

    imageInFlight = task;
    return task;
  }

  // ── 읽던 위치 ──────────────────────────────────────────────────────────────
  // **응답을 기다리지 않는다.** 위치 기록이 실패했다고 읽기를 막으면 손해가 더 크다.
  function patchLastRead(pageNumber: number) {
    void Promise.resolve()
      .then(() =>
        deps.fetch(`${base}/last-read`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pageNumber }),
        })
      )
      .catch(() => {});
  }

  /** 지금 장에 필요한 것을 시작한다. 이동할 때와 첫 조회 직후에 부른다. */
  function drive() {
    if (disposed || !view) return;

    // 환불된 건(`status === "failed"`)과 만료된 건은 아무것도 새로 만들지 않는다. 화면은 이
    // 상태를 안내 한 장으로 가리지만(`page.tsx` 의 `refunded`), `load()` 는 화면이
    // 무엇을 그리기로 했든 항상 이 함수를 부르므로 여기서도 막아야 한다. 안 막으면 총평(약
    // 20원)·이미지(8원)는 `ensurePage` 처럼 순서 게이트가 없어서(`produce.ts` 의 `runImage`·
    // `runClosing` 은 `pageGateReason` 을 안 거친다) 트리거 지점(§6)을 이미 지난 채로 다시
    // 열기만 해도 그대로 나간다 — 화면에 안 보인다고 돈이 안 나가는 게 아니다.
    if (view.status === "failed") return;

    // 목차(0)에 있으면 1번을, 섹션 N 에 있으면 N 과 N+1 을 확보한다. 버퍼는 한 장이면
    // 충분하다 — 한 장 읽는 시간(1분)이 한 장 만드는 시간(10~14초)보다 훨씬 길어서, 두 장을
    // 앞서 당겨도 기다림이 더 줄지 않고 과금만 앞당겨진다.
    if (index === 0) {
      void ensurePage(1);
    } else if (index >= 1 && index <= sectionCount()) {
      void ensurePage(index);
      void ensurePage(index + 1);
    }

    // 답변은 총평보다 **한 장 앞서** 건다. 총평 트리거와 같은 자리에서 걸면 답변 장에
    // 들어서는 순간 비어 있고, 그때부터 만들기 시작해 기다림이 그대로 보인다.
    if (hasAnswerPage() && index >= Math.max(answerIndex() - 1, 0)) void ensureAnswer();

    if (index >= closingTriggerIndex()) void ensureClosing();

    // 이미지는 **맨 뒤에 붙이지 않는다**(§6). 8초가 걸리므로 리포트를 열자마자 시작해 두면
    // 사용자가 그 장에 닿을 때 이미 준비돼 있다.
    if (hasImagePage() && !imageKickedOff) {
      imageKickedOff = true;
      void runImage(false);
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    load,
    goTo(next) {
      const target = clamp(next);
      if (target === index) return;
      index = target;
      publish();
      patchLastRead(target);
      drive();
    },
    next() {
      this.goTo(index + 1);
    },
    prev() {
      this.goTo(index - 1);
    },
    regenerateImage() {
      void runImage(true);
    },
    async submitReview(stars, body) {
      if (disposed) return "잠시 후 다시 시도해 주세요.";
      try {
        const res = await deps.fetch(`${base}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stars, body }),
        });
        const payload = await readJson(res);
        if (!res.ok) return typeof payload.error === "string" ? payload.error : RETRYABLE.message;
        // 서버가 받은 값을 그대로 들고 있는다 — 화면이 자기 입력으로 그리면 서버가 다듬은
        // 결과(앞뒤 공백 제거 등)와 어긋난다.
        myReview = (payload.review as SajuReview) ?? null;
        publish();
        return null;
      } catch {
        return RETRYABLE.message;
      }
    },
    retryPage(pageNumber) {
      // 자리표가 남은 섹션은 다시 시도하지 않는다(§9) — 이미 3회 했다.
      if (pages.get(pageNumber)?.kind === "failed") return;
      // 끝난 실패(`product_gone`·환불된 건)도 마찬가지다. 화면이 버튼을 안 그리는 게 맞지만,
      // 그 판단을 화면에만 맡기면 화면 하나가 빠뜨리는 순간 헛호출이 반복된다.
      if (pageErrors.get(pageNumber)?.retryable === false) return;
      if (pageErrors.has(pageNumber)) {
        pageErrors = new Map(pageErrors);
        pageErrors.delete(pageNumber);
        publish();
      }
      void ensurePage(pageNumber);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      if (imageObjectUrl) deps.revokeObjectUrl(imageObjectUrl);
      imageObjectUrl = null;
    },
  };
}
