import test from "node:test";
import assert from "node:assert/strict";
import { couponConflictReason } from "@/lib/payment/fulfill";

// 2026-09-26 신설. fulfillPayment 의 트랜잭션은 Firestore·포트원을 직접 부르므로 여기서 통째로
// 테스트할 수 없다 — 그래서 지급 여부를 가르는 판정만 순수 함수로 빼서 고정한다
// (src/lib/saju/purchase.ts 의 `openGateReason` 과 같은 이유).
//
// 이 판정이 지키는 것: 결제창을 두 개 띄워 같은 쿠폰으로 둘 다 결제하면, prepare 는 양쪽 모두에
// 할인을 적어 준다(그 시점엔 아직 안 쓴 쿠폰이다). 먼저 도착한 쪽이 소진하면 나중 것은 "받을
// 자격이 없던 할인"이 되므로 지급하지 않고 돌려줘야 한다 — 그런데 2026-09-26 까지는 이 판정이
// "지급하지 않는다"만 하고 실제로 돌려주지 않아서, 돈은 승인된 채 남고 결제 내역에도 안 뜨는
// 채로 { kind: "fulfilled" }가 떨어졌다(fulfill.ts 의 coupon_conflict 분기 주석 참고).

test("쿠폰을 안 쓴 결제는 무조건 통과한다", () => {
  assert.equal(couponConflictReason(null, "pay-1"), null);
});

test("이 결제가 먼저 소진한 쿠폰은 통과한다 — 자기 자신은 충돌이 아니다", () => {
  assert.equal(
    couponConflictReason({ exists: true, status: "used", usedPaymentId: "pay-1" }, "pay-1"),
    null
  );
});

test("아직 안 쓴 쿠폰(unused)은 통과한다", () => {
  assert.equal(couponConflictReason({ exists: true, status: "unused" }, "pay-1"), null);
});

test("재현 경로 — 결제창 두 개로 같은 쿠폰을 동시에 쓰면 나중 결제가 거절된다", () => {
  // pay-1 이 먼저 도착해 쿠폰을 소진했다. pay-2 는 prepare 시점엔 같은 쿠폰으로 할인을 받았지만
  // 지급 시점엔 이미 남의 것이다.
  const reason = couponConflictReason({ exists: true, status: "used", usedPaymentId: "pay-1" }, "pay-2");
  assert.ok(reason, "충돌 사유가 있어야 지급을 막는다");
  assert.match(reason, /다른 결제/);
});

test("쿠폰 문서 자체가 사라졌으면 거절한다 — 대조할 게 없다", () => {
  const reason = couponConflictReason({ exists: false }, "pay-1");
  assert.ok(reason);
  assert.match(reason, /사라져/);
});
