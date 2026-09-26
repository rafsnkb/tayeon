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
    case "coupon_conflict_cancelled":
      // 결제창을 두 개 띄워 같은 쿠폰을 동시에 써서, 먼저 도착한 결제가 이미 그 쿠폰을 소진한
      // 경우다(fulfill.ts의 coupon_conflict 분기 주석). duplicate_cancelled와 같은 처리 — 지급은
      // 막혔지만 결제는 자동 취소됐다.
      return NextResponse.json(
        {
          error: outcome.cancelled
            ? "할인쿠폰이 이미 다른 결제에 사용돼 지급되지 않았어요. 결제는 자동으로 취소됐습니다."
            : "할인쿠폰이 이미 다른 결제에 사용돼 지급되지 않았어요. 결제 취소가 지연되고 있으니 고객센터로 문의해주세요.",
          code: "COUPON_CONFLICT",
        },
        { status: 409 }
      );
    case "rejected":
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
    default: {
      // 이 스위치가 FulfillOutcome 의 모든 갈래를 다루는지 컴파일 타임에 강제한다. 새 kind 가
      // 생겼는데 여기 case 를 안 넣으면 `outcome` 이 `never` 로 좁혀지지 않아 타입 에러가 난다.
      // (coupon_conflict 의 원래 버그는 여기가 아니라 fulfill.ts 안에서 그 갈래가 이 스위치까지
      // 오지도 못하고 "fulfilled" 로 조기 반환된 것이었다 — 이 방어는 그 종류의 다음 실수를
      // 이 스위치 층에서 잡기 위한 것이다. 2026-09-26.)
      const unhandled: never = outcome;
      console.error("[payment complete] 처리되지 않은 outcome", unhandled);
      return NextResponse.json({ error: "결제 처리 중 알 수 없는 상태예요." }, { status: 500 });
    }
  }
}
