"use client";

// 마지막 장 — 총평.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰만 쓴다. 정해지지 않은 것: "다음 걸음"을 번호로 할지
// 체크박스로 할지, 끝에 공유·저장 버튼을 둘지, 처음으로 돌아가는 링크를 둘지.
//
// **이 장이 리포트의 결론이다**(§1 "총평은 마지막이다"). 0페이지의 목차와 혼동하면 안 된다 —
// 목차는 "무슨 이야기를 할 것인가"이고 이쪽은 10장을 실제로 읽은 뒤의 답이다. 그래서 내용도
// 골격이 예측한 것이 아니라 **섹션들이 실제로 쓴 결론을 받아** 만든 것이다.
import type { ReactNode } from "react";
import type { SajuClosing } from "@/lib/saju/generate/closing";
import type { ReaderError } from "./sajuReaderCore";

export default function ReaderClosing({
  closing,
  busy,
  error,
  review,
}: {
  closing: SajuClosing | null;
  busy: boolean;
  error: ReaderError | null;
  /** 별점·후기 슬롯. **이 카드 안에** 들어간다(`ReaderReview.tsx` 머리말) — 그래서 형제
   *  컴포넌트가 아니라 자식으로 받는다. 총평이 아직 없을 때는 그리지 않는다: 읽지도 않은
   *  결론에 별점을 묻는 꼴이 된다. */
  review: ReactNode;
}) {
  // 총평은 이미지 장에 들어설 때 미리 걸어 두므로(§6) 여기서 기다리는 일은 거의 없다.
  if (!closing) {
    return (
      <section className="rounded-[32px] border border-border bg-topbar p-6">
        <p className="py-16 text-center text-sm font-semibold text-icon-muted">
          {busy ? "전체를 정리하고 있어요..." : (error?.message ?? "아직 준비되지 않았어요.")}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <p className="text-sm font-semibold text-point-text">총평</p>
      <h2 className="mt-1 text-2xl font-bold text-bold-text">{closing.title}</h2>
      <p className="mt-4 whitespace-pre-line text-base font-semibold leading-relaxed text-text">{closing.body}</p>

      {/* 섹션마다 흩어져 있던 행동 가이드를 사용자가 실제로 움직일 수 있는 크기로 추린 것이다 —
          10개를 그대로 나열하면 아무것도 안 하게 된다(`SajuClosing.nextSteps` 주석). */}
      {closing.nextSteps.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-bold text-bold-text">지금부터 할 일</p>
          <ol className="mt-3 flex flex-col gap-3">
            {closing.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-sm font-bold text-point-text">{i + 1}</span>
                <span className="text-base font-semibold leading-relaxed text-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {review}
    </section>
  );
}
