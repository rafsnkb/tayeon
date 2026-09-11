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
export const COIN_PACKAGES = [
  { priceWon: 1100, coins: 1100 },
  { priceWon: 3300, coins: 3500 },
  { priceWon: 5500, coins: 6000 },
  { priceWon: 12500, coins: 14000 },
  { priceWon: 35000, coins: 40000 },
  { priceWon: 55000, coins: 65000 },
  { priceWon: 110000, coins: 135000 },
] as const;

// 시간제 무제한 상품(구매 시간 내 이용 무제한). 15분 티어는 타로만, 30/60분 티어는
// 사주/자미두수/궁합 옵션까지 전부 포함 — 사용자가 직접 확정한 가격/범위.
// ⚠️ 이 상수는 상품 표시용일 뿐, "무제한 세션"을 실제로 판정/적용하는 백엔드 로직은
// 아직 없음 (지금 코인 차감 로직은 이 상품 구매를 전혀 모름) — 별도 구현 필요.
export const TIME_PASS_PACKAGES = [
  { priceWon: 8900, minutes: 15, includesOptions: false },
  { priceWon: 19900, minutes: 30, includesOptions: true },
  { priceWon: 35900, minutes: 60, includesOptions: true },
] as const;
