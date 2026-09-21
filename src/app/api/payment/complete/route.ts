import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { fulfillPayment } from "@/lib/payment/fulfill";

// 결제창(PortOne.requestPayment)이 브라우저에서 resolve된 직후 프론트가 호출하는 콜백.
// 실제 지급은 fulfillPayment()가 포트원 서버에 결제내역을 다시 조회해서 검증한 뒤에만
// 일어난다 — 이 요청의 body는 paymentId 외에는 아무것도 신뢰하지 않는다.
//
// 브라우저가 결제 직후 종료되는 등의 이유로 이 콜백이 아예 호출되지 못하는 경우를 대비해,
// /api/payment/webhook이 같은 fulfillPayment()를 재사용해 최종적으로 지급을 보장한다.
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { paymentId } = (await req.json()) as { paymentId?: string };
  if (!paymentId) {
    return NextResponse.json({ error: "paymentId가 필요해요." }, { status: 400 });
  }

  const outcome = await fulfillPayment(paymentId, uid, "complete");

  switch (outcome.kind) {
    case "fulfilled":
      return NextResponse.json({ status: "PAID", alreadyFulfilled: outcome.alreadyFulfilled });
    case "not_paid":
      return NextResponse.json({ status: outcome.status });
    case "duplicate_cancelled":
      // 지급은 막혔지만 결제는 자동 취소됐다(실패 시 수동 환불 대상). 어느 쪽이든 사용자에게는
      // 왜 못 받았는지와 돈이 어떻게 되는지를 분명히 알려준다.
      return NextResponse.json(
        {
          error: outcome.cancelled
            ? "이미 보유 중인 이용권이 있어 지급되지 않았어요. 결제는 자동으로 취소됐습니다."
            : "이미 보유 중인 이용권이 있어 지급되지 않았어요. 결제 취소가 지연되고 있으니 고객센터로 문의해주세요.",
          code: "DUPLICATE_PASS",
        },
        { status: 409 }
      );
    case "rejected":
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
  }
}
