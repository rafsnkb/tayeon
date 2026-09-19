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

// 횟수제 이용권 조합 — 구매/수령 시점에 넷 중 하나로 완전히 고정된다(2026-09-18 개편).
// 궁합은 넷 모두에 기본 포함(별도 조합 차원 아님, COMPATIBILITY_ADD_ON_COST=0으로 이미 반영).
export type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";

export const COMBOS: Record<ComboKey, { saju: boolean; ziwei: boolean; label: string }> = {
  tarot: { saju: false, ziwei: false, label: "타로 전용" },
  "tarot-saju": { saju: true, ziwei: false, label: "타로+사주" },
  "tarot-ziwei": { saju: false, ziwei: true, label: "타로+자미두수" },
  "tarot-saju-ziwei": { saju: true, ziwei: true, label: "타로+사주+자미두수" },
};

export function comboKeyFor(saju: boolean, ziwei: boolean): ComboKey {
  return saju && ziwei ? "tarot-saju-ziwei" : saju ? "tarot-saju" : ziwei ? "tarot-ziwei" : "tarot";
}

// 친구 초대는 가입한 친구와 추천인 모두에게 원카드 기준 무료 이용권 5회를 준다.
// 추천 가능한 친구 수는 5명이며, 월간 결제 리워드에는 횟수 제한이 없다.
export const REFERRAL_SIGNUP_FREE_PASSES = 5;
export const REFERRAL_SIGNUP_FRIEND_CAP = 5;
export const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

// 첫 카카오 가입 보상은 스프레드/옵션 조합과 무관하게 정확히 4회를 쓸 수 있는 체험 이용권이다.
// 남은 권리를 옵션 변경에 따라 환산하는 유료 이용권과 달리, 모든 조합을 같은 4회로 고정한다.
// 유일하게 combo:"any"(조합 고정 없음)로 발급되는 이용권 — 온보딩 특성상 아직 조합을 골라본 적
// 없는 신규 유저가 뭐든 시험해볼 수 있어야 하므로 기존 16-엔트리 방식을 그대로 유지한다.
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
// 2026-09-18: 하위 2단계(1%/0.5%) 제거 — 5만원 미만 결제는 리워드 미지급으로 정리.
export const PAYMENT_BONUS_REWARD_TIERS = [
  { minWon: 1_000_000, rate: 0.1 },
  { minWon: 800_000, rate: 0.07 },
  { minWon: 400_000, rate: 0.05 },
  { minWon: 200_000, rate: 0.04 },
  { minWon: 100_000, rate: 0.03 },
  { minWon: 50_000, rate: 0.015 },
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

// 이용권 표시명 — src/app/(app)/tarot/page.tsx(채팅 하단 상태줄)와 src/app/(app)/me/page.tsx
// (마이페이지 "보유 이용권" 행)가 공용으로 쓴다(2026-09-18, 기존엔 두 파일에 각자 살짝 다른
// 문구로 중복 구현돼 있었음 — signup-free만 "무료 체험 이용권"/"첫 가입 체험 이용권"으로 갈렸던 것을
// 통일).
export function countPassDisplayName(pass: { productId?: string; source?: string }): string {
  const purchased = COUNT_PACKAGES.find((pkg) => pkg.id === pass.productId);
  if (purchased) return `${purchased.name} 이용권`;
  if (pass.source === "signup-free") return "첫 가입 체험 이용권";
  if (pass.source === "referral-signup") return "친구 초대 이용권";
  if (pass.source === "bonus-reward") return "보너스 리워드 이용권";
  if (pass.source === "referral-payout") return "친구 결제 리워드 이용권";
  if (pass.source === "admin-grant") return "관리자 지급 이용권";
  return "이용권";
}

export const COUNT_PASS_VALIDITY_MONTHS = 12;
export const TIME_PASS_VALIDITY_MONTHS = 12;

// 받은 이용권(결제 리워드/친구초대 리워드)의 수령 가능 기간 — 지급일로부터 이 기간 내 미수령 시 소멸.
export const PENDING_REWARD_CLAIM_WINDOW_MONTHS = 1;

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

// combo:"any"(가입 무료체험 전용) 이용권을 위한 16-엔트리(스프레드4 × 사주2 × 자미두수2) 표.
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

export function countAllowanceForCombo(basis: number, spread: SpreadKey, combo: ComboKey): number {
  const { saju, ziwei } = COMBOS[combo];
  return countAllowance(basis, spread, saju, ziwei);
}

// 조합이 고정된 이용권을 위한 4-엔트리(스프레드만) 표 — 스프레드 키로 바로 조회한다.
export function countAllowancesForCombo(basis: number, combo: ComboKey): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(SPREADS) as SpreadKey[]).map((spread) => [spread, countAllowanceForCombo(basis, spread, combo)])
  );
}

export type CountPassStatus = "unused" | "active" | "exhausted" | "expired";

export type CountPassBalance = {
  basis: number;
  remaining: number;
  expiresAt?: string | null;
  combo: ComboKey | "any"; // "any"는 source:"signup-free" 전용
  allowances: Record<string, number>; // combo 고정: SpreadKey로 조회. combo:"any": countKey(spread,saju,ziwei)로 조회.
  status: CountPassStatus;
};

export function availableCount(
  pass: CountPassBalance,
  spread: SpreadKey,
  saju: boolean,
  ziwei: boolean
): number {
  if (pass.remaining <= 0 || (pass.expiresAt && new Date(pass.expiresAt).getTime() <= Date.now())) return 0;
  if (pass.status === "exhausted" || pass.status === "expired") return 0;
  if (pass.combo === "any") {
    const allowance = pass.allowances[countKey(spread, saju, ziwei)] ?? countAllowance(pass.basis, spread, saju, ziwei);
    return Math.round(pass.remaining * allowance);
  }
  const { saju: comboSaju, ziwei: comboZiwei } = COMBOS[pass.combo];
  if (saju !== comboSaju || ziwei !== comboZiwei) return 0;
  const allowance = pass.allowances[spread] ?? countAllowanceForCombo(pass.basis, spread, pass.combo);
  return Math.round(pass.remaining * allowance);
}

export function remainingAfterUse(pass: CountPassBalance, spread: SpreadKey, saju: boolean, ziwei: boolean): number {
  const allowance =
    pass.combo === "any"
      ? pass.allowances[countKey(spread, saju, ziwei)] ?? countAllowance(pass.basis, spread, saju, ziwei)
      : pass.allowances[spread] ?? countAllowanceForCombo(pass.basis, spread, pass.combo);
  const next = Math.max(0, pass.remaining - 1 / allowance);
  const largestAllowance = Math.max(...Object.values(pass.allowances));
  return Math.round(next * largestAllowance) > 0 ? next : 0;
}

// 시간제 무제한 상품(구매 시간 내 이용 무제한). 조합 4종 × 시간 3종 = 12개 SKU.
// admin/은 본체와 완전히 분리된 별도 앱(별도 App Hosting backend, Turbopack 빌드 루트도
// admin/ 하나로 고정돼 있어 리포 루트를 걸치는 공유 모듈을 쓸 수 없음)이라, 이 값을 그대로
// admin/src/lib/timePassPackages.ts에 복제해서 유지한다 — 이 배열을 바꾸면 그 파일도 반드시
// 같이 고칠 것(id·priceWon·minutes·combo 전부 동일해야 함).
export const TIME_PASS_PACKAGES = [
  { id: "timepass-tarot-15", combo: "tarot", priceWon: 8900, minutes: 15 },
  { id: "timepass-tarot-30", combo: "tarot", priceWon: 12900, minutes: 30 },
  { id: "timepass-tarot-60", combo: "tarot", priceWon: 19900, minutes: 60 },
  { id: "timepass-saju-15", combo: "tarot-saju", priceWon: 12900, minutes: 15 },
  { id: "timepass-saju-30", combo: "tarot-saju", priceWon: 19900, minutes: 30 },
  { id: "timepass-saju-60", combo: "tarot-saju", priceWon: 24900, minutes: 60 },
  { id: "timepass-ziwei-15", combo: "tarot-ziwei", priceWon: 19900, minutes: 15 },
  { id: "timepass-ziwei-30", combo: "tarot-ziwei", priceWon: 24900, minutes: 30 },
  { id: "timepass-ziwei-60", combo: "tarot-ziwei", priceWon: 39900, minutes: 60 },
  { id: "timepass-all-15", combo: "tarot-saju-ziwei", priceWon: 24900, minutes: 15 },
  { id: "timepass-all-30", combo: "tarot-saju-ziwei", priceWon: 39900, minutes: 30 },
  { id: "timepass-all-60", combo: "tarot-saju-ziwei", priceWon: 65900, minutes: 60 },
] as const satisfies readonly { id: string; combo: ComboKey; priceWon: number; minutes: number }[];
