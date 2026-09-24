"use client";

import { COMBOS, COMBO_ORDER, SPREAD_ORDER, type ComboKey, type SpreadKey } from "@/lib/tarot/pricing";

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
        <p className="flex-1 text-center text-sm font-semibold text-chip-soft-text">{COMBOS[combo].label}</p>
        {/* 목업(MyPass_Send) 실측: 바깥 원 24px / 테두리 2px, 안쪽 점 16px — **둘 다 핑크**이고
            미선택은 **속이 빈 원**이다. 한동안 미선택을 회색으로 채워 놨었는데, 그러면 선택·미선택이
            둘 다 "채워진 원"이라 라이트에서 미선택이 선택된 것처럼 읽혔다(2026-09-25). */}
        {onSelect && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-point">
            {selected && <span className="h-4 w-4 rounded-full bg-point" />}
          </span>
        )}
      </div>
      {/* 색과 반지름은 목업(MyPass_Send, 2026-09-24)을 sharp 로 픽셀 샘플해서 맞췄다 —
          박스는 --chip-soft, 그 안의 헤더 줄만 한 톤 더 눌린 면(라이트 --bg / 다크 --topbar),
          글자는 --placeholder. 반지름은 1236px 목업에서 박스 34px ≈ 화면 11px 이라 rounded-xl
          (16px 였던 rounded-2xl 은 바깥 카드(28px)와 어긋나 보였다). */}
      <div className="rounded-xl bg-chip-soft p-3 text-sm">
        {/* 헤더는 목업에서 본문 행과 **같은 크기**다. text-xs 로 줄이면 표가 한 단계 작아 보인다. */}
        <div className="flex justify-between gap-2 rounded bg-bg px-2 py-1 text-base font-semibold text-placeholder dark:bg-topbar"><span>옵션 이름</span><span className="shrink-0">질문 가능 횟수</span></div>
        {SPREAD_ORDER.map((spread) => (
          <div key={spread} className="flex justify-between gap-2 px-2 py-1 text-placeholder">
            <span>
              {SPREAD_SHORT[spread]}
              {COMBOS[combo].saju ? "+사주" : ""}
              {COMBOS[combo].ziwei ? "+자미두수" : ""}
            </span>
            {/* 예전엔 text-white 였다. 다크에서만 확인하고 넣은 색이라 라이트 모드에서는
                밝은 박스 위 흰 글자가 되어 횟수가 보이지 않았다(2026-09-24). */}
            <strong className="shrink-0 text-chip-soft-text">{allowanceFor(combo, spread)}회</strong>
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
      {COMBO_ORDER.map((combo) => (
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
