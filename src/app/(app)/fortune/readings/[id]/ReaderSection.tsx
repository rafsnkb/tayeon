"use client";

// 섹션 본문 한 장.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰만 쓴다. 정해지지 않은 것: 다섯 단의 시각적 위계
// (지금은 소제목 + 문단), 교차 분석을 접었다 펼지, 행동 가이드를 체크리스트로 만들지.
//
// **통합 모드는 5단이고 단일 모드는 교차 분석이 없다**(기획 3.1). 그 분기를 모드 값이 아니라
// **데이터 유무**로 판단한다 — `generateSection` 이 단일 모드에서 해당 칸을 빈 문자열로 잘라
// 넣으므로(그 파일의 `chart.saju ? ... : ""`), 여기서 모드를 다시 보면 판단이 두 곳이 된다.
import type { SajuSection } from "@/lib/saju/generate/section";

/** 근거 블록. 사주·자미두수가 같은 모양이라 하나로 둔다. */
function Basis({ label, body }: { label: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="mt-5">
      <p className="text-sm font-bold text-point-text">{label}</p>
      <p className="mt-1 whitespace-pre-line text-base font-semibold leading-relaxed text-text">{body}</p>
    </div>
  );
}

export default function ReaderSection({
  pageNumber,
  section,
}: {
  pageNumber: number;
  section: SajuSection;
}) {
  return (
    <article className="rounded-[32px] border border-border bg-topbar p-6">
      <p className="text-sm font-semibold text-icon-muted">{pageNumber}장</p>
      {/* 소제목은 모델이 쓴 것이다. 상품의 섹션 제목을 그대로 되풀이하지 않도록 프롬프트가
          막고 있다(§5 주의 4) — 목차의 제목과 다른 것이 정상이다. */}
      <h2 className="mt-1 text-xl font-bold text-bold-text">{section.title}</h2>

      {/* 5단 중 1 — 질문에 대한 직접 답. 가장 먼저 읽는 자리라 본문보다 크게 둔다. */}
      <p className="mt-4 whitespace-pre-line text-lg font-bold leading-relaxed text-bold-text">
        {section.summary}
      </p>

      <Basis label="사주에서는" body={section.sajuBasis} />
      <Basis label="자미두수에서는" body={section.ziweiBasis} />

      {/* 교차 분석 — 통합 모드에만 있다. `crossStatus` 는 지정된 5개 중 하나이고 새로 만들지
          않는다(§5 주의 5, 위반 0건). 퍼센트로 일치도를 말하지 않기로 한 자리다. */}
      {section.crossStatus && (
        <div className="mt-6 rounded-2xl bg-point-bg p-5">
          <p className="text-sm font-bold text-point-text">{section.crossStatus}</p>
          {section.crossSummary.trim() && (
            <p className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
              {section.crossSummary}
            </p>
          )}
        </div>
      )}

      {/* 5단 중 5 — 사용자가 **실제로 통제할 수 있는** 행동이어야 한다(기획 7.3 체크리스트). */}
      {section.actionGuide.trim() && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-bold text-bold-text">이렇게 해보세요</p>
          <p className="mt-2 whitespace-pre-line text-base font-semibold leading-relaxed text-text">
            {section.actionGuide}
          </p>
        </div>
      )}
    </article>
  );
}
