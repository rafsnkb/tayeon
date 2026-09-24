import test from "node:test";
import assert from "node:assert/strict";
import { isWithinRefundWindow, REFUND_WINDOW_MS } from "./refundWindow.ts";

const PAID = "2026-09-01T10:00:00.000Z";
const paidMs = Date.parse(PAID);
const days = (n) => paidMs + n * 24 * 60 * 60 * 1000;

test("a withdrawal exercised inside the window is payable", () => {
  assert.equal(isWithinRefundWindow(PAID, paidMs), true, "결제 직후");
  assert.equal(isWithinRefundWindow(PAID, days(4)), true, "4일차");
  assert.equal(isWithinRefundWindow(PAID, paidMs + REFUND_WINDOW_MS), true, "정확히 7일 경계");
});

test("a withdrawal exercised after the window is not payable", () => {
  assert.equal(isWithinRefundWindow(PAID, paidMs + REFUND_WINDOW_MS + 1), false);
  assert.equal(isWithinRefundWindow(PAID, days(8)), false);
});

// 이것이 이 파일의 존재 이유다. 신청은 7일 안에 들어왔는데 자동 승인이 2영업일 뒤라
// 집행이 8일차에 일어나는 경우 — 기산점을 집행 시각으로 잡으면 영영 환불되지 않고
// 이용권이 refund_pending 에 갇힌다.
test("a late-window request stays payable even when approval lands after day 7", () => {
  const requestedAt = days(6); // 금요일에 신청
  const approvedAt = days(8); // 2영업일 뒤 화요일에 자동 승인
  assert.equal(isWithinRefundWindow(PAID, requestedAt), true, "행사 시점 기준 — 집행 가능해야 한다");
  assert.equal(
    isWithinRefundWindow(PAID, approvedAt),
    false,
    "집행 시점 기준으로 재면 막힌다 — 예전 동작이자 교착의 원인"
  );
});

test("a withdrawal dated before the payment is rejected as corrupt", () => {
  assert.equal(isWithinRefundWindow(PAID, days(-1)), false);
});

test("an unparseable or missing paidAt is rejected rather than treated as zero", () => {
  for (const bad of [undefined, "", "어제", "not-a-date"]) {
    assert.equal(isWithinRefundWindow(bad, paidMs), false);
  }
  assert.equal(isWithinRefundWindow(PAID, NaN), false);
});
