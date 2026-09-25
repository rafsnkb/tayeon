import test from "node:test";
import assert from "node:assert/strict";
import { validatePaidPayment } from "@/lib/payment/validatePayment.ts";

// 지급 전 관문 8개가 실제로 막고 있는지 확인한다. 하나라도 뚫리면 "돈을 안 냈는데 이용권이
// 나간다" 거나 "남의 결제를 가로챈다" 가 되는 자리들이라, 여기가 무너지면 조용히 손해가 난다.
//
// 2026-09-24 신설. 이 함수는 fulfillPayment 안에 섞여 있던 판정부를 떼어낸 것이고,
// 관문의 순서와 거부 문구를 원본 그대로 유지한다.

/** 통과해야 정상인 결제 한 건. 각 테스트는 여기서 한 군데만 망가뜨린다 — 그래야 실패했을 때
 *  "무엇 때문에 막혔는지" 가 분명해진다. */
const 정상결제 = {
  status: "PAID",
  channel: { type: "LIVE" },
  customData: JSON.stringify({ uid: "user-1", productId: "count-starter", combo: "tarot" }),
  amount: { total: 3000 },
  currency: "KRW",
  paidAt: "2026-09-24T00:00:00.000Z",
};
const 개발환경 = { isProduction: false };
const 운영환경 = { isProduction: true };

const 통과 = (payment = 정상결제, opts = 개발환경) => validatePaidPayment(payment, opts);

test("정상 결제는 통과하고 uid·상품·조합을 돌려준다", () => {
  const r = 통과();
  assert.equal(r.ok, true);
  assert.equal(r.uid, "user-1");
  assert.equal(r.product.productId, "count-starter");
  assert.equal(r.product.type, "countPass");
  assert.equal(r.combo, "tarot");
});

test("관문1: 결제되지 않은 건은 지급하지 않는다", () => {
  for (const status of ["READY", "FAILED", "CANCELLED", "VIRTUAL_ACCOUNT_ISSUED"]) {
    const r = 통과({ ...정상결제, status });
    assert.equal(r.ok, false, status);
    assert.equal(r.outcome.kind, "not_paid");
    assert.equal(r.outcome.status, status);
  }
});

test("관문2: 프로덕션에서 TEST 채널 결제는 거부한다 (무료 지급 사고 방지)", () => {
  const r = 통과({ ...정상결제, channel: { type: "TEST" } }, 운영환경);
  assert.equal(r.ok, false);
  assert.equal(r.outcome.reason, "테스트 채널 결제는 프로덕션에서 지급되지 않아요.");
});

test("관문2: 채널 정보 자체가 없어도 프로덕션에서는 거부한다", () => {
  assert.equal(통과({ ...정상결제, channel: null }, 운영환경).ok, false);
  assert.equal(통과({ ...정상결제, channel: {} }, 운영환경).ok, false);
});

test("관문2: 개발 환경에서는 TEST 채널을 통과시킨다 (실채널 계약 전까지 필요)", () => {
  assert.equal(통과({ ...정상결제, channel: { type: "TEST" } }, 개발환경).ok, true);
});

test("관문3: customData 가 깨져 있으면 거부한다", () => {
  const r = 통과({ ...정상결제, customData: "{이건 JSON이 아니다" });
  assert.equal(r.ok, false);
  assert.equal(r.outcome.reason, "customData를 해석하지 못했어요.");
});

test("관문4: uid 가 없거나 빈 문자열이면 거부한다", () => {
  for (const uid of [undefined, "", 123, null]) {
    const customData = JSON.stringify({ uid, productId: "count-starter", combo: "tarot" });
    const r = 통과({ ...정상결제, customData });
    assert.equal(r.ok, false, String(uid));
    assert.equal(r.outcome.reason, "customData에 uid가 없어요.");
  }
  // customData 가 아예 없는 경우도 같은 자리에서 걸린다.
  assert.equal(통과({ ...정상결제, customData: null }).outcome.reason, "customData에 uid가 없어요.");
});

test("관문5: 남의 결제 건은 지급하지 않는다", () => {
  const r = 통과(정상결제, { ...개발환경, expectedUid: "다른사람" });
  assert.equal(r.ok, false);
  assert.equal(r.outcome.reason, "본인의 결제 건이 아니에요.");
});

test("관문5: expectedUid 를 주지 않으면(웹훅 경로) uid 대조를 건너뛴다", () => {
  assert.equal(통과(정상결제, 개발환경).ok, true);
  assert.equal(통과(정상결제, { ...개발환경, expectedUid: "user-1" }).ok, true);
});

test("관문6: 가격표에 없는 상품은 거부한다", () => {
  for (const productId of ["count-공짜", "", undefined, 42, "timepass-15-tarot"]) {
    const customData = JSON.stringify({ uid: "user-1", productId, combo: "tarot" });
    const r = 통과({ ...정상결제, customData });
    assert.equal(r.ok, false, String(productId));
    assert.equal(r.outcome.reason, "알 수 없는 상품이에요.");
  }
});

test("관문7: 횟수제인데 조합이 없거나 이상하면 거부한다", () => {
  for (const combo of [undefined, "", "tarot-사주", "any", 1]) {
    const customData = JSON.stringify({ uid: "user-1", productId: "count-starter", combo });
    const r = 통과({ ...정상결제, customData });
    assert.equal(r.ok, false, String(combo));
    assert.equal(r.outcome.reason, "이용권 옵션 정보가 없어요.");
  }
});

test("관문7: 시간제는 조합이 상품에 고정돼 있어 combo 없이도 통과한다", () => {
  const customData = JSON.stringify({ uid: "user-1", productId: "timepass-tarot-15" });
  const r = 통과({ ...정상결제, customData, amount: { total: 8900 } });
  assert.equal(r.ok, true);
  assert.equal(r.product.type, "timePass");
  assert.equal(r.combo, null);
});

test("관문8: 코인 상품은 판매 종료 시각 이후면 거부한다", () => {
  const customData = JSON.stringify({ uid: "user-1", productId: "coin-2" });
  const 코인결제 = { ...정상결제, customData, amount: { total: 3300 } };
  // 종료 시각이 설정돼 있지 않으면 무조건 거부 — 기본값이 "막는 쪽" 이어야 안전하다.
  assert.equal(통과(코인결제, 개발환경).ok, false);
  // 종료 시각 이후 결제도 거부.
  assert.equal(
    통과(코인결제, { ...개발환경, legacyCoinPaidBefore: "2026-01-01T00:00:00.000Z" }).outcome.reason,
    "코인 상품은 판매가 종료됐어요. 결제 내역을 고객센터로 문의해주세요."
  );
  // 종료 이전에 결제된 옛 건은 아직 지급된다(환불·정산 처리용).
  assert.equal(통과(코인결제, { ...개발환경, legacyCoinPaidBefore: "2027-01-01T00:00:00.000Z" }).ok, true);
});

test("관문9: 승인 금액이 상품 가격과 다르면 거부한다 (금액 위·변조)", () => {
  for (const total of [1, 2999, 3001, 0, -3000]) {
    const r = 통과({ ...정상결제, amount: { total } });
    assert.equal(r.ok, false, String(total));
    assert.equal(r.outcome.reason, "결제 금액이 상품 가격과 일치하지 않아요.");
  }
});

test("관문9: 원화가 아니면 거부한다", () => {
  const r = 통과({ ...정상결제, currency: "USD" });
  assert.equal(r.ok, false);
  assert.equal(r.outcome.reason, "결제 금액이 상품 가격과 일치하지 않아요.");
});

test("관문9: 금액 정보 자체가 없어도 통과시키지 않는다", () => {
  assert.equal(통과({ ...정상결제, amount: null }).ok, false);
  assert.equal(통과({ ...정상결제, amount: {} }).ok, false);
});

test("거부 로그에는 paymentId 를 뺀 판단 근거만 담긴다", () => {
  // 로그 출력은 호출부(fulfillPayment)가 하고, 순수 함수는 내용만 넘긴다.
  const r = 통과({ ...정상결제, amount: { total: 1 } });
  assert.equal(r.log.message, "금액 불일치");
  // fromIntent 는 "정가로 봤는지 기록으로 봤는지" 를 로그에서 바로 가리기 위한 것이다(2026-09-25).
  assert.deepEqual(r.log.detail, { paid: 1, currency: "KRW", expected: 3000, fromIntent: false });
});

// ── 주문 내역(paymentIntents) 대조 ────────────────────────────────────────────
//
// 2026-09-25 신설. 할인쿠폰을 붙이려면 "이 결제는 얼마여야 하는가"의 기준이 상품표 정가에서
// prepare 가 적어 둔 기록으로 옮겨가야 한다. 정가로 대조하면 할인 결제가 전부 위조로 보이고,
// 그렇다고 대조를 풀면 100 원을 결제해 11 만원 상품을 받는 구멍이 된다.

const 주문내역 = { uid: "user-1", productId: "count-starter", amountWon: 3000 };
const 기록있음 = (intent) => ({ ...개발환경, intent });

test("주문 내역이 있으면 그 금액으로 대조한다 — 할인가 결제가 통과한다", () => {
  // 정가 3000 인 상품을 쿠폰으로 2100 에 판 상황.
  const r = 통과({ ...정상결제, amount: { total: 2100 } }, 기록있음({ ...주문내역, amountWon: 2100 }));
  assert.equal(r.ok, true);
  assert.equal(r.paidWon, 2100, "실제 승인 금액을 돌려줘야 결제 문서에 정가 대신 이 값을 남길 수 있다");
});

test("주문 내역이 있으면 정가로 결제해도 거부한다 — 기준은 어디까지나 기록이다", () => {
  const r = 통과({ ...정상결제, amount: { total: 3000 } }, 기록있음({ ...주문내역, amountWon: 2100 }));
  assert.equal(r.ok, false);
  assert.equal(r.outcome.reason, "결제 금액이 상품 가격과 일치하지 않아요.");
});

test("할인 기록이 있어도 그보다 적게 내면 거부한다 (100원 결제 구멍 방지)", () => {
  const r = 통과({ ...정상결제, amount: { total: 100 } }, 기록있음({ ...주문내역, amountWon: 2100 }));
  assert.equal(r.ok, false);
  assert.equal(r.outcome.autoCancel, true);
});

test("주문 내역이 없으면 옛 방식(정가 대조)으로 내려간다", () => {
  assert.equal(통과({ ...정상결제, amount: { total: 3000 } }, 기록있음(null)).ok, true);
  assert.equal(통과({ ...정상결제, amount: { total: 2100 } }, 기록있음(null)).ok, false);
});

test("주문 내역과 uid 가 다르면 거부하되 결제를 취소하지는 않는다", () => {
  // 취소하면 남의 결제를 취소시키는 통로가 된다 — 기존 uid 불일치 관문과 같은 이유.
  const r = 통과(정상결제, 기록있음({ ...주문내역, uid: "user-2" }));
  assert.equal(r.ok, false);
  assert.equal(r.outcome.autoCancel, false);
});

test("주문 내역과 상품이 다르면 거부한다 (customData 위조)", () => {
  const r = 통과(정상결제, 기록있음({ ...주문내역, productId: "count-basic" }));
  assert.equal(r.ok, false);
  assert.equal(r.outcome.autoCancel, true);
});

test("정상 결제도 실제 승인 금액을 paidWon 으로 돌려준다", () => {
  assert.equal(통과().paidWon, 3000);
});
