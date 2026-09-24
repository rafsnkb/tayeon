import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, PAYMENTS, COUNT_PASSES, TIME_PASSES, REFUND_REQUESTS } from "@/lib/firestore/collections";

/**
 * 사용자가 자기 환불 요청을 거둬들인다.
 *
 * 청약철회는 권리라 접수는 쉬운데 물리는 길이 없었다 — 마음이 바뀌어도 이용권은 잠긴 채
 * 2영업일 뒤 자동 승인으로 결제가 취소됐다(2026-09-24 사용자 지시로 추가).
 *
 * 접수의 정확한 반대다. 접수가 "요청 생성 + 이용권 잠금"을 한 트랜잭션에 묶었으니, 취소도
 * "요청 종료 + 잠금 해제"를 한 트랜잭션에 묶는다. 따로 하면 요청만 사라지고 이용권이 잠긴 채
 * 남는 순간이 생기는데, 그러면 사용자는 쓰지도 환불받지도 못한다.
 *
 * 요청 문서는 지우지 않는다 — 소비자 불만·분쟁처리 기록 3년 보존 대상이라(개인정보처리방침
 * 제3조) 상태만 cancelled 로 바꾸고 TTL 이 때가 되면 지우게 둔다.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { paymentId } = await params;
  const userRef = adminDb.collection(USERS).doc(uid);
  const requestRef = adminDb.collection(REFUND_REQUESTS).doc(paymentId);
  const cancelledAt = new Date().toISOString();

  try {
    await adminDb.runTransaction(async (tx) => {
      const requestSnap = await tx.get(requestRef);
      const request = requestSnap.data();
      if (!request) throw new Error("NOT_FOUND");
      // 문서 id 가 paymentId 라 남의 요청 id 를 알면 부를 수 있다 — 소유자를 반드시 확인한다.
      if (request.uid !== uid) throw new Error("NOT_FOUND");
      // 자동 승인(매시)이 먼저 지나갔을 수 있다. 그 경우 돈은 이미 돌아갔으므로 되돌릴 수 없다.
      if (request.status !== "pending") throw new Error("ALREADY_RESOLVED");

      // 어느 이용권을 잠갔는지는 요청 문서가 아니라 **결제 문서**가 안다(countPassId/timePassId).
      // 접수 경로도 거기서 읽으므로 같은 출처를 쓴다 — 요청 쪽에 복사해 두면 두 값이 어긋날 수 있다.
      const paymentSnap = await tx.get(userRef.collection(PAYMENTS).doc(paymentId));
      const payment = paymentSnap.data();
      const collection =
        payment?.productType === "countPass" ? COUNT_PASSES : payment?.productType === "timePass" ? TIME_PASSES : null;
      const passId = payment?.productType === "countPass" ? payment?.countPassId : payment?.timePassId;
      if (!collection || typeof passId !== "string" || !passId) throw new Error("NOT_FOUND");
      const passRef = userRef.collection(collection).doc(passId);

      tx.update(requestRef, { status: "cancelled", cancelledAt, cancelledByUid: uid });
      // 접수가 unused 에서만 출발하므로(refund-requests POST) 되돌릴 자리도 unused 하나뿐이다.
      tx.update(passRef, { status: "unused", refundRequestedAt: null, refundCancelledAt: cancelledAt });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "환불 요청을 찾을 수 없어요." }, { status: 404 });
    }
    if (message === "ALREADY_RESOLVED") {
      return NextResponse.json(
        { error: "이미 처리된 환불 요청이라 취소할 수 없어요." },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
