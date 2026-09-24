"use client";

import { COMBOS, SPREAD_ORDER, type ComboKey, type SpreadKey } from "@/lib/tarot/pricing";

/** 조합 목록. `COMBOS` 의 선언 순서를 그대로 따른다(타로전용 → +사주 → +자미두수 → 둘 다). */
export const COMBO_KEYS = Object.keys(COMBOS) as ComboKey[];

/** 표 안에서 쓰는 짧은 스프레드 이름. `SPREADS[key].label`("원카드")과 달리 띄어쓰기가 있다 —
 *  뒤에 "+사주+자미두수"가 붙어 길어지는 자리라 이쪽이 읽기 편하다. */
const SPREAD_SHORT: Record<SpreadKey, string> = {
  one: "원 카드", three: "쓰리 카드", dual: "양자택일", celtic: "켈틱 크로스",
};

/**
 * 조합 하나의 "스프레드별 질문 가능 횟수" 카드.
 *
 * 같은 카드가 세 자리에 나온다 — /charge 의 구입 옵션 선택, /received-passes 의 수령 전
 * 옵션 선택, 그리고 수령 후 확인용. 셋이 각자 복사돼 있었고(2026-09-24 정리) 다른 건
 * **횟수를 어디서 가져오는지 한 줄뿐**이었다: 구입은 상품 금액으로 계산하고, 받은 이용권은
 * 지급 시점에 서버가 박아 둔 값을 그대로 보여준다. 그래서 그 한 줄만 함수로 받는다.
 *
 * `onSelect` 가 없으면 읽기 전용 카드가 된다(라디오 점 없이 제목만).
 */
export function ComboAllowanceCard({
  combo,
  allowanceFor,
  selected = false,
  onSelect,
}: {
  combo: ComboKey;
  allowanceFor: (combo: ComboKey, spread: SpreadKey) => number;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const inner = (
    <>
      <div className="mb-4 flex items-center justify-center gap-2">
        {/* 라디오 점과 폭을 맞춰 제목이 가운데 오게 하는 빈 칸. */}
        {onSelect && <span className="h-6 w-6 shrink-0" aria-hidden="true" />}
        <p className="flex-1 text-center text-sm font-semibold text-bold-text">{COMBOS[combo].label}</p>
        {onSelect && (
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${selected ? "bg-point" : "bg-chip-fill"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-white" : "bg-icon-muted"}`} />
          </span>
        )}
      </div>
      <div className="rounded-2xl bg-border p-3 text-xs">
        <div className="flex justify-between rounded bg-topbar px-2 py-1 font-semibold text-icon-muted"><span>옵션 이름</span><span>질문 가능 횟수</span></div>
        {SPREAD_ORDER.map((spread) => (
          <div key={spread} className="flex justify-between gap-2 px-2 py-1 text-icon-muted">
            <span>
              {SPREAD_SHORT[spread]}
              {COMBOS[combo].saju ? "+사주" : ""}
              {COMBOS[combo].ziwei ? "+자미두수" : ""}
            </span>
            <strong className="shrink-0 text-white">{allowanceFor(combo, spread)}회</strong>
          </div>
        ))}
      </div>
    </>
  );

  if (!onSelect) {
    return <div className="rounded-[28px] border border-border bg-topbar p-4">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-[28px] bg-topbar p-4 text-left ${
        selected ? "border-2 border-point" : "border border-border"
      }`}
    >
      {inner}
    </button>
  );
}

/** 조합 4종을 세로로 늘어놓고 하나를 고르게 한다. */
export function ComboAllowanceList({
  allowanceFor,
  selected,
  onSelect,
}: {
  allowanceFor: (combo: ComboKey, spread: SpreadKey) => number;
  selected: ComboKey | null;
  onSelect: (combo: ComboKey) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {COMBO_KEYS.map((combo) => (
        <ComboAllowanceCard
          key={combo}
          combo={combo}
          allowanceFor={allowanceFor}
          selected={selected === combo}
          onSelect={() => onSelect(combo)}
        />
      ))}
    </div>
  );
}
