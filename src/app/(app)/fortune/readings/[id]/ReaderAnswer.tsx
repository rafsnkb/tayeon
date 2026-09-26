"use client";

// 사연 답변 장 — 총평 바로 앞.
//
// **전용 레이아웃이 아니다.** 섹션(`ReaderSection`)과 같은 부품을 같은 순서로 쓴다: 결론 →
// 근거 블록 → 「사주에서는」/「자미두수에서는」 → 마무리 카드. 모듈형 원칙(설계「모듈형 설계
// 원칙」: "페이지는 만들지 않는다, 슬롯을 채운다")이 여기서 깨지면 상품이 늘 때마다 이 장도
// 같이 늘어난다.
//
// 목업: `asset/Screen/New/Fortune_Report_QnA_Dark`·`_Light`.
//
// **별점·리뷰가 없고 다시 생성 버튼도 없다.** 리뷰는 총평 전용이고(마지막 장이라 거기가
// 자연스럽다), 다시 생성은 같은 사연을 다시 굴려도 셀링포인트가 안 되고 비용만 는다.
import type { SajuAnswer } from "@/lib/saju/generate/answer";
import type { SajuChartView } from "@/lib/saju/view";
import { chartEvidenceOf } from "./chartRefs";
import { ReaderChartPair, ReaderChartStrip } from "./ReaderChart";
import type { ReaderError } from "./sajuReaderCore";

/** 근거 블록. `ReaderSection` 의 것과 같은 모양이라 라벨만 다르다. */
function Basis({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-point-text">{label}</p>
      <p className="mt-1 whitespace-pre-line text-base font-semibold leading-relaxed text-text">{body}</p>
    </div>
  );
}

export default function ReaderAnswer({
  question,
  answer,
  chart,
  partnerNickname,
  busy,
  error,
}: {
  question: string;
  answer: SajuAnswer | null;
  chart: SajuChartView;
  partnerNickname: string | null;
  busy: boolean;
  error: ReaderError | null;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      {/* 사연 원문을 그대로 보여준다(2026-09-26 사용자 결정 — "원문 그대로 보여줘").
          경쟁 서비스가 이걸 하는 이유는 장식이 아니라 **"내 질문이 읽혔다"는 확인**이다.
          답변이 아직 없을 때도 먼저 보여준다 — 기다리는 동안 무엇을 기다리는지 알 수 있다. */}
      <p className="text-sm font-semibold text-icon-muted">남겨주신 사연 원문</p>
      <blockquote className="mt-2 whitespace-pre-line rounded-2xl bg-point-bg px-4 py-3 text-base font-bold leading-relaxed text-bold-text">
        {`"${question.trim()}"`}
      </blockquote>

      {!answer ? (
        <p className="py-16 text-center text-sm font-semibold text-icon-muted">
          {busy ? "사연을 다시 읽고 있어요..." : (error?.message ?? "아직 준비되지 않았어요.")}
        </p>
      ) : (
        <AnswerBody answer={answer} chart={chart} partnerNickname={partnerNickname} />
      )}
    </section>
  );
}

function AnswerBody({
  answer,
  chart,
  partnerNickname,
}: {
  answer: SajuAnswer;
  chart: SajuChartView;
  partnerNickname: string | null;
}) {
  // 블록 종류는 **개수가 정한다**(`chartRefs.ts`). 이 화면은 고르지 않는다.
  const evidence = chartEvidenceOf({
    chart,
    partnerNickname,
    sajuRefs: answer.sajuRefs,
    ziweiRefs: answer.ziweiRefs,
  });

  return (
    <>
      <div className="mt-5 border-t border-border pt-5">
        {evidence.kind === "pair" && (
          <ReaderChartPair who="이 답변의 근거" cells={evidence.cells} note="사연에 답하며 실제로 본 자리예요." />
        )}
        {evidence.kind === "strip" && <ReaderChartStrip rows={evidence.rows} />}

        {/* 결론이 먼저다 — 사용자는 답을 들으러 여기까지 왔다. 근거는 그 아래다. */}
        <p className="whitespace-pre-line text-lg font-bold leading-relaxed text-bold-text">{answer.summary}</p>
      </div>

      <Basis label="사주에서는" body={answer.sajuBasis} />
      <Basis label="자미두수에서는" body={answer.ziweiBasis} />

      {answer.directAnswer.trim() && (
        <div className="mt-6 border-t border-border pt-5">
          {/* 근거를 본 **뒤의** 답이다. 위 `summary` 와 같은 말처럼 보이면 안 되므로 라벨로
              그 차이를 드러낸다 — 목업의 「다시 답을 드리면」이 그 역할이다. */}
          <p className="text-sm font-bold text-point-text">다시 답을 드리면</p>
          <p className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
            {answer.directAnswer}
          </p>
        </div>
      )}

      {answer.closingNote.trim() && (
        <div className="mt-6 rounded-2xl bg-point-bg p-5">
          <p className="text-sm font-bold text-point-text">마무리</p>
          <p className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
            {answer.closingNote}
          </p>
        </div>
      )}
    </>
  );
}
