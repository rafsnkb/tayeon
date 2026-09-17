export const SPREADS = {
  one: { label: "원카드", cardCount: 1, cost: 200 },
  three: { label: "쓰리카드", cardCount: 3, cost: 300 },
  dual: { label: "양자택일", cardCount: 5, cost: 400 },
  celtic: { label: "켈틱크로스", cardCount: 10, cost: 500 },
} as const;

export type SpreadKey = keyof typeof SPREADS;

export function isSpreadKey(value: unknown): value is SpreadKey {
  return typeof value === "string" && value in SPREADS;
}

// 친구 초대는 가입한 친구와 추천인 모두에게 원카드 기준 무료 이용권 5회를 준다.
// 추천 가능한 친구 수는 5명이며, 월간 결제 리워드에는 횟수 제한이 없다.
export const REFERRAL_SIGNUP_FREE_PASSES = 5;
export const REFERRAL_SIGNUP_FRIEND_CAP = 5;
export const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

// 첫 카카오 가입 보상은 스프레드/옵션 조합과 무관하게 정확히 4회를 쓸 수 있는 체험 이용권이다.
// 남은 권리를 옵션 변경에 따라 환산하는 유료 이용권과 달리, 모든 조합을 같은 4회로 고정한다.
export const SIGNUP_FREE_PASSES = 4;
export const SIGNUP_FREE_PASS_BASIS = SIGNUP_FREE_PASSES * SPREADS.one.cost;

export function signupFreePassAllowances(): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(SPREADS) as SpreadKey[]).flatMap((spread) =>
      [false, true].flatMap((saju) =>
        [false, true].map((ziwei) => [countKey(spread, saju, ziwei), SIGNUP_FREE_PASSES])
      )
    )
  );
}

// 보너스 리워드 — "내가" 이번 달에 결제한 코인ㆍ이용권 금액(VAT 제외)에 따라 다음달 5일에
// 원카드 기준 무료 이용권으로 페이백해주는 자체 캐시백(친구 결제 리워드와는 별개). asset/Screen/RewardInfoModal.png
// 기획표 그대로: 결제금액이 해당 구간(minWon) 이상이면 전체 금액에 그 구간 요율을 적용한다
// (누진세처럼 구간별로 쪼개 계산하지 않는 단일 구간 조회 — 내림차순으로 첫 매치).
export const PAYMENT_BONUS_REWARD_TIERS = [
  { minWon: 1_000_000, rate: 0.1 },
  { minWon: 800_000, rate: 0.07 },
  { minWon: 400_000, rate: 0.05 },
  { minWon: 200_000, rate: 0.04 },
  { minWon: 100_000, rate: 0.03 },
  { minWon: 50_000, rate: 0.015 },
  { minWon: 30_000, rate: 0.01 },
  { minWon: 0, rate: 0.005 },
] as const;

export function bonusRewardRateForWon(totalWon: number): number {
  const tier = PAYMENT_BONUS_REWARD_TIERS.find((t) => totalWon >= t.minWon);
  return tier?.rate ?? 0;
}

export function rewardPassesForWon(totalWon: number, rate: number): number {
  // 원카드 200원 상당을 1회로 환산하며, 표에 표시되는 횟수처럼 반올림으로 지급한다.
  return Math.round((totalWon * rate) / SPREADS.one.cost);
}

// 원카드(200) 기준 타로/타로+사주/타로+사주+자미두수 = 200/250/400 이었던
// 기존 기획 가격표에서 유도한 추가금. 자미두수는 사주 선택 시에만 추가 가능.
export const SAJU_ADD_ON_COST = 50;
export const ZIWEI_ADD_ON_COST = 150;

// 궁합은 횟수제 상품에 기본 포함. 기존 코인으로 이용하는 경우도 추가 차감하지 않는다.
export const COMPATIBILITY_ADD_ON_COST = 0;

// 코인 충전 상품. 1코인=1원 기준 + 대량 구매일수록 커지는 보너스 코인(사용자가 직접 확정).
// id는 결제 productId(src/lib/payment/products.ts)의 기반이 되는 고정 식별자 — 나중에 가격을
// 조정해도(가격 기준 productId였다면 결제 검증이 깨질 수 있었음, 2026-09-15 포트원 연동 검증에서
// 지적됨) 안 바뀌게 별도로 둠. 한번 정하면 리네이밍하지 말 것(기존 결제 기록과의 매핑이 끊김).
export const COIN_PACKAGES = [
  { id: "coin-1", priceWon: 1100, coins: 1100 },
  { id: "coin-2", priceWon: 3300, coins: 3500 },
  { id: "coin-3", priceWon: 5500, coins: 6000 },
  { id: "coin-4", priceWon: 12500, coins: 14000 },
  { id: "coin-5", priceWon: 35000, coins: 40000 },
  { id: "coin-6", priceWon: 55000, coins: 65000 },
  { id: "coin-7", priceWon: 99000, coins: 120000 },
] as const;

export const COUNT_PACKAGES = [
  { id: "count-starter", name: "스타터", priceWon: 3000, basis: 3000, bonus: "타연 체험에 추천" },
  { id: "count-basic", name: "베이직", priceWon: 5900, basis: 6200, bonus: "추가 횟수 +5% 포함" },
  { id: "count-standard", name: "스탠다드", priceWon: 12900, basis: 14000, bonus: "추가 횟수 +8.5% 포함" },
  { id: "count-plus", name: "플러스", priceWon: 35000, basis: 40000, bonus: "추가 횟수 +11% 포함" },
  { id: "count-premium", name: "프리미엄", priceWon: 55000, basis: 65000, bonus: "추가 횟수 +18% 포함" },
  { id: "count-ultimate", name: "얼티밋", priceWon: 110000, basis: 135000, bonus: "추가 횟수 +23% 포함" },
] as const;

export const COUNT_PASS_VALIDITY_MONTHS = 6;

export function countAllowance(
  basis: number,
  spread: SpreadKey,
  saju: boolean,
  ziwei: boolean,
  usePublishedException = true
): number {
  // 목업 표는 스타터 켈틱크로스+자미두수를 4회로 명시한다(일반 반올림은 5회).
  if (usePublishedException && basis === 3000 && spread === "celtic" && !saju && ziwei) return 4;
  const base = Math.round(basis / SPREADS[spread].cost);
  return Math.round(base * (saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1));
}

export function countKey(spread: SpreadKey, saju: boolean, ziwei: boolean): string {
  return `${spread}-${Number(saju)}-${Number(ziwei)}`;
}

export function countAllowances(basis: number, usePublishedException = true): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(SPREADS) as SpreadKey[]).flatMap((spread) =>
      [false, true].flatMap((saju) =>
        [false, true].map((ziwei) => [
          countKey(spread, saju, ziwei),
          countAllowance(basis, spread, saju, ziwei, usePublishedException),
        ])
      )
    )
  );
}

export type CountPassBalance = {
  basis: number;
  remaining: number;
  expiresAt?: string | null;
  allowances?: Record<string, number>;
  featureScope?: "tarot-only" | "all-features";
};

export function availableCount(
  pass: CountPassBalance,
  spread: SpreadKey,
  saju: boolean,
  ziwei: boolean,
  compatibility = false
): number {
  if (pass.remaining <= 0 || (pass.expiresAt && new Date(pass.expiresAt).getTime() <= Date.now())) return 0;
  if (pass.featureScope === "tarot-only" && (saju || ziwei || compatibility)) return 0;
  const allowance = pass.allowances?.[countKey(spread, saju, ziwei)] ?? countAllowance(pass.basis, spread, saju, ziwei);
  return Math.round(pass.remaining * allowance);
}

export function remainingAfterUse(pass: CountPassBalance, spread: SpreadKey, saju: boolean, ziwei: boolean): number {
  const allowance = pass.allowances?.[countKey(spread, saju, ziwei)] ?? countAllowance(pass.basis, spread, saju, ziwei);
  const next = Math.max(0, pass.remaining - 1 / allowance);
  const largestAllowance = Math.max(...Object.values(pass.allowances ?? countAllowances(pass.basis)));
  return Math.round(next * largestAllowance) > 0 ? next : 0;
}

// 시간제 무제한 상품(구매 시간 내 이용 무제한). 15분 티어는 타로만, 30/60분 티어는
// 사주/자미두수/궁합 옵션까지 전부 포함 — 사용자가 직접 확정한 가격/범위.
export const TIME_PASS_PACKAGES = [
  { id: "timepass-15", priceWon: 8900, minutes: 15, includesOptions: false },
  { id: "timepass-30", priceWon: 19900, minutes: 30, includesOptions: true },
  { id: "timepass-60", priceWon: 35900, minutes: 60, includesOptions: true },
] as const;
