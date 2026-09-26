import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCouponCode,
  isCouponUsable,
  pickBestCoupon,
  resolveCouponSelection,
  discountedAmount,
  couponShelfState,
  MIN_CHARGE_WON,
  EXPIRED_COUPON_RETENTION_DAYS,
} from "@/lib/payment/discountCoupon.ts";

// 2026-09-25 신설. 할인 계산이 화면과 서버에서 갈리면 "표시된 금액과 청구된 금액이 다르다"가
// 되고, 그건 사용자가 결제창에서야 발견한다. 여기서 고정해 두고 양쪽이 이 함수만 쓴다.

test("코드는 대문자·공백 제거로 정규화된다 — 붙여넣기 실수를 없는 코드로 만들지 않는다", () => {
  assert.equal(normalizeCouponCode("  launch30 "), "LAUNCH30");
  assert.equal(normalizeCouponCode("LAUNCH30"), "LAUNCH30");
});

test("코드 형식을 벗어나면 거른다", () => {
  assert.equal(normalizeCouponCode("abc"), null, "4자 미만");
  assert.equal(normalizeCouponCode("A".repeat(21)), null, "20자 초과");
  assert.equal(normalizeCouponCode("LAUNCH-30"), null, "허용하지 않는 문자");
  assert.equal(normalizeCouponCode(""), null);
  assert.equal(normalizeCouponCode(undefined), null);
  assert.equal(normalizeCouponCode(1234), null);
});

const 쿠폰 = {
  code: "LAUNCH30",
  discountRate: 0.3,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-07T23:59:59.000Z",
  status: "unused",
};

test("유효기간 안의 미사용 쿠폰만 쓸 수 있다", () => {
  assert.equal(isCouponUsable(쿠폰, "2026-10-03T00:00:00.000Z"), true);
  assert.equal(isCouponUsable(쿠폰, "2026-09-30T23:59:59.000Z"), false, "시작 전");
  assert.equal(isCouponUsable(쿠폰, "2026-10-08T00:00:00.000Z"), false, "만료 후");
  assert.equal(isCouponUsable({ ...쿠폰, status: "used" }, "2026-10-03T00:00:00.000Z"), false);
});

test("날짜가 깨져 있으면 쓸 수 없는 것으로 본다 — 못 읽는 기간을 통과시키지 않는다", () => {
  assert.equal(isCouponUsable({ ...쿠폰, endsAt: "" }, "2026-10-03T00:00:00.000Z"), false);
  assert.equal(isCouponUsable(쿠폰, "언제"), false);
});

test("보유분이 없거나 전부 기간 밖이면 고르지 않는다", () => {
  assert.equal(pickBestCoupon([], "2026-10-03T00:00:00.000Z"), null);
  assert.equal(pickBestCoupon([쿠폰], "2026-11-01T00:00:00.000Z"), null);
});

test("겹쳐 버린 경우에는 할인율이 가장 높은 것을 고른다 (발급 실수 대비)", () => {
  const 큰할인 = { ...쿠폰, code: "BIG50", discountRate: 0.5 };
  const picked = pickBestCoupon([쿠폰, 큰할인], "2026-10-03T00:00:00.000Z");
  assert.equal(picked.code, "BIG50");
});

test("할인율이 같으면 만료가 빠른 쿠폰을 고른다 — 알파벳순(문서 id)에 맡기면 늦게 만료되는 쪽이 알파벳상 뒤일 때 먼저 만료되는 쪽이 그대로 소멸한다", () => {
  const 내일만료 = { ...쿠폰, code: "BONUS20", discountRate: 0.2, endsAt: "2026-10-04T23:59:59.000Z" };
  const 다음달만료 = { ...쿠폰, code: "APRIL20", discountRate: 0.2, endsAt: "2026-11-30T23:59:59.000Z" };
  // 배열 순서를 바꿔도(알파벳순이든 아니든) 결과가 같아야 진짜 규칙이다.
  const now = "2026-10-03T00:00:00.000Z";
  assert.equal(pickBestCoupon([다음달만료, 내일만료], now).code, "BONUS20");
  assert.equal(pickBestCoupon([내일만료, 다음달만료], now).code, "BONUS20");
});

// ── couponCode 검증(사용자가 2장 이상 보유 시 직접 고른 것, 2026-09-27 사용자 결정) ──────────
// "조용히 다른 쿠폰으로 대체하지 않는다" — 없음/이미 사용/기간 만료를 구분해 거절한다.

test("보유한 코드가 없으면 not_found다 — 남의 쿠폰이나 오타를 그냥 통과시키지 않는다", () => {
  const result = resolveCouponSelection([쿠폰], "NOSUCH20", "2026-10-03T00:00:00.000Z");
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("이미 쓴 코드면 used다", () => {
  const 쓴쿠폰 = { ...쿠폰, status: "used" };
  const result = resolveCouponSelection([쓴쿠폰], "LAUNCH30", "2026-10-03T00:00:00.000Z");
  assert.deepEqual(result, { ok: false, reason: "used" });
});

test("기간이 지났거나 아직 시작 전이면 expired다", () => {
  assert.deepEqual(resolveCouponSelection([쿠폰], "LAUNCH30", "2026-11-01T00:00:00.000Z"), { ok: false, reason: "expired" });
  assert.deepEqual(resolveCouponSelection([쿠폰], "LAUNCH30", "2026-09-01T00:00:00.000Z"), { ok: false, reason: "expired" });
});

test("본인이 보유한, 아직 안 쓴, 기간 안의 코드면 그 쿠폰을 그대로 돌려준다 — 얼마를 깎을지는 여기서 다시 계산하지 않는다", () => {
  const result = resolveCouponSelection([쿠폰], "LAUNCH30", "2026-10-03T00:00:00.000Z");
  assert.equal(result.ok, true);
  assert.equal(result.coupon.code, "LAUNCH30");
  assert.equal(result.coupon.discountRate, 0.3);
});

test("정률 할인이 적용된다", () => {
  assert.deepEqual(discountedAmount(3000, 0.3), { amountWon: 2100, discountWon: 900 });
  assert.deepEqual(discountedAmount(110000, 0.5), { amountWon: 55000, discountWon: 55000 });
  assert.deepEqual(discountedAmount(5900, 0.1), { amountWon: 5310, discountWon: 590 });
});

test("청구액은 카드사 최소 결제금액 아래로 내려가지 않는다", () => {
  const r = discountedAmount(3000, 0.99);
  assert.equal(r.amountWon, MIN_CHARGE_WON);
  assert.equal(r.discountWon, 3000 - MIN_CHARGE_WON);
});

test("할인율이 없거나 0 이하면 정가 그대로다", () => {
  assert.deepEqual(discountedAmount(3000, 0), { amountWon: 3000, discountWon: 0 });
  assert.deepEqual(discountedAmount(3000, -0.5), { amountWon: 3000, discountWon: 0 });
  assert.deepEqual(discountedAmount(3000, Number.NaN), { amountWon: 3000, discountWon: 0 });
});

test("깎인 금액과 청구액을 더하면 항상 정가다", () => {
  for (const price of [3000, 5900, 12900, 35000, 110000]) {
    for (const rate of [0.05, 0.1, 0.3, 0.33, 0.5, 0.7]) {
      const { amountWon, discountWon } = discountedAmount(price, rate);
      assert.equal(amountWon + discountWon, price, `${price} / ${rate}`);
      assert.ok(amountWon >= MIN_CHARGE_WON, `${price} / ${rate} 최소금액`);
    }
  }
});

// ── 쿠폰함 노출 규칙 (사용자 결정, 2026-09-25) ──────────────────────────────
// 사용 가능: 유효기간 동안 / 사용 완료: 무기한 / 기간 만료: 30 일 뒤 삭제

const 하루 = 24 * 60 * 60 * 1000;
const 만료후 = (일수) => new Date(Date.parse(쿠폰.endsAt) + 일수 * 하루).toISOString();

test("유효기간 안이면 사용 가능으로 남는다", () => {
  assert.equal(couponShelfState(쿠폰, "2026-10-03T00:00:00.000Z"), "usable");
});

test("시작 전이면 예정 상태다 (어드민이 미리 지급한 경우)", () => {
  assert.equal(couponShelfState(쿠폰, "2026-09-25T00:00:00.000Z"), "scheduled");
});

test("사용 완료는 기간과 무관하게 무기한 남는다 — 결제와 묶여 있다", () => {
  const 쓴쿠폰 = { ...쿠폰, status: "used" };
  assert.equal(couponShelfState(쓴쿠폰, "2026-10-03T00:00:00.000Z"), "used");
  assert.equal(couponShelfState(쓴쿠폰, 만료후(9999)), "used", "몇 년이 지나도 남는다");
});

test("만료된 미사용 쿠폰은 보관 기간 동안만 쿠폰함에 남는다", () => {
  assert.equal(couponShelfState(쿠폰, 만료후(1)), "expired");
  assert.equal(couponShelfState(쿠폰, 만료후(EXPIRED_COUPON_RETENTION_DAYS)), "expired", "마지막 날은 아직 남는다");
  assert.equal(couponShelfState(쿠폰, 만료후(EXPIRED_COUPON_RETENTION_DAYS + 1)), "purgeable");
});

test("날짜를 못 읽으면 지우지 않는다 — 읽지 못한다고 사용자 것을 없애지 않는다", () => {
  assert.equal(couponShelfState({ ...쿠폰, endsAt: "" }, "2026-10-03T00:00:00.000Z"), "expired");
});
