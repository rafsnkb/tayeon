// 이용권 자동결제에서 쓰는 빌링키 공용 결제 로직. 달력 기준 정기 구독이 아니라, 유저가
// 사전 선택한 이용권이 모두 소진된 다음 질문 직전에만 서버가 직접 호출한다.
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
