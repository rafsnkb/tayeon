// cost 는 "금액 ↔ 횟수" 환산 단가다(코인 차감가가 아니다 — 코인 경로는 리딩 API 안에 따로
// 박혀 있다). 2026-09-24 사용자 가격표 개정으로 네 스프레드 모두 1.5배: 200/300/400/500 →
// 300/450/600/750. 같은 금액으로 살 수 있는 횟수가 그만큼 줄어든다.
export const SPREADS = {
  one: { label: "원카드", cardCount: 1, cost: 300 },
  three: { label: "쓰리카드", cardCount: 3, cost: 450 },
  dual: { label: "양자택일", cardCount: 5, cost: 600 },
  celtic: { label: "켈틱크로스", cardCount: 10, cost: 750 },
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

/** 바깥(요청 본문 등)에서 들어온 값이 조합 키인지 확인한다. 결제 준비·이용권 지급·리워드
 *  수령 세 군데에 똑같은 함수가 각자 복사돼 있었다(2026-09-24 정리). */
export function isComboKey(value: unknown): value is ComboKey {
  return typeof value === "string" && value in COMBOS;
}

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
  // 원카드 1회 단가(SPREADS.one.cost) 상당을 1회로 환산하며, 표에 표시되는 횟수처럼 반올림으로
  // 지급한다. 2026-09-24 단가가 200→300으로 오르면서 같은 금액에 대한 페이백 회수도 그만큼
  // 줄어든다 — 요율(%)이 아니라 금액 기준 페이백이므로 이게 일관된 동작이다.
  return Math.round((totalWon * rate) / SPREADS.one.cost);
}

// 코인 경로(이용권 없이 리딩할 때)의 옵션 추가금. 원카드(200) 기준 타로/타로+사주/
// 타로+사주+자미두수 = 200/250/400 이었던 기존 기획 가격표에서 유도한 값이라, 위 SPREADS.cost
// 개정(2026-09-24)과 무관하게 코인 가격표 그대로 둔다 — 코인 차감 단가는 리딩 API 안에 따로
// 박혀 있다(src/app/api/tarot/reading/route.ts의 { one: 200, three: 250, ... }).
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
  // 36,000원. 예전엔 35,000원이었는데 basis 40,000 대비 +14%라 옆의 "+11%" 표기와 어긋나 있었다
  // — 2026-09-24 가격표가 36,000원으로 확정되면서 표기와 맞아떨어진다(40000/36000 = 1.111).
  { id: "count-plus", name: "플러스", priceWon: 36000, basis: 40000, bonus: "추가 횟수 +11% 포함" },
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

/** 안내 문구가 위 상수를 그대로 반영하도록, 개월 수를 사람이 읽는 표현으로 바꾼다.
 *  12의 배수는 "1년"처럼 연 단위로 읽는 게 자연스러워서 나눠 쓴다. */
export function formatMonths(months: number): string {
  return months % 12 === 0 ? `${months / 12}년` : `${months}개월`;
}

/** 스프레드를 늘어놓는 순서. 아래 공표 가격표(PUBLISHED_COUNT_TABLE)의 열 순서이자,
 *  화면에서 횟수 표를 그리는 순서다 — 두 곳이 어긋나면 표를 잘못 읽게 되므로 한 곳에 둔다. */
export const SPREAD_ORDER = ["one", "three", "dual", "celtic"] as const satisfies readonly SpreadKey[];

/** 공표 가격표(2026-09-24 사용자 확정본)의 확정 회차. basis → 16칸.
 *
 *  칸 순서는 사용자 표와 같다 — 조합 4묶음(타로 / +사주 / +자미두수 / +사주+자미두수)이고,
 *  각 묶음 안은 원카드·쓰리카드·양자택일·켈틱크로스 순이다.
 *
 *  **표가 진실의 원천이다.** 아래 formula(단가로 나눈 뒤 조합 배율)는 96칸 중 92칸을 그대로
 *  재현하지만, 스타터의 자미두수 쪽 4칸(양자·켈틱 × 자미두수, 사주+자미두수)은 계산값보다
 *  1회씩 낮게 확정돼 있다 — 가장 싼 상품이 비싼 조합에서 유리해지지 않도록 손으로 깎은 값이다.
 *  예전엔 이런 칸을 `if` 예외 하나로 붙여뒀는데, 개정 때마다 예외가 늘어날 자리라 표를 통째로
 *  데이터로 두고 계산식은 표에 없는 basis(리워드·관리자 지급 등) 전용 폴백으로 남긴다. */
const PUBLISHED_COUNT_TABLE: Record<number, readonly number[]> = {
  //          타로                +사주               +자미두수           +사주+자미두수
  3_000:   [ 10,   7,   5,   4,    9,   6,   4,   3,    8,   5,   3,   2,    5,   4,   2,   1],
  6_200:   [ 21,  14,  10,   8,   18,  12,   9,   7,   16,  11,   8,   6,   11,   7,   5,   4],
  14_000:  [ 47,  31,  23,  19,   40,  26,  20,  16,   35,  23,  17,  14,   24,  16,  12,  10],
  40_000:  [133,  89,  67,  53,  113,  76,  57,  45,  100,  67,  50,  40,   67,  45,  34,  27],
  65_000:  [217, 144, 108,  87,  184, 122,  92,  74,  163, 108,  81,  65,  109,  72,  54,  44],
  135_000: [450, 300, 225, 180,  383, 255, 191, 153,  338, 225, 169, 135,  225, 150, 113,  90],
};

/** usePublishedTable=false 는 "구매 상품과 같은 basis 를 우연히 갖게 된 무료 리워드"가 공표표의
 *  손질된 값을 물려받지 않게 하려고 남겨둔 통로다(기존 usePublishedException 과 같은 목적). */
export function countAllowance(
  basis: number,
  spread: SpreadKey,
  saju: boolean,
  ziwei: boolean,
  usePublishedTable = true
): number {
  if (usePublishedTable) {
    const row = PUBLISHED_COUNT_TABLE[basis];
    if (row) {
      const comboIndex = saju && ziwei ? 3 : saju ? 1 : ziwei ? 2 : 0;
      return row[comboIndex * SPREAD_ORDER.length + SPREAD_ORDER.indexOf(spread)];
    }
  }
  const base = Math.round(basis / SPREADS[spread].cost);
  return Math.round(base * (saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1));
}

export function countKey(spread: SpreadKey, saju: boolean, ziwei: boolean): string {
  return `${spread}-${Number(saju)}-${Number(ziwei)}`;
}

// combo:"any"(가입 무료체험 전용) 이용권을 위한 16-엔트리(스프레드4 × 사주2 × 자미두수2) 표.
export function countAllowances(basis: number, usePublishedTable = true): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(SPREADS) as SpreadKey[]).flatMap((spread) =>
      [false, true].flatMap((saju) =>
        [false, true].map((ziwei) => [
          countKey(spread, saju, ziwei),
          countAllowance(basis, spread, saju, ziwei, usePublishedTable),
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

export type CountPassStatus = "unused" | "active" | "exhausted" | "expired" | "refunded" | "revoked";

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
  // 허용 상태만 열거(거부 목록이 아니라 허용 목록) — 환불/회수 등 새 종료 상태가 추가돼도
  // 기본값이 "사용 불가"가 되도록 한다(2026-09-20, refunded 상태가 이 체크를 통과해 계속
  // 사용 가능했던 문제를 고치면서 함께 굳힘).
  if (pass.status !== "unused" && pass.status !== "active") return 0;
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
