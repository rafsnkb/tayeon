"use client";

// 본문이 **아직 없거나 더는 없는** 장들 — 생성 중 / 실패 자리표 / 리포트 전체가 막힌 두 상태
// (환불).
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰과 기존 화면의 패턴만 쓴다. 새 룩을 만들지 않는다.
// 목업이 오면 이 파일들의 **안쪽만** 바뀌고 `page.tsx` 의 분기는 그대로 남는다.
//
// 넷을 한 파일에 둔 것은 크기가 작고 서로 닮아서다 — 둘(`ReaderPending`·`ReaderFailed`)은
// 섹션 장 자리에서 `renderPage` 가 그리고, `ReaderRefunded` 는 `page.tsx`
// 가 장 분기보다 앞에서 통째로 대신 그린다. 목업에서 서로 다른 모양이 되면 파일을 쪼개면 된다.
import Link from "next/link";
import type { ReaderError } from "./sajuReaderCore";

/**
 * 리포트 전체가 환불 처리된 건(`status === "failed"`, §9).
 *
 * **장 분기보다 앞에서 이 한 장만 그린다.** 목차를 그려 두고 넘길 때마다 409 를 받아 알려 주면
 * 같은 사실을 열 번 말하게 된다 — `storage.ts` 가 `failed` 를 "더 읽히지도 생성되지도 않게 막는
 * 표시"로 정의했으니 사용자에게 할 말도 하나다.
 *
 * **버튼을 주지 않는다.** "다시 시도"도 "고객센터 문의"도 없다 — 환불이 이미 끝났으므로 사용자가
 * 할 일이 없고, 할 일 없는 사람에게 버튼을 주면 눌러 보게 되고 그게 문의로 돌아온다. 돌아갈 곳
 * 하나만 둔다.
 *
 * ⚠️ **임시 구현 — 목업 대기 중.** 문구의 톤(사과를 얼마나 할지), 「결제 내역」 링크를 붙일지,
 * 환불 금액·시점을 보여줄지는 정해지지 않았다.
 */
export function ReaderRefunded() {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <div className="py-10 text-center">
        <p className="text-lg font-bold text-bold-text">이 리포트는 환불 처리됐어요</p>
        <p className="mt-3 text-sm font-semibold text-text">
          해석을 끝까지 만들지 못해서 결제를 취소했어요. 불편을 드려 죄송해요.
        </p>
        <Link
          href="/my-readings"
          className="mt-6 inline-block rounded-full bg-cta-fill px-6 py-3 text-sm font-bold text-cta-text"
        >
          보관함으로
        </Link>
      </div>
    </section>
  );
}


/** 장 제목 줄. 세 상태가 공유한다 — 제목은 늘 골격에서 오므로 본문이 없어도 보여 줄 수 있다. */
function PageHeading({ pageNumber, title }: { pageNumber: number; title: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-icon-muted">{pageNumber}장</p>
      <h2 className="mt-1 text-xl font-bold text-bold-text">{title}</h2>
    </div>
  );
}

/**
 * 생성 중. 여기서 기다리는 시간은 **정상 흐름에서는 거의 0이다** — 앞 장을 읽는 동안 미리
 * 만들어 두기 때문이다(§6). 이 화면이 실제로 보이는 건 사용자가 읽는 속도가 생성보다 빠른
 * 경우(대충 넘기는 경우)뿐이라, 진행률을 보여줄 필요가 없다.
 */
export function ReaderPending({
  pageNumber,
  title,
  error,
  onRetry,
}: {
  pageNumber: number;
  title: string;
  error: ReaderError | null;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <PageHeading pageNumber={pageNumber} title={title} />
      {!error ? (
        <p className="py-16 text-center text-sm font-semibold text-icon-muted">해석을 쓰고 있어요...</p>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-text">{error.message}</p>
          {/* **재시도는 `retryable` 일 때만 보여 준다.** 끝난 실패에 버튼을 주면 사용자가 절대
              성공하지 않는 버튼을 계속 누른다(`ReaderError` 주석 참고). */}
          {error.retryable && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-full bg-cta-fill px-5 py-2 text-sm font-bold text-cta-text"
            >
              다시 시도
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 실패 자리표(§9). **"다시 시도"를 절대 권하지 않는다** — 이미 3회 시도했고 운영자에게 알림도
 * 나갔다. 버튼을 주면 눌러도 아무 일이 일어나지 않는다(코어의 `retryPage` 가 막는다).
 *
 * 전액 환불도 하지 않는다: 나머지 장은 정상이고 사용자는 이미 읽었다. 그래서 문구는 사과이지
 * 조치 안내가 아니다.
 */
export function ReaderFailed({
  pageNumber,
  title,
  attempts,
}: {
  pageNumber: number;
  title: string;
  attempts: number;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <PageHeading pageNumber={pageNumber} title={title} />
      <div className="mt-6 rounded-2xl bg-warning p-5">
        <p className="text-sm font-bold text-warning-text">이 장은 준비하지 못했어요</p>
        <p className="mt-2 text-sm font-semibold text-warning-text">
          여러 번 시도했지만 이 장만 완성하지 못했어요. 확인하고 있으니 다른 장은 그대로 보셔도 괜찮아요.
        </p>
      </div>
      {/* 시도 횟수는 운영 정보다. 사용자에게 큰 글씨로 들이밀 값은 아니지만, 문의가 왔을 때
          같은 화면을 보며 이야기할 수 있어야 해서 작게 남긴다. */}
      <p className="mt-3 text-center text-xs font-semibold text-icon-muted">시도 {attempts}회</p>
    </section>
  );
}
