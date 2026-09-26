"use client";

// 리포트 뷰어 — 라우트 껍데기.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 지금 정해지지 않은 것:
//   - 장을 넘기는 방식. 여기서는 아래 고정 바의 이전/다음 버튼이다. 스와이프·세로 스크롤·
//     페이지 점 표시 중 무엇으로 갈지는 목업이 정한다.
//   - 상단 제목(지금은 상품 제목), 진행 표시(지금은 `n / 전체`)의 모양.
//   - 마지막 장 다음에 무엇을 둘지(목록으로 돌아가기, 공유, 다시 읽기).
//
// **새 룩을 만들지 않았다.** 색·간격·모서리는 전부 `globals.css` 의 토큰과 기존 서브페이지
// (`coupons/page.tsx` 등)의 패턴을 그대로 쓴다. 목업이 오면 장별 컴포넌트 **안쪽만** 바뀌고
// 이 파일의 분기는 그대로 남도록 경계를 갈라 뒀다.
//
// **논리는 여기 없다.** 페이지 구성·prefetch·총평 시점·중복 요청 방지는 `sajuReaderCore.ts` 가
// 한다(그 파일 머리말 참고). 이 파일은 `page.kind` 로 갈라 그리는 일만 한다 — 그래서 목업 교체가
// 과금 로직을 건드릴 수 없다.
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import SubPageTopBar from "@/components/SubPageTopBar";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { getSajuProduct } from "@/lib/saju/products";
import { useSajuReader, type ReaderPage, type SajuReader } from "./useSajuReader";
import ReaderToc from "./ReaderToc";
import ReaderSection from "./ReaderSection";
import ReaderImage from "./ReaderImage";
import ReaderClosing from "./ReaderClosing";
import { ReaderFailed, ReaderPending, ReaderRefunded } from "./ReaderStates";

export default function FortuneReadingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const readingId = params.id;
  const { user, authChecked } = useRooms();

  const reader = useSajuReader(readingId);

  // 다른 서브페이지와 같은 방식이다(`coupons/page.tsx`). 이펙트 본문에서 바로 setState 하지 않아
  // 연쇄 렌더를 만들지 않는다.
  useEffect(() => {
    if (authChecked && !user) router.replace("/login");
  }, [authChecked, user, router]);

  const product = reader.view ? getSajuProduct(reader.view.productSlug) : undefined;
  // 상품이 레지스트리에서 빠졌어도 **읽기는 막지 않는다**(`view.ts` 머리말). 제목만 대신 채운다.
  const title = product?.title ?? "운세 리포트";

  /** 환불 처리가 끝난 건이면 장 분기로 들어가지 않는다. 목차를 그려 두고 넘길 때마다 409 를
   *  받아 알려 주면 같은 사실을 장마다 되풀이하게 된다(`ReaderRefunded` 주석). */
  const refunded = reader.view?.status === "failed";
  // 만료(`expired`)는 2026-09-27 에 없어졌다 — 리포트는 무기한 보관이다. 막는 건 환불뿐이다.
  const blocked = refunded;

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title={title} backHref="/fortune" />

      {/* 아래 이동 바가 화면에 고정돼 떠 있으므로 그 높이만큼 비워 둔다 — 안 비우면 본문 마지막
          줄이 바 뒤에 영영 가린다(`coupons/page.tsx` 와 같은 이유). */}
      <div className="flex-1 overflow-visible p-4 pb-32 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {reader.loading && (
            <p className="py-16 text-center text-sm font-semibold text-icon-muted">불러오는 중...</p>
          )}

          {/* 첫 조회가 실패하면 그릴 것이 아무것도 없다 — 장 분기로 들어가지 않는다. */}
          {!reader.loading && reader.loadError && (
            <p className="py-16 text-center text-sm font-semibold text-text">{reader.loadError}</p>
          )}

          {refunded && <ReaderRefunded />}

          {!blocked && reader.page && renderPage(reader.page, title, reader)}
        </div>
      </div>

      {/* 이동 바. 하단 고정 오버레이다 — 본문을 스크롤해도 늘 손가락이 닿는 자리에 있어야 한다.
          환불된 건에서는 **숨긴다**: 넘길 장이 없고, 넘기면 장마다 같은 안내만 나온다. */}
      {reader.view && !reader.loadError && !blocked && (
        <div className="app-topbar-glass fixed inset-x-0 bottom-0 z-30 border-t border-border">
          <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-4">
            <button
              type="button"
              onClick={reader.prev}
              disabled={reader.index === 0}
              className="rounded-full bg-chip-soft px-5 py-2 text-sm font-bold text-chip-soft-text disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-sm font-semibold text-icon-muted">
              {reader.index} / {reader.pageCount - 1}
            </span>
            <button
              type="button"
              onClick={reader.next}
              disabled={reader.index >= reader.pageCount - 1}
              className="rounded-full bg-cta-fill px-5 py-2 text-sm font-bold text-cta-text disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 장 하나를 그린다. **`switch` 인 것이 의도다** — JSX 안에서 `page?.kind === "..." && ...` 로
 * 늘어놓으면 콜백(`onRetry` 등) 안에서 좁힘이 풀려서 `page.pageNumber` 를 꺼낼 수 없다.
 * `case` 안의 `page` 는 좁혀진 채로 클로저에 잡힌다.
 *
 * 목업이 오면 **이 함수의 분기는 그대로 두고** 각 컴포넌트 안쪽만 바뀐다.
 */
function renderPage(page: ReaderPage, title: string, reader: SajuReader) {
  switch (page.kind) {
    case "toc":
      return <ReaderToc title={title} entries={page.entries} onJump={reader.goTo} />;
    case "section":
      return <ReaderSection pageNumber={page.pageNumber} section={page.section} />;
    case "section-pending":
      return (
        <ReaderPending
          pageNumber={page.pageNumber}
          title={page.title}
          error={page.error}
          // `retryPage` 는 자리표와 끝난 실패를 스스로 막는다. 버튼을 그릴지 말지는
          // `error.retryable` 이 정한다(`ReaderStates.tsx`).
          onRetry={() => reader.retryPage(page.pageNumber)}
        />
      );
    case "section-failed":
      return <ReaderFailed pageNumber={page.pageNumber} title={page.title} attempts={page.attempts} />;
    case "image":
      return (
        <ReaderImage
          objectUrl={page.objectUrl}
          regeneratedCount={page.regeneratedCount}
          busy={page.busy}
          error={page.error}
          onRegenerate={reader.regenerateImage}
        />
      );
    case "closing":
      return <ReaderClosing closing={page.closing} busy={page.busy} error={page.error} />;
  }
}
