import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { chargeBillingKey } from "@/lib/payment/billing";

// ⚠️ 자동충전(빌링키) 스켈레톤 — 구체적인 트리거 조건(잔액 임계값 등)은 아직 확정되지 않았다.
//
// 이 라우트는 "로그인한 유저가 자신이 등록한 빌링키로 즉시 결제를 실행"하는 예시일 뿐이다.
// 실제 자동충전 기능에서는:
//   - amountWon/orderName을 클라이언트 요청이 아니라 서버가 정의한 충전 상품에서 가져와야 한다
//     (지금처럼 클라이언트가 금액을 지정하게 두면 안 됨 — 여기서는 "본인 소유 카드로 본인이
//     지정한 금액을 결제"하는 것이라 위조 결제 리스크는 없지만, 실제 자동충전 기능이 생기면
//     서버 쪽 가격표 기준으로 바뀌어야 한다).
//   - 이 라우트를 거치지 않고, 코인이 소모되는 지점에서 잔액이 임계값 아래로 떨어졌을 때
//     src/lib/payment/billing.ts의 chargeBillingKey()를 서버 코드가 직접 import해서 호출하는
//     형태가 된다(HTTP 라우트가 필요 없음).
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { billingKeyId, amountWon, orderName } = (await req.json()) as {
    billingKeyId?: string;
    amountWon?: number;
    orderName?: string;
  };
  if (!billingKeyId || !Number.isInteger(amountWon) || amountWon! <= 0 || !orderName?.trim()) {
    return NextResponse.json({ error: "billingKeyId, amountWon, orderName이 필요해요." }, { status: 400 });
  }

  const billingKeyRef = adminDb
    .collection("users")
    .doc(uid)
    .collection("billingKeys")
    .doc(billingKeyId);
  const snap = await billingKeyRef.get();
  if (!snap.exists || snap.data()?.status !== "active") {
    return NextResponse.json({ error: "사용할 수 없는 빌링키예요." }, { status: 400 });
  }
  const { billingKey } = snap.data() as { billingKey: string };

  try {
    const result = await chargeBillingKey({
      billingKey,
      orderName,
      amountWon: amountWon!,
      customerId: uid,
      customData: { uid, source: "billing-charge-skeleton" },
    });

    await billingKeyRef.collection("charges").add({
      paymentId: result.paymentId,
      amountWon,
      orderName,
      paidAt: result.paidAt,
      pgTxId: result.pgTxId,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[billing] payWithBillingKey 실패", billingKeyId, error);
    const message = error instanceof Error ? error.message : "빌링키 결제에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
