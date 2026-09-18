import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { portone } from "@/lib/payment/portone";

const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// 환불 정책은 UI 조건이 아니라 서버에서 강제한다.
// 결제 후 7일 이내 + 횟수제 미사용 또는 시간제 미활성화인 구매 건만 취소할 수 있다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const { paymentId, reason } = (await req.json()) as { paymentId?: string; reason?: string };
  if (!paymentId || !reason?.trim()) {
    return NextResponse.json({ error: "paymentId와 reason이 필요해요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const paymentRef = userRef.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 결제 건이에요." }, { status: 404 });
  }
  const payment = paymentSnap.data() as {
    status: string;
    productType: "countPass" | "timePass" | "coin";
    countPassId: string | null;
    timePassId: string | null;
    paidAt: string;
  };

  if (payment.status !== "fulfilled") {
    return NextResponse.json(
      { error: `이미 처리된 결제예요(status=${payment.status}).` },
      { status: 409 }
    );
  }

  const paidAt = Date.parse(payment.paidAt);
  if (!Number.isFinite(paidAt) || Date.now() - paidAt > REFUND_WINDOW_MS || paidAt > Date.now()) {
    return NextResponse.json({ error: "결제 후 7일 이내의 이용권만 환불할 수 있어요." }, { status: 409 });
  }

  const passCollection = payment.productType === "countPass" ? "countPasses" : payment.productType === "timePass" ? "timePasses" : null;
  const passId = payment.productType === "countPass" ? payment.countPassId : payment.timePassId;
  if (!passCollection || !passId) {
    return NextResponse.json({ error: "현재 판매하지 않는 상품이거나 이용권 정보를 찾을 수 없어요." }, { status: 409 });
  }
  const passRef = userRef.collection(passCollection).doc(passId);
  const passSnap = await passRef.get();
  if (!passSnap.exists || passSnap.data()?.status !== "unused") {
    return NextResponse.json({ error: "한 번도 사용하거나 활성화하지 않은 이용권만 환불할 수 있어요." }, { status: 409 });
  }

  let cancellation;
  try {
    const response = await portone.cancelPayment({ paymentId, reason });
    cancellation = response.cancellation;
  } catch (error) {
    console.error("[refund] cancelPayment 실패", paymentId, error);
    const message = error instanceof Error ? error.message : "포트원 결제 취소에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const adminUser = await adminAuth.getUser(adminUid);
  const now = new Date().toISOString();
  const refundRequestRef = adminDb.collection("refundRequests").doc(paymentId);

  await adminDb.runTransaction(async (tx) => {
    const refundRequestSnap = await tx.get(refundRequestRef);
    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedByUid: adminUid,
      refundedByEmail: adminUser.email ?? null,
    });

    tx.update(passRef, { status: "refunded" });
    // 사용자 요청에서 시작한 건은 PG 취소와 동일한 트랜잭션에서 완료 처리한다. 취소는 됐는데
    // 요청만 대기 상태로 남는 운영상 혼선을 방지한다.
    if (refundRequestSnap.exists && refundRequestSnap.data()?.status === "pending") {
      tx.update(refundRequestRef, { status: "approved", approvedAt: now, approvedByUid: adminUid });
    }
  });

  return NextResponse.json({ cancellation });
}
