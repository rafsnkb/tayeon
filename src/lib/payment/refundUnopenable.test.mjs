import test from "node:test";
import assert from "node:assert/strict";
import { refundGateReason } from "@/lib/payment/refundUnopenable";

// 2026-09-26 신설. refundUnopenableSajuOrder 자체는 Firestore·포트원을 실제로 불러서 여기서
// 통째로 테스트할 수 없다 — 그래서 "이 결제를 계속 환불해도 되는가"를 가르는 멱등성 판정만
// 순수 함수로 빼서 고정한다(fulfill.ts 의 couponConflictReason 과 같은 이유).
//
// 이 판정이 지키는 것: 화면이 열기를 실패하면 재시도할 수 있어서(open.ts 머리말 "멱등하다")
// 같은 결제가 이 경로에 두 번 올 수 있다. 이미 환불된 결제에 포트원 취소를 또 걸면 안 된다.

test("fulfilled 상태만 환불을 진행한다", () => {
  assert.equal(refundGateReason("fulfilled"), "proceed");
});

test("이미 refunded 면 다시 취소를 걸지 않는다 — 재시도 멱등성", () => {
  assert.equal(refundGateReason("refunded"), "already_refunded");
});

test("fulfilled 도 refunded 도 아니면 이 함수가 다룰 대상이 아니다", () => {
  assert.deepEqual(refundGateReason("duplicate_cancelled"), { notFulfilled: "duplicate_cancelled" });
  assert.deepEqual(refundGateReason(undefined), { notFulfilled: "unknown" });
});
