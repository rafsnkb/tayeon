"use client";

// 명식(사주 기둥·자미두수) 표시 — 리더 어디에 끼울지는 이 파일 밖의 결정이다.
//
// ⚠️ **임시 구현 — 목업 대기 중.** 기존 토큰만 쓴다.
//
// **장식이 아니라 신뢰 장치다**(2026-09-26 사용자 결정 — "명식은 우리도 보여주자. 다른 운세
// 서비스들도 다 하는 거라 우리만 없어"). 본문이 "일간 병화와 일지 인목의 흐름이 맞물리며" 식으로
// 근거를 대는데, 독자가 그 근거를 대조할 자리가 지금까지 없었다.
//
// ── 2026-09-27, 블록 3종으로 재구성 ──────────────────────────────────────────
// 경쟁사(사주담) 실측 결과 명식 블록이 편마다 크기·종류가 다르다 — 전체를 매번 다시 그리지
// 않고 **그 편이 실제로 인용하는 칸만** 얹는다. 목업(`asset/Screen/saju_report_mockup/
// mockup.css` 의 `.evidence-strip`·`.evidence-pair`, situationship-reading 등 3 파일에
// 36개 장 전부 실측)에서 이미 검증한 모양을 그대로 옮긴다 — 새로 디자인하지 않는다.
//
//   A. `ReaderChartFull`  — 명식 페이지 전체판. 옛 기본 내보내기가 이것이다.
//   B. `ReaderChartPair`  — 카드쌍(궁/기둥 한 칸 ＋ 십신/주성 한 칸 ＋ 한 줄 설명). 목업 실측
//      120~140px.
//   C. `ReaderChartStrip` — 한 줄 띠(라벨·값 2~3쌍). 목업 실측 40~50px, 통합 모드처럼 두 줄
//      (사주+자미두수)이면 90~110px.
//
// **B·C 는 "어느 칸을 그릴지"를 미리 결정된 문자열로 받는다.** 어느 궁·십신을 고를지는 이
// 컴포넌트의 책임이 아니다 — 생성 쪽(`sajuRefs`/`ziweiRefs`, sub_1 작업, 아직 스키마 미확정)이
// 정할 일이고, 그 값이 나오면 `ChartCellItem` 으로 변환하는 얇은 어댑터 하나만 있으면 된다.
// 그래서 여기서는 **props 모양만** 정한다 — 화면·데이터를 갈라 두는 이 파일의 원칙을 B·C 에도
// 그대로 지킨 것이다.
import type { SajuChartView, SajuPersonChartView, SajuPillarView, ZiweiChartView } from "@/lib/saju/view";

const PILLAR_LABEL = { year: "연주", month: "월주", day: "일주", hour: "시주" } as const;
const PILLAR_ORDER = ["year", "month", "day", "hour"] as const;

function SajuPillars({ saju }: { saju: SajuPillarView }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-point-text">사주 기둥</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {PILLAR_ORDER.map((key) => {
          const ganji = saju.pillars[key];
          const tenGod = saju.tenGods[key];
          return (
            <div key={key} className="rounded-2xl bg-point-bg px-2 py-3 text-center">
              <p className="text-xs font-semibold text-icon-muted">{PILLAR_LABEL[key]}</p>
              {ganji ? (
                <>
                  <p className="mt-1 text-lg font-bold text-bold-text">{ganji}</p>
                  {/* 일주는 일간(day master) 그 자체라 십신이 "일간"으로만 나온다 — 다른 기둥과
                      같은 자리에 십신을 또 적으면 같은 말을 되풀이하게 된다(calculate.ts 의
                      buildSajuPromptBlock 이 일주만 "(일간 기준)"으로 따로 적는 것과 같다). */}
                  <p className="mt-0.5 text-[11px] font-semibold text-icon-muted">
                    {key === "day" ? "일간 기준" : tenGod ? `${tenGod.stem} · ${tenGod.branch}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs font-semibold text-icon-muted">태어난 시간을 몰라서 못 봐요</p>
              )}
            </div>
          );
        })}
      </div>
      {saju.voidBranches.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-icon-muted">공망 {saju.voidBranches.join(", ")}</p>
      )}
    </div>
  );
}

function ZiweiPalaces({ ziwei }: { ziwei: ZiweiChartView }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-point-text">자미두수 명반</p>
      <p className="mt-2 text-sm font-semibold text-text">
        명궁 주성 <span className="font-bold text-bold-text">{ziwei.soul}</span> · 신궁 주성{" "}
        <span className="font-bold text-bold-text">{ziwei.body}</span>
      </p>
      <p className="mt-1 text-xs font-semibold text-icon-muted">오행국 {ziwei.fiveElementsClass}</p>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {ziwei.palaces.map((palace) => {
          const stars = [...palace.majorStars, ...palace.minorStars].join(", ") || "주요 성 없음";
          const label = palace.name.endsWith("궁") ? palace.name : `${palace.name}궁`;
          return (
            <p key={palace.name} className="text-xs font-semibold text-text">
              <span className="text-icon-muted">{label}</span> {stars}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function PersonChart({ label, person }: { label: string; person: SajuPersonChartView }) {
  if (!person.saju && !person.ziwei) return null;
  return (
    <div className="mt-5 border-t border-border pt-5 first:mt-0 first:border-t-0 first:pt-0">
      <p className="text-sm font-bold text-bold-text">{label}</p>
      {person.saju && <SajuPillars saju={person.saju} />}
      {person.ziwei && <ZiweiPalaces ziwei={person.ziwei} />}
    </div>
  );
}

/** A. 전체판 — 명식 페이지 전용. `chart`·`partnerNickname` 은 `view.ts` 의 `toReadingView` 가
 *  이미 모드·상대 유무로 걸러 낸 값이다. 이 컴포넌트는 그 결과를 그대로 그리기만 한다 — 사주
 *  단일 모드에서 `chart.self.ziwei` 가 `null` 인 것도, 궁합 아닌 상품에서 `chart.partner` 가
 *  `null` 인 것도 여기서 다시 판단하지 않는다. 판단이 두 곳에 있으면 한쪽만 고쳐지는 날이
 *  온다(`view.ts` 의 `toPersonChartView` 주석과 같은 이유). */
export function ReaderChartFull({
  chart,
  partnerNickname,
}: {
  chart: SajuChartView;
  partnerNickname: string | null;
}) {
  return (
    <section className="rounded-[32px] border border-border bg-topbar p-6">
      <p className="text-sm font-semibold text-point-text">명식</p>
      <p className="mt-1 text-sm font-semibold text-icon-muted">
        이 리포트가 근거로 쓴 명식이에요. 본문에서 말하는 근거를 여기서 직접 확인해볼 수 있어요.
      </p>
      <PersonChart label="나" person={chart.self} />
      {chart.partner && <PersonChart label={partnerNickname ?? "상대방"} person={chart.partner} />}
    </section>
  );
}

/** 옛 기본 내보내기 자리 — 아직 아무도 이 컴포넌트를 안 쓰므로(리더 배치는 sub_1 몫) 깨질
 *  호출부는 없지만, `import ReaderChart from "./ReaderChart"` 형태로 참고하던 문서·목업 링크가
 *  있을 수 있어 기본 내보내기를 유지한다. */
export default ReaderChartFull;

/** B·C 가 그리는 항목 하나. "어느 칸인지"는 이미 결정된 뒤의 라벨·값 문자열만 받는다 — 그
 *  결정(구조화된 근거 참조에서 실제 칸을 고르는 일)은 sub_1 의 생성 쪽 몫이고 이 컴포넌트의
 *  책임이 아니다. `who` 를 생략하면 그 항목 앞에 인물 칩을 안 그린다(궁합 아닌 상품, 1인분). */
export type ChartCellItem = {
  who?: string;
  /** "시주"·"부처궁" 처럼 자리를 가리키는 말. */
  label: string;
  /** "식신·비견"·"거문·지겁" 처럼 그 자리의 실제 값. */
  value: string;
  /** 본문이 직접 인용한 핵심 단어만 강조한다(목업의 `<b>`) —가지고 있는 값 전부를 강조하면
   *  강조가 의미를 잃는다. */
  highlightValue?: boolean;
};

function StripItem({ item }: { item: ChartCellItem }) {
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-bold text-text">
      {item.who && (
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-point-text">
          {item.who}
        </span>
      )}
      <span className="text-icon-muted font-semibold">{item.label}</span>
      <span className={item.highlightValue ? "text-bold-text" : undefined}>{item.value}</span>
    </span>
  );
}

/**
 * C. 한 줄 띠 — 라벨·값 2~3쌍을 가로로. 가장 가볍다(목업 실측 40~50px, 한 줄 기준).
 *
 * `rows` 를 배열의 배열로 받는 이유: 통합 모드는 "사주 한 줄 + 자미두수 한 줄"처럼 **줄을
 * 나눠서** 보여줘야 한 줄에 정보가 몰리지 않는다(목업의 두 `.evidence-strip` 을 쌓는 모양과
 * 같다). 단일 모드나 항목이 하나뿐이면 `rows` 를 한 줄짜리 배열 하나로 주면 된다.
 */
export function ReaderChartStrip({ rows }: { rows: ChartCellItem[][] }) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-point-bg px-3.5 py-2.5">
          {row.map((item, j) => (
            <span key={j} className="flex items-center gap-3">
              {j > 0 && <span className="h-3.5 w-px bg-border" aria-hidden />}
              <StripItem item={item} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * B. 카드쌍 — 궁/기둥 한 칸 ＋ 십신/주성 한 칸을 `＋` 로 잇고, 아래에 한 줄 설명을 단다.
 * 목업 실측 120~140px. 사주담이 "얼굴/성격" 류 장에 쓰는 모양과 같다 — 그 장의 핵심 근거가
 * 딱 두 자리로 요약될 때 쓴다(그 외엔 C 를 쓴다).
 */
export function ReaderChartPair({
  who,
  cells,
  note,
}: {
  /** 이 카드쌍이 누구·무엇에 대한 것인지 — "나 · 타고난 바탕", "두 일간의 궁합" 처럼 사람
   *  이름이 아니라 **주제**를 적을 때도 있다(목업 life-overview 1장, situationship 1장). */
  who: string;
  cells: [{ label: string; value: string }, { label: string; value: string }];
  note: string;
}) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 inline-block rounded-full bg-point-bg px-2 py-0.5 text-[11px] font-bold text-point-text">
        {who}
      </span>
      <div className="flex items-stretch gap-2">
        {cells.map((cell, i) => (
          <span key={i} className="contents">
            {i > 0 && <span className="self-center text-[15px] font-bold text-point-text">＋</span>}
            <div className="flex-1 rounded-2xl bg-point-bg px-2.5 py-2.5 text-center">
              <p className="text-[11px] font-bold text-icon-muted">{cell.label}</p>
              <p className="mt-0.5 text-[15px] font-bold text-bold-text">{cell.value}</p>
            </div>
          </span>
        ))}
      </div>
      <p className="mt-1.5 px-0.5 text-[12.5px] font-semibold text-icon-muted">{note}</p>
    </div>
  );
}
