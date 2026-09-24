import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUid = await getAdminUidFromRequest(req); if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params; const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || !reason.trim()) return NextResponse.json({ error: "거절 사유를 입력해주세요." }, { status: 400 });
  const ref = adminDb.collection("refundRequests").doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data()?.status !== "pending") return NextResponse.json({ error: "처리할 수 없는 요청입니다." }, { status: 409 });
  const request = snap.data()!;
  // 신청 시점에 이용권을 refund_pending 으로 잠가 뒀다(src/app/api/user/refund-requests).
  // 거절했으면 다시 쓸 수 있어야 한다 — 안 풀어 주면 돈은 받았는데 못 쓰는 이용권이 된다.
  // 이용권 id 는 요청 문서에 없어서 결제 문서에서 찾는다.
  const userRef = adminDb.collection("users").doc(String(request.uid));
  const paymentData = (await userRef.collection("payments").doc(id).get()).data();
  const passCollection = paymentData?.productType === "countPass" ? "countPasses" : paymentData?.productType === "timePass" ? "timePasses" : null;
  const passId = paymentData?.productType === "countPass" ? paymentData?.countPassId : paymentData?.timePassId;
  const rejectedAt = new Date().toISOString();
  const passRef = passCollection && passId ? userRef.collection(passCollection).doc(String(passId)) : null;
  const rejected = await adminDb.runTransaction(async (tx) => {
    // Firestore 트랜잭션은 모든 읽기가 모든 쓰기보다 앞서야 한다 — 읽기를 먼저 끝낸다.
    // 위 .get() 과 여기 사이에 자동 승인이 끼어들어 이미 환불했을 수 있다. 그때 거절로
    // 덮어쓰면 "돈은 돌려줬는데 기록은 거절"이 된다 — 트랜잭션 안에서 다시 확인한다(2026-09-24).
    const [freshSnap, passSnapTx] = await Promise.all([tx.get(ref), passRef ? tx.get(passRef) : Promise.resolve(null)]);
    if (freshSnap.data()?.status !== "pending") return false;
    const passStatus = passSnapTx?.data()?.status;
    tx.update(ref, { status: "rejected", rejectedAt, rejectedByUid: adminUid, rejectionReason: reason.trim().slice(0, 1000) });
    // 그 사이 다른 경로로 상태가 바뀐 이용권(웹훅 취소 등)은 건드리지 않는다.
    if (passRef && passStatus === "refund_pending") {
      tx.update(passRef, { status: "unused", refundRequestedAt: null, refundRejectedAt: rejectedAt });
    }
    return true;
  });
  if (!rejected) return NextResponse.json({ error: "그 사이 다른 경로로 처리된 요청입니다." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
