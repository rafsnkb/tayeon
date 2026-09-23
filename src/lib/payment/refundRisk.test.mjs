import test from "node:test";
import assert from "node:assert/strict";
import { assessRefundRisk } from "@/lib/payment/refundRisk.ts";

// 자동 승인은 사람 확인 없이 실제 결제를 취소한다. 여기서 hold 를 놓치면 그대로 돈이 나가므로
// 각 조건이 실제로 걸리는지 고정해 둔다(2026-09-24).

const 정상 = {
  passStatus: "refund_pending",
  paymentStatus: "PAID",
  paidAmount: 8900,
  recordedAmount: 8900,
  paidAt: "2026-09-24T00:00:00.000Z",
  requestedAt: "2026-09-24T02:00:00.000Z", // 결제 2시간 뒤
  otherRequestedAt: [],
};

test("정상 요청은 보류하지 않는다", () => {
  const r = assessRefundRisk(정상);
  assert.equal(r.hold, false);
  assert.deepEqual(r.reasons, []);
});

test("이용권이 잠겨 있지 않으면 보류한다", () => {
  for (const passStatus of ["unused", "active", "refunded", undefined]) {
    const r = assessRefundRisk({ ...정상, passStatus });
    assert.equal(r.hold, true, String(passStatus));
    assert.match(r.reasons[0], /refund_pending/);
  }
});

test("결제가 PAID 가 아니면 보류한다", () => {
  for (const paymentStatus of ["CANCELLED", "FAILED", undefined]) {
    assert.equal(assessRefundRisk({ ...정상, paymentStatus }).hold, true, String(paymentStatus));
  }
});

test("금액이 기록과 다르면 보류한다", () => {
  assert.equal(assessRefundRisk({ ...정상, paidAmount: 8800 }).hold, true);
  assert.equal(assessRefundRisk({ ...정상, paidAmount: undefined }).hold, true);
  assert.equal(assessRefundRisk({ ...정상, recordedAmount: undefined }).hold, true);
});

test("결제 후 10분 이내 요청은 보류한다", () => {
  const 즉시 = { ...정상, requestedAt: "2026-09-24T00:04:00.000Z" };
  const r = assessRefundRisk(즉시);
  assert.equal(r.hold, true);
  assert.match(r.reasons[0], /4분 만에/);
  // 경계: 정확히 10분이면 통과한다.
  assert.equal(assessRefundRisk({ ...정상, requestedAt: "2026-09-24T00:10:00.000Z" }).hold, false);
});

test("최근 3일 내 다른 환불 요청이 있으면 보류한다 (이번 건 포함 2건)", () => {
  const r = assessRefundRisk({ ...정상, otherRequestedAt: ["2026-09-22T00:00:00.000Z"] });
  assert.equal(r.hold, true);
  assert.match(r.reasons[0], /최근 3일 내 환불 요청 2건/);
});

test("3일이 지난 예전 환불은 세지 않는다", () => {
  // 요청 시각(09-24 02:00)에서 3일 넘게 전.
  assert.equal(assessRefundRisk({ ...정상, otherRequestedAt: ["2026-09-20T00:00:00.000Z"] }).hold, false);
});

test("여러 조건이 동시에 걸리면 사유가 모두 담긴다", () => {
  const r = assessRefundRisk({
    ...정상,
    passStatus: "unused",
    paidAmount: 1,
    requestedAt: "2026-09-24T00:01:00.000Z",
    otherRequestedAt: ["2026-09-23T00:00:00.000Z"],
  });
  assert.equal(r.hold, true);
  assert.equal(r.reasons.length, 4);
});

test("시각이 깨져 있어도 터지지 않는다", () => {
  const r = assessRefundRisk({ ...정상, paidAt: undefined, otherRequestedAt: ["어제"] });
  assert.equal(r.hold, false);
});
