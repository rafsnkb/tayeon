"use client";

// 별점·후기 — **총평 카드 안의 슬롯**이다. 새 카드를 만들지 않는다.
//
// 목업(New/`Fortune_Report_End_Dark`·`_Light`, 2026-09-27 갱신분)이 총평과 같은 카드 안에
// 이어 붙인다. 별개 카드로 세우면 "총평 하나 읽고 끝"인 화면에 딴 데서 온 것처럼 보인다.
//
// **기본 별점을 주지 않는다.** 3~4점을 미리 켜 두면 응답이 그 값으로 쏠린다 — 귀찮으면 그냥
// 두고 제출하기 때문이다. 아무것도 안 켜진 채로 시작해서 고르게 한다.
//
// 한 번 남기면 **고칠 수 없다**(`review.ts` 머리말). 쿠폰이 걸려 있어서, 고칠 수 있게 하면
// "쿠폰 받고 별 1개로 바꾸기"가 열린다.
import { useState } from "react";
import { REVIEW_MIN_BODY_CHARS, REVIEW_MAX_BODY_CHARS, type SajuReview } from "@/lib/saju/review";

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-2" role={onPick ? "radiogroup" : undefined} aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const star = (
          <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden>
            <path
              d="M12 2.6l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.7l-5.88 3.09 1.12-6.55L2.48 9.6l6.58-.96L12 2.6z"
              className={on ? "fill-point" : "fill-chip-soft"}
            />
          </svg>
        );
        if (!onPick) return <span key={n}>{star}</span>;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} aria-label={`${n}점`} onClick={() => onPick(n)}>
            {star}
          </button>
        );
      })}
    </div>
  );
}

/** 이미 남긴 뒤. 방금 낸 것도, 재방문해서 본 것도 같은 모양이다. */
function SubmittedReview({ review }: { review: SajuReview }) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-lg font-bold text-bold-text">남겨주신 후기</p>
      <div className="mt-3">
        <Stars value={review.stars} />
      </div>
      <p className="mt-3 whitespace-pre-line text-base font-semibold leading-relaxed text-text">{review.body}</p>
      <p className="mt-3 text-sm font-semibold text-icon-muted">
        후기 감사 쿠폰은 마이 페이지→쿠폰함에서 확인하실 수 있어요.
      </p>
    </div>
  );
}

export default function ReaderReview({
  myReview,
  onSubmit,
}: {
  myReview: SajuReview | null;
  /** 성공하면 `null` 이 아닌 후기를, 실패하면 보여줄 메시지를 돌려준다. 이 컴포넌트는 통신을
   *  모른다 — 화면과 네트워크를 갈라 두는 이 폴더의 방식 그대로다(`sajuReaderCore.ts`). */
  onSubmit: (stars: number, body: string) => Promise<string | null>;
}) {
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SajuReview | null>(null);

  const submitted = done ?? myReview;
  if (submitted) return <SubmittedReview review={submitted} />;

  const trimmed = body.trim();
  const ready = stars >= 1 && trimmed.length >= REVIEW_MIN_BODY_CHARS;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(stars, trimmed);
    setBusy(false);
    if (message) return setError(message);
    // 낙관적으로 그리지 않는다 — 서버가 받은 값을 그대로 다시 그린다. 쿠폰까지 걸린 쓰기라
    // "화면엔 남겨졌는데 실제로는 안 남은" 상태를 만들면 안 된다.
    setDone({ readingId: "", productSlug: "", stars, body: trimmed, createdAt: new Date().toISOString() });
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-lg font-bold text-bold-text">해석은 어떠셨나요?</p>
      <p className="mt-2 text-base font-semibold leading-relaxed text-icon-muted">
        마음에 드셨다면 별점과 후기를 남겨주세요.
        <br />
        리뷰 작성 보답으로 타연 내 모든 상품에 적용 가능한{" "}
        <span className="font-bold text-point-text">10% 할인 쿠폰</span>을 지급해 드립니다.
      </p>

      <div className="mt-5 border-t border-border pt-5">
        <Stars value={stars} onPick={setStars} />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-icon-muted">
          후기는 <span className="font-bold text-bold-text">{REVIEW_MIN_BODY_CHARS}자 이상</span> 작성해주세요.
        </p>
        <p className="shrink-0 text-sm font-semibold text-icon-muted">
          {trimmed.length}/{REVIEW_MIN_BODY_CHARS}자
        </p>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={REVIEW_MAX_BODY_CHARS}
        rows={5}
        placeholder="해석에서 마음에 든 점을 남겨주세요."
        className="mt-2 w-full resize-none rounded-2xl border border-border bg-surface p-4 text-base font-semibold leading-relaxed text-bold-text placeholder:text-placeholder"
      />

      {error && <p className="mt-2 text-sm font-semibold text-urgent">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!ready || busy}
        className="mt-4 block h-12 w-full rounded-full bg-point text-base font-bold text-white disabled:bg-chip-fill disabled:text-chip-muted-text disabled:opacity-60"
      >
        {busy ? "남기는 중..." : "후기 작성하고 10% 할인 쿠폰 받기"}
      </button>
    </div>
  );
}
