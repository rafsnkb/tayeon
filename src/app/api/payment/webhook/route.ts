import { NextRequest, NextResponse } from "next/server";
import * as PortOne from "@portone/server-sdk";
import { fulfillPayment } from "@/lib/payment/fulfill";
import { revokeCancelledPayment } from "@/lib/payment/revoke";
import { notifyOwner } from "@/lib/notify/owner";

// 결제가 취소됐다는 통지. 앱을 거치지 않고 포트원 콘솔이나 PG 측에서 취소된 경우가 여기로 온다.
// Transaction.CancelPending은 아직 취소가 확정되지 않은 단계라 회수하지 않는다(확정되면
// Transaction.Cancelled가 다시 온다).
const CANCEL_TYPES = new Set(["Transaction.Cancelled", "Transaction.PartialCancelled"]);

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
    const paymentId = webhook.data.paymentId;
    // 예전엔 종류를 보지 않고 paymentId가 있는 모든 이벤트를 fulfillPayment로 보냈다. 취소
    // 이벤트도 지급 시도로 들어가 멱등성 체크에 걸려 조용히 스킵됐고, 그 결과 콘솔에서 취소해도
    // 사용자는 이용권을 그대로 들고 있었다(2026-09-21 수정).
    if (CANCEL_TYPES.has(webhook.type)) {
      const outcome = await revokeCancelledPayment(paymentId);
      if (outcome.kind === "rejected") {
        console.error("[payment webhook] 이용권 회수 실패", paymentId, outcome.reason);
        await notifyOwner({
          key: `revoke-failed/${paymentId}`,
          level: "urgent",
          title: "취소된 결제의 이용권 회수 실패",
          fields: [["결제", paymentId], ["사유", outcome.reason]],
          note: "**결제는 취소됐는데 이용권이 그대로 남아 있습니다.** 어드민에서 직접 회수해 주세요.",
        }).catch((error) => console.error("[payment webhook] 회수 실패 알림 실패", paymentId, error));
      } else if (outcome.kind === "partial") {
        // 부분 취소는 상품 구조상(이용권 1건 = 결제 1건) 정상 흐름이 아니다. 자동 회수는
        // 과잉이라 하지 않지만, 사람이 반드시 봐야 한다 — 돈은 일부 돌아갔는데 이용권은
        // 미사용 상태 그대로라 그냥 쓸 수 있다.
        await notifyOwner({
          key: `partial-cancel/${paymentId}`,
          level: "urgent",
          title: "부분 취소 — 이용권이 그대로 남아 있습니다",
          fields: [["결제", paymentId], ["사유", outcome.reason]],
          note: "**일부 금액이 환불됐지만 이용권은 회수하지 않았습니다.** 과잉 회수를 피하려고 자동 처리하지 않습니다 — 직접 판단해 주세요.",
        }).catch((error) => console.error("[payment webhook] 부분 취소 알림 실패", paymentId, error));
      } else if (outcome.kind === "revoked" && outcome.passStatusBefore !== "unused") {
        // 어드민 환불은 미사용 건만 허용하므로, 사용된 이용권이 취소됐다는 건 콘솔 직접 취소
        // 같은 비정상 경로를 뜻한다. 회수는 하되 추적할 수 있도록 남긴다.
        console.error(
          "[payment webhook] 이미 사용된 이용권이 취소돼 회수됨 — 경위 확인 필요",
          paymentId,
          outcome.passStatusBefore
        );
      }
    } else {
      const outcome = await fulfillPayment(paymentId, undefined, "webhook");
      if (outcome.kind === "rejected") {
        // 웹훅은 포트원이 재시도하므로, 거부 사유를 로그로 남기고 200을 반환해 불필요한 재시도를
        // 막는다(위조/파싱 실패 등은 재시도해도 결과가 달라지지 않는다).
        console.error("[payment webhook] fulfillPayment 거부", paymentId, outcome.reason);
      }
    }
  }

  return NextResponse.json({ received: true });
}
