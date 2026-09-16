export const SPREADS = {
  one: { label: "원카드", cardCount: 1, cost: 200 },
  three: { label: "쓰리카드", cardCount: 3, cost: 250 },
  dual: { label: "양자택일", cardCount: 5, cost: 300 },
  celtic: { label: "켈틱크로스", cardCount: 10, cost: 400 },
} as const;

export type SpreadKey = keyof typeof SPREADS;

export function isSpreadKey(value: unknown): value is SpreadKey {
  return typeof value === "string" && value in SPREADS;
}

export const FREE_SIGNUP_COINS = 500;

// 친구 초대(리퍼럴) 보상 — asset/Screen/friendInvite.png 기획대로: 초대 링크로 가입할 때마다
// 100코인, 1인당 누적 최대 500코인(가입 보상 한정, 아래 월간 정산 보너스는 별도 한도 없음).
export const REFERRAL_SIGNUP_REWARD_COINS = 100;
export const REFERRAL_SIGNUP_REWARD_CAP = 500;
// 내가 초대한 친구가 결제할 때마다, 결제 비용(VAT 제외)의 5%를 매월 코인으로 정산 지급.
export const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

// 보너스 리워드 — "내가" 이번 달에 결제한 코인ㆍ이용권 금액(VAT 제외)에 따라 다음달 5일에
// 코인으로 페이백해주는 자체 캐시백(친구 결제 리워드와는 별개). asset/Screen/RewardInfoModal.png
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

// 리워드로 지급되는 코인은 항상 10의 배수여야 자연스럽다(타연엔 1자리 단위로 소모되는 컨텐츠가
// 없음) — 유저에게 지급되는 금액이니 반올림 대신 항상 올림으로 처리해서 애매하게 깎이지 않게 한다.
export function ceilToTens(n: number): number {
  return Math.ceil(n / 10) * 10;
}

// 원카드(200) 기준 타로/타로+사주/타로+사주+자미두수 = 200/250/400 이었던
// 기존 기획 가격표에서 유도한 추가금. 자미두수는 사주 선택 시에만 추가 가능.
export const SAJU_ADD_ON_COST = 50;
export const ZIWEI_ADD_ON_COST = 150;

// 궁합(상대 정보 반영) 추가금. 자미두수처럼 사주와 무관하게 독립적으로 선택 가능.
// 기존 기획 문서 가격표(타로+사주+궁합=300)에서 유도한 사주 addon(50)과 동일선상에 있었으나,
// 상대 1인분 데이터까지 추가로 고려하는 부담을 감안해 자미두수(150)보다는 낮고 사주(50)보다는
// 높은 값으로 잡음 — 확정된 가격표는 아니므로 필요 시 조정할 것.
export const COMPATIBILITY_ADD_ON_COST = 100;

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
  { id: "coin-7", priceWon: 110000, coins: 135000 },
] as const;

// 시간제 무제한 상품(구매 시간 내 이용 무제한). 15분 티어는 타로만, 30/60분 티어는
// 사주/자미두수/궁합 옵션까지 전부 포함 — 사용자가 직접 확정한 가격/범위.
export const TIME_PASS_PACKAGES = [
  { id: "timepass-15", priceWon: 8900, minutes: 15, includesOptions: false },
  { id: "timepass-30", priceWon: 19900, minutes: 30, includesOptions: true },
  { id: "timepass-60", priceWon: 35900, minutes: 60, includesOptions: true },
] as const;
