export type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";

export const COMBOS: Record<ComboKey, { saju: boolean; ziwei: boolean }> = {
  tarot: { saju: false, ziwei: false },
  "tarot-saju": { saju: true, ziwei: false },
  "tarot-ziwei": { saju: false, ziwei: true },
  "tarot-saju-ziwei": { saju: true, ziwei: true },
};

const SPREAD_COSTS = { one: 200, three: 300, dual: 400, celtic: 500 } as const;
export type SpreadKey = keyof typeof SPREAD_COSTS;

// 횟수제 이용권 6단계 가격표. src/lib/tarot/pricing.ts의 COUNT_PACKAGES와 동일한 기준 — admin은
// 본체와 완전히 분리된 별도 앱(별도 App Hosting backend)이라 값만 그대로 복제한다. 본체 값이
// 바뀌면 이 파일도 반드시 같이 고칠 것(id·priceWon·basis 전부 동일해야 함).
export const COUNT_PACKAGES = [
  { id: "count-starter", name: "스타터", priceWon: 3000, basis: 3000 },
  { id: "count-basic", name: "베이직", priceWon: 5900, basis: 6200 },
  { id: "count-standard", name: "스탠다드", priceWon: 12900, basis: 14000 },
  { id: "count-plus", name: "플러스", priceWon: 35000, basis: 40000 },
  { id: "count-premium", name: "프리미엄", priceWon: 55000, basis: 65000 },
  { id: "count-ultimate", name: "얼티밋", priceWon: 110000, basis: 135000 },
] as const satisfies readonly { id: string; name: string; priceWon: number; basis: number }[];

// 횟수제 이용권 유효기간(구매/지급일로부터). src/lib/tarot/pricing.ts의 COUNT_PASS_VALIDITY_MONTHS와 동일.
export const COUNT_PASS_VALIDITY_MONTHS = 12;

// src/lib/tarot/pricing.ts의 countAllowance()와 동일한 계산식 — 스타터(basis 3000) + 켈틱크로스 +
// 자미두수 단독 조합은 일반 반올림(5회) 대신 목업 표대로 4회로 고정하는 예외가 있다. admin 지급이
// 실제 구매와 정확히 같은 횟수를 보장해야 하므로 이 예외까지 그대로 복제한다.
function allowance(basis: number, spread: SpreadKey, saju: boolean, ziwei: boolean): number {
  if (basis === 3000 && spread === "celtic" && !saju && ziwei) return 4;
  const base = Math.round(basis / SPREAD_COSTS[spread]);
  return Math.round(base * (saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1));
}

export function countAllowancesForCombo(basis: number, combo: ComboKey): Record<SpreadKey, number> {
  const { saju, ziwei } = COMBOS[combo];
  return Object.fromEntries(
    (Object.keys(SPREAD_COSTS) as SpreadKey[]).map((spread) => [spread, allowance(basis, spread, saju, ziwei)])
  ) as Record<SpreadKey, number>;
}
