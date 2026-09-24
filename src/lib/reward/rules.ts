// ─────────────────────────────────────────────────────────────────────────────
// 무상 지급(리워드) 규칙의 **단일 출처**.
//
// 이 파일은 `functions/src/shared/rewardRules.ts` 로 **글자 하나까지 그대로 복사**된다.
// Cloud Functions 는 별도 npm 패키지(별도 배포 단위)라 `@/lib/...` 를 import 할 수 없어서,
// 예전에는 같은 상수가 두 파일에 손으로 복사돼 있었다 — 앱만 고치고 Functions 를 빠뜨리면
// 광고 문구와 실제 지급이 어긋나고, 그걸 잡아 주는 테스트도 없었다(2026-09-24 인계 메모 3번).
//
// 이제 사본은 `npm run sync:reward-rules` 가 만들고, 두 파일이 어긋나면
// `src/lib/reward/rules.sync.test.mjs` 가 `npm test` 에서 실패한다.
//
// ⚠️ 그러니 **여기만** 고치고 스크립트를 돌릴 것. 사본을 직접 고치면 다음 동기화에 덮어쓰인다.
// ⚠️ import 를 추가하지 말 것 — 사본이 그 경로를 따라갈 수 없다. 이 파일은 자립형이어야 한다.
// ─────────────────────────────────────────────────────────────────────────────

/** 원카드 1회 단가. 금액 ↔ 횟수 환산의 기준이며 `SPREADS.one.cost` 가 이 값을 쓴다.
 *  2026-09-24 가격표 개정으로 200 → 300. */
export const ONE_CARD_BASIS = 300;

/** 친구 초대(리퍼럴) 월간 정산 요율. */
export const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

/** 친구 결제 리워드 최소 기준 — 추천인의 친구들이 그 달에 합쳐서 이 금액(공급가액) 이상
 *  결제해야 지급한다. 미달이면 그 달은 지급하지 않는다(다음 달로 이월되지 않는다).
 *  보너스 리워드의 최저 구간과 같은 금액으로 맞춘다 — 두 리워드의 진입선이 다르면 안내가
 *  두 배로 복잡해진다(2026-09-24). */
export const REFERRAL_MONTHLY_MIN_WON = 100_000;

/** 보너스 리워드 — "내가" 그 달에 결제한 금액(VAT 제외)에 따라 다음달
 *  REWARD_PAYOUT_DAY_OF_MONTH 일에 원카드 기준 무료 이용권으로 돌려주는 자체 캐시백.
 *  기획표 그대로 **단일 구간 조회**다: 해당 구간(minWon) 이상이면 전체 금액에 그 요율을
 *  적용한다(누진세처럼 구간별로 쪼개지 않는다 — 내림차순으로 첫 매치).
 *
 *  2026-09-18 하위 2단계(1%/0.5%) 제거, 2026-09-24 5만원/1.5% 구간도 제거해 진입선을
 *  10만원으로 올렸다. 금액이 작을수록 횟수 환산에서 남는 자투리 비중이 커져 리워드가 제
 *  가치보다 후해지는데, 그 구간이 딱 거기였다. */
export const PAYMENT_BONUS_REWARD_TIERS = [
  { minWon: 1_000_000, rate: 0.1 },
  { minWon: 800_000, rate: 0.07 },
  { minWon: 400_000, rate: 0.05 },
  { minWon: 200_000, rate: 0.04 },
  { minWon: 100_000, rate: 0.03 },
] as const;

/** 월간 리워드(친구 결제 5% + 본인 결제 캐시백) 지급일. functions 의
 *  monthlyReferralPayout·monthlyBonusRewardPayout 크론(`0 3 10 * *`)과 같은 날이어야 한다.
 *
 *  5일이 아니라 10일인 이유: 정산은 아직 환불되지 않은(status=="fulfilled") 결제만 세는데,
 *  환불 가능 기간이 결제 후 REFUND_WINDOW_DAYS(7)일이라 5일에 정산하면 "말일 결제 → 5일 리워드
 *  수령 → 6일 환불"로 공짜 이용권을 만들 수 있었다(2026-09-24). 이 값을 앞당기려면 그 계산부터
 *  다시 할 것. */
export const REWARD_PAYOUT_DAY_OF_MONTH = 10;

/** 받은 이용권(결제 리워드/친구초대 리워드/생일 쿠폰)의 수령 가능 기간 — 지급일로부터 이 기간
 *  내 미수령 시 소멸. */
export const PENDING_REWARD_CLAIM_WINDOW_MONTHS = 1;

/**
 * 결제 총액(VAT 포함)에서 공급가액을 뽑는다 — **리워드 계산의 입력은 항상 이 값이다.**
 *
 * 상품 가격표(`COUNT_PACKAGES.priceWon`)와 결제 기록은 전부 VAT 포함 표시가다(구매 화면이
 * "상품금액 (VAT 포함)"으로 보여주는 그 값). 그걸 그대로 요율에 넣으면 사용자가 낸 세금까지
 * 리워드로 돌려주는 셈이 된다 — 그 돈은 우리 몫이 아니라 국고로 가므로 환급해 줄 이유가 없다
 * (2026-09-24 사용자 결정. 안내 문구는 처음부터 "VAT 제외"라고 쓰고 있었는데 계산만 총액이었다).
 *
 * 요율 구간 판정에도 같이 쓰인다. 즉 "10만원 이상" 구간에 들려면 공급가액이 10만원이어야 하고,
 * 총액으로는 110,000원을 결제해야 한다.
 *
 * **1.1 로 나누지 않는다.** `110000 / 1.1` 은 이진 부동소수점에서 99999.99999999999 로 떨어져서
 * 버림과 만나면 99,999원이 된다 — 딱 10만원어치를 결제한 사람이 구간에 못 들고, 110만원 결제가
 * 10% 가 아니라 7% 가 됐다. `× 10 / 11` 은 정수 분자로 한 번만 나눠서 11의 배수를 정확히 떨어뜨린다.
 */
export function supplyWon(grossWon: number): number {
  if (!Number.isFinite(grossWon) || grossWon <= 0) return 0;
  // 버림 — 올려서 구간 경계를 넘겨주지 않는다(rewardPassesForWon 과 같은 방향).
  return Math.floor((grossWon * 10) / 11);
}

/** 공급가액에 걸리는 보너스 리워드 요율. 입력은 총액이 아니라 `supplyWon()` 을 거친 값이다. */
export function bonusRewardRateForWon(supplyWonAmount: number): number {
  const tier = PAYMENT_BONUS_REWARD_TIERS.find((t) => supplyWonAmount >= t.minWon);
  return tier?.rate ?? 0;
}

/** 금액(공급가액) × 요율 을 원카드 기준 무료 횟수로 환산한다. */
export function rewardPassesForWon(supplyWonAmount: number, rate: number): number {
  // 커미션은 돈이라 원 단위 정수로 먼저 확정한다. 0.07 같은 요율은 부동소수점에서
  // 56000.00000000001 처럼 떨어지는데, 반대로 어긋나는 값이 생기면 버림과 만나 한 회를 잃는다.
  const commissionWon = Math.round(supplyWonAmount * rate);
  // 반올림이 아니라 버림이다. 올려 주면 지급하는 이용권이 리워드로 받은 금액보다 비싸진다 —
  // 단가에 모자라는 자투리를 한 회로 쳐 주는 셈이고, 금액이 작을수록 그 비중이 컸다
  // (2026-09-24). 지급 횟수를 버림으로 바꾼 rewardAllowanceForCombo 와 같은 이유·같은 규칙이다.
  return Math.floor(commissionWon / ONE_CARD_BASIS);
}

/** ISO 날짜에 개월 수를 더하되, 말일을 넘어가지 않게 클램프한다(예: 1월 31일 + 1개월 = 2월 28/29일).
 *  이용권 유효기간(fulfill.ts, referral/code.ts)과 받은 이용권 수령 가능 기간(pending-rewards,
 *  functions 의 정산·생일 쿠폰)이 공용으로 쓴다. */
export function addMonthsClamped(iso: string, months: number): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}
