import { NextRequest, NextResponse } from "next/server";
import * as PortOne from "@portone/server-sdk";
import { fulfillPayment } from "@/lib/payment/fulfill";

// 포트원 콘솔(결제 연동 > 연동 관리 > 결제알림(Webhook) 관리)에 등록하는 웹훅 엔드포인트.
// 결제창 콜백(/api/payment/complete)이 브라우저 종료 등으로 아예 호출되지 못한 경우에도
// 이 웹훅이 같은 fulfillPayment()를 재사용해 지급을 보장한다. paymentId를 멱등성 키로 쓰므로
// 콜백/웹훅 중 어느 쪽이 먼저 오든, 웹훅이 재시도로 여러 번 와도 중복 지급되지 않는다.
//
// PORTONE_WEBHOOK_SECRET은 포트원 콘솔에서 "웹훅 시크릿 발급" 후 받는 값 — Standard Webhooks
// 스펙에 따라 서명을 검증하므로, 서명이 맞지 않는 요청(위조된 요청)은 지급 로직을 타지 않는다.
export async function POST(req: NextRequest) {
  // 서명 검증에는 파싱되지 않은 원문 텍스트가 필요하다(JSON.parse한 뒤 재직렬화하면 서명이
  // 어긋날 수 있음).
  const rawBody = await req.text();

  let webhook;
  try {
    webhook = await PortOne.Webhook.verify(
      process.env.PORTONE_WEBHOOK_SECRET ?? "",
      rawBody,
      Object.fromEntries(req.headers)
    );
  } catch (error) {
    if (error instanceof PortOne.Webhook.WebhookVerificationError) {
      console.error("[payment webhook] 서명 검증 실패", error.reason);
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
    throw error;
  }

  if ("data" in webhook && webhook.data && "paymentId" in webhook.data) {
    const outcome = await fulfillPayment(webhook.data.paymentId, undefined, "webhook");
    if (outcome.kind === "rejected") {
      // 웹훅은 포트원이 재시도하므로, 거부 사유를 로그로 남기고 200을 반환해 불필요한 재시도를
      // 막는다(위조/파싱 실패 등은 재시도해도 결과가 달라지지 않는다).
      console.error("[payment webhook] fulfillPayment 거부", webhook.data.paymentId, outcome.reason);
    }
  }

  return NextResponse.json({ received: true });
}
