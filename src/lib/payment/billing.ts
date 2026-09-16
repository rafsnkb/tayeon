// 자동충전(빌링키) 스켈레톤 공용 로직 — 잔액이 떨어지면 저장된 카드로 자동 충전하는 기능이며,
// 정기 구독(캘린더 기준 반복 결제)과는 다르다.
//
// ⚠️ 구체적인 트리거 조건(코인 잔액 임계값, 충전할 금액/상품 등)은 아직 확정되지 않았다.
// 여기 있는 건 "빌링키로 결제를 실행한다"는 범용 동작뿐이다. 실제 자동충전 기능을 붙일 때
// 필요한 것:
//   1. 자동충전 트리거 조건(잔액 임계값)과 충전 상품을 pricing.ts류에 정의
//   2. 코인이 소모되는 지점(예: /api/tarot/reading)에서 잔액이 임계값 아래로 떨어지면
//      chargeBillingKey()를 호출하도록 연결 — 이 함수는 HTTP 요청 없이 서버 코드에서
//      바로 import해서 쓸 수 있게 만들어뒀다.
//   3. 결제 성공/실패에 따른 재시도, 반복 실패 시 자동충전 해제 정책 추가
import { randomUUID } from "node:crypto";
import { portone } from "@/lib/payment/portone";

export async function chargeBillingKey(params: {
  billingKey: string;
  orderName: string;
  amountWon: number;
  /** 포트원 customer.id — 이 서비스에서는 Firebase uid를 그대로 사용한다. */
  customerId: string;
  customData?: Record<string, unknown>;
}): Promise<{ paymentId: string; paidAt: string; pgTxId: string }> {
  const paymentId = randomUUID();

  // payWithBillingKey는 실패 시(PG 거절, 빌링키 만료 등) PayWithBillingKeyError를 던진다 —
  // 호출부(라우트 핸들러)에서 잡아서 사용자에게 보여줄 메시지로 변환한다.
  const response = await portone.payWithBillingKey({
    paymentId,
    billingKey: params.billingKey,
    orderName: params.orderName,
    customer: { id: params.customerId },
    amount: { total: params.amountWon },
    currency: "KRW",
    customData: params.customData ? JSON.stringify(params.customData) : undefined,
  });

  return {
    paymentId,
    paidAt: response.payment.paidAt,
    pgTxId: response.payment.pgTxId,
  };
}
