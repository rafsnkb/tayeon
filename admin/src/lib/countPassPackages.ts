export type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";

export const COMBOS: Record<ComboKey, { saju: boolean; ziwei: boolean }> = {
  tarot: { saju: false, ziwei: false },
  "tarot-saju": { saju: true, ziwei: false },
  "tarot-ziwei": { saju: false, ziwei: true },
  "tarot-saju-ziwei": { saju: true, ziwei: true },
};

const SPREAD_COSTS = { one: 300, three: 450, dual: 600, celtic: 750 } as const;
export type SpreadKey = keyof typeof SPREAD_COSTS;

// 횟수제 이용권 6단계 가격표. src/lib/tarot/pricing.ts의 COUNT_PACKAGES와 동일한 기준 — admin은
// 본체와 완전히 분리된 별도 앱(별도 App Hosting backend)이라 값만 그대로 복제한다. 본체 값이
// 바뀌면 이 파일도 반드시 같이 고칠 것(id·priceWon·basis 전부 동일해야 함).
export const COUNT_PACKAGES = [
  { id: "count-starter", name: "스타터", priceWon: 3000, basis: 3000 },
  { id: "count-basic", name: "베이직", priceWon: 5900, basis: 6200 },
  { id: "count-standard", name: "스탠다드", priceWon: 12900, basis: 14000 },
  { id: "count-plus", name: "플러스", priceWon: 36000, basis: 40000 },
  { id: "count-premium", name: "프리미엄", priceWon: 55000, basis: 65000 },
  { id: "count-ultimate", name: "얼티밋", priceWon: 110000, basis: 135000 },
] as const satisfies readonly { id: string; name: string; priceWon: number; basis: number }[];

// 횟수제 이용권 유효기간(구매/지급일로부터). src/lib/tarot/pricing.ts의 COUNT_PASS_VALIDITY_MONTHS와 동일.
export const COUNT_PASS_VALIDITY_MONTHS = 12;

const SPREAD_ORDER = ["one", "three", "dual", "celtic"] as const satisfies readonly SpreadKey[];

// src/lib/tarot/pricing.ts의 PUBLISHED_COUNT_TABLE 복제본(2026-09-24 확정 가격표). admin 지급이
// 실제 구매와 정확히 같은 횟수를 보장해야 하므로 표를 통째로 복제한다 — 본체가 바뀌면 여기도
// 같이 고칠 것. 칸 순서: 타로 / +사주 / +자미두수 / +사주+자미두수, 각 묶음 안은
// 원카드·쓰리카드·양자택일·켈틱크로스.
const PUBLISHED_COUNT_TABLE: Record<number, readonly number[]> = {
  3_000:   [ 10,   7,   5,   4,    9,   6,   4,   3,    8,   5,   3,   2,    5,   4,   2,   1],
  6_200:   [ 21,  14,  10,   8,   18,  12,   9,   7,   16,  11,   8,   6,   11,   7,   5,   4],
  14_000:  [ 47,  31,  23,  19,   40,  26,  20,  16,   35,  23,  17,  14,   24,  16,  12,  10],
  40_000:  [133,  89,  67,  53,  113,  76,  57,  45,  100,  67,  50,  40,   67,  45,  34,  27],
  65_000:  [217, 144, 108,  87,  184, 122,  92,  74,  163, 108,  81,  65,  109,  72,  54,  44],
  135_000: [450, 300, 225, 180,  383, 255, 191, 153,  338, 225, 169, 135,  225, 150, 113,  90],
};

function allowance(basis: number, spread: SpreadKey, saju: boolean, ziwei: boolean): number {
  const row = PUBLISHED_COUNT_TABLE[basis];
  if (row) {
    const comboIndex = saju && ziwei ? 3 : saju ? 1 : ziwei ? 2 : 0;
    return row[comboIndex * SPREAD_ORDER.length + SPREAD_ORDER.indexOf(spread)];
  }
  const base = Math.round(basis / SPREAD_COSTS[spread]);
  return Math.round(base * (saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1));
}

export function countAllowancesForCombo(basis: number, combo: ComboKey): Record<SpreadKey, number> {
  const { saju, ziwei } = COMBOS[combo];
  return Object.fromEntries(
    (Object.keys(SPREAD_COSTS) as SpreadKey[]).map((spread) => [spread, allowance(basis, spread, saju, ziwei)])
  ) as Record<SpreadKey, number>;
}

/** 원카드 1회 단가. src/lib/tarot/pricing.ts의 SPREADS.one.cost와 같은 값. */
export const ONE_CARD_COST = SPREAD_COSTS.one;

/** 조합별 원카드 환산 횟수 — 운영자가 지급한 횟수를 화면에 그대로 표기할 때 쓴다. */
export function oneCardCountFor(basis: number, combo: ComboKey): number {
  const { saju, ziwei } = COMBOS[combo];
  return allowance(basis, "one", saju, ziwei);
}

/** src/lib/tarot/pricing.ts의 basisForOneCardCount 복제본 — 본체가 바뀌면 같이 고칠 것.
 *
 *  "이 조합으로 정확히 N회"를 약속했을 때 실제로 N회가 나오는 basis 를 되돌려 준다. 그냥
 *  `N × ONE_CARD_COST` 로 잡으면 allowance 가 조합 배율을 한 번 더 곱해서(타로+사주면 ×0.85)
 *  약속보다 적게 나간다. 반올림 때문에 역산 공식 한 방으로는 어긋나는 값이 있어 후보를 옆으로
 *  훑는다. */
export function basisForOneCardCount(freePasses: number, combo: ComboKey): number {
  const target = Math.round(freePasses);
  if (!Number.isFinite(target) || target <= 0) return 0;
  const { saju, ziwei } = COMBOS[combo];
  const mult = saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1;
  const start = Math.max(1, Math.round(target / mult));
  for (let delta = 0; delta <= 4; delta++) {
    for (const base of delta === 0 ? [start] : [start - delta, start + delta]) {
      if (base < 1) continue;
      const basis = base * ONE_CARD_COST;
      if (oneCardCountFor(basis, combo) === target) return basis;
    }
  }
  return start * ONE_CARD_COST;
}
