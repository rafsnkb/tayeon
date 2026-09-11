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
