// 할인쿠폰의 판정과 계산 — 전부 순수 함수다(Firestore·네트워크 없음).
//
// 돈이 걸린 계산이라 화면·서버 어느 쪽에서도 같은 답이 나와야 하고, 테스트로 고정해 두지 않으면
// "표시된 금액과 청구된 금액이 다르다"가 조용히 생긴다. 실제 조회·트랜잭션은 호출부가 한다.

/** 코드에 쓸 수 있는 글자. 헷갈리는 문자를 굳이 빼지는 않았다 — 운영자가 직접 정하는 값이고,
 *  사용자는 복사·붙여넣기로 입력한다. */
const CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

/** 카드사 최소 결제금액. 할인을 아무리 크게 걸어도 이 아래로는 청구할 수 없다 —
 *  0 원이 되면 결제창 자체가 뜨지 않는다. */
export const MIN_CHARGE_WON = 100;

export type DiscountCoupon = {
  code: string;
  /** 0 < rate < 1. 정률로 두는 이유는 타로 이용권과 사주 단품의 원가가 달라서다 —
   *  정액이면 저가 상품에서 금액이 0 이하가 된다. */
  discountRate: number;
  startsAt: string;
  endsAt: string;
};

/** 사용자가 보유한 쿠폰(users/{uid}/discountCoupons/{code}). */
export type HeldDiscountCoupon = DiscountCoupon & {
  status: "unused" | "used";
};

/** 입력받은 코드를 문서 id 로 쓸 수 있는 형태로 정규화한다. 사용자는 소문자로 치거나 앞뒤에
 *  공백을 붙여 붙여넣는다 — 그걸 다른 코드로 취급하면 "분명 맞게 입력했는데 없는 코드"가 된다. */
export function normalizeCouponCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** 지금 쓸 수 있는 쿠폰인가. 기간은 쿠폰의 것이고 사용자별로 다르지 않다. */
export function isCouponUsable(coupon: HeldDiscountCoupon, nowIso: string): boolean {
  if (coupon.status !== "unused") return false;
  const now = Date.parse(nowIso);
  const starts = Date.parse(coupon.startsAt);
  const ends = Date.parse(coupon.endsAt);
  if (!Number.isFinite(now) || !Number.isFinite(starts) || !Number.isFinite(ends)) return false;
  return now >= starts && now <= ends;
}

/**
 * 보유분 중 지금 적용할 쿠폰 하나를 고른다.
 *
 * 운영 원칙상 기간이 겹치게 발급하지 않으므로 후보는 보통 0 또는 1 개다. 그래도 **할인율이 가장
 * 높은 것**을 고르도록 해 둔다 — 수동 수정이나 발급 실수로 겹쳤을 때 사용자에게 불리한 쪽으로
 * 조용히 기우는 것보다 낫고, 무엇이 뽑힐지가 정해져 있어야 재현이 된다.
 */
export function pickBestCoupon(held: HeldDiscountCoupon[], nowIso: string): HeldDiscountCoupon | null {
  const usable = held.filter((c) => isCouponUsable(c, nowIso));
  if (usable.length === 0) return null;
  return usable.reduce((best, c) => (c.discountRate > best.discountRate ? c : best));
}

/** 만료된 **미사용** 쿠폰을 쿠폰함에 남겨 두는 기간. 지나면 지운다(사용자 결정, 2026-09-25).
 *
 *  바로 지우지 않는 이유는 UX 다 — "분명 쿠폰이 있었는데 사라졌고 할인도 안 된다"가 문의로
 *  온다. 만료를 알아차리기에 한 달이면 넉넉하다.
 *
 *  보존 의무와 부딪히지 않는다: 전자상거래법 시행령 제6조①1호의 표시·광고 기록 6 개월은
 *  **캠페인 자체**에 대한 것이고, 그건 최상위 `discountCoupons/{code}` 문서로 기간 제한 없이
 *  남는다. 여기서 지우는 것은 그 캠페인의 **사용자별 사본**이다. 쓴 쿠폰은 아예 안 지운다 —
 *  대금결제 기록(5 년)과 묶여 있다. */
export const EXPIRED_COUPON_RETENTION_DAYS = 30;

/** 쿠폰함에서 이 쿠폰을 어떻게 다룰지.
 *  - `usable`   지금 쓸 수 있다
 *  - `scheduled` 아직 시작 전이다(어드민이 미리 지급한 경우)
 *  - `used`     이미 썼다 — 결제와 묶여 있으므로 **무기한 남긴다**
 *  - `expired`  기간이 지났고 아직 보관 기간 안이다
 *  - `purgeable` 기간이 지난 지 보관 기간을 넘겼다 — 지운다
 */
export type CouponShelfState = "usable" | "scheduled" | "used" | "expired" | "purgeable";

export function couponShelfState(coupon: HeldDiscountCoupon, nowIso: string): CouponShelfState {
  // 쓴 쿠폰은 기간과 무관하게 남긴다. 결제 내역에서 "이 결제에 쓴 쿠폰"을 되짚을 수 있어야 한다.
  if (coupon.status === "used") return "used";

  const now = Date.parse(nowIso);
  const starts = Date.parse(coupon.startsAt);
  const ends = Date.parse(coupon.endsAt);
  // 날짜를 못 읽으면 지우지 않는다 — 읽지 못한다고 사용자 것을 없애는 쪽으로 기울면 안 된다.
  if (!Number.isFinite(now) || !Number.isFinite(starts) || !Number.isFinite(ends)) return "expired";

  if (now < starts) return "scheduled";
  if (now <= ends) return "usable";
  const keptUntil = ends + EXPIRED_COUPON_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return now <= keptUntil ? "expired" : "purgeable";
}

export type DiscountedAmount = {
  /** 실제로 청구할 금액. */
  amountWon: number;
  /** 깎인 금액. 표시용이며 amountWon 과 합치면 정가가 된다. */
  discountWon: number;
};

/**
 * 할인 적용 금액. **서버만 부른다** — 클라이언트가 보낸 금액은 어느 단계에서도 믿지 않는다.
 *
 * 반올림은 중립(Math.round)으로 둔다. 흔히 쓸 할인율에서는 어차피 딱 떨어지고(3,000 의 30% =
 * 900), 1 원 차이가 나는 구간에서 한쪽으로 몰아 줄 근거가 없다. 중요한 건 **이 함수 하나만
 * 쓰는 것**이다 — 화면과 서버가 각자 계산하면 표시가와 청구가가 갈린다.
 */
export function discountedAmount(listPriceWon: number, discountRate: number): DiscountedAmount {
  if (!Number.isFinite(listPriceWon) || listPriceWon <= 0) {
    return { amountWon: listPriceWon, discountWon: 0 };
  }
  if (!Number.isFinite(discountRate) || discountRate <= 0) {
    return { amountWon: listPriceWon, discountWon: 0 };
  }
  const rate = Math.min(discountRate, 1);
  const rawAmount = listPriceWon - Math.round(listPriceWon * rate);
  // 정가 자체가 최소 결제금액보다 낮을 수는 없지만(가장 싼 상품이 3,000 원), 그래도 정가를
  // 넘겨 청구하는 일이 생기지 않도록 위아래를 모두 막는다.
  const amountWon = Math.min(listPriceWon, Math.max(rawAmount, MIN_CHARGE_WON));
  return { amountWon, discountWon: listPriceWon - amountWon };
}
