import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { portone } from "@/lib/payment/portone";

/** 환불 가능 기간(결제일로부터). 본체 `src/lib/payment/refundPolicy.ts` 의 값과 손으로 맞춘다 —
 *  admin 은 별도 앱이라 그 파일을 import 할 수 없다. */
export const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type RefundExecuteResult =
  | { ok: true; cancellation: unknown }
  | { ok: false; status: number; error: string };

/** 환불을 실제로 실행한다 — 포트원 결제 취소 + 결제·이용권·환불요청 문서 갱신.
 *
 *  운영자가 어드민에서 누르는 경로와 2영업일 뒤 자동 승인이 같은 함수를 쓴다. 예전에는 라우트
 *  안에 인라인으로 있었는데, 자동 승인이 생기면서 "돈을 움직이는 코드"가 두 벌이 될 뻔했다
 *  (2026-09-24 분리).
 *
 *  `approvedBy` 가 null 이면 자동 승인이다 — 문서에 사람 uid 대신 그 사실을 남긴다. */
export async function executeRefund(input: {
  uid: string;
  paymentId: string;
  reason: string;
  approvedBy: string | null;
}): Promise<RefundExecuteResult> {
  const { uid, paymentId, reason } = input;
  const userRef = adminDb.collection("users").doc(uid);
  const paymentRef = userRef.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) return { ok: false, status: 404, error: "존재하지 않는 결제 건이에요." };

  const payment = paymentSnap.data() as {
    status: string;
    productType: "countPass" | "timePass" | "coin";
    countPassId: string | null;
    timePassId: string | null;
    paidAt: string;
  };
  if (payment.status !== "fulfilled") {
    return { ok: false, status: 409, error: `이미 처리된 결제예요(status=${payment.status}).` };
  }
  const paidAt = Date.parse(payment.paidAt);
  if (!Number.isFinite(paidAt) || Date.now() - paidAt > REFUND_WINDOW_MS || paidAt > Date.now()) {
    return { ok: false, status: 409, error: "결제 후 7일 이내의 이용권만 환불할 수 있어요." };
  }

  const passCollection =
    payment.productType === "countPass" ? "countPasses" : payment.productType === "timePass" ? "timePasses" : null;
  const passId = payment.productType === "countPass" ? payment.countPassId : payment.timePassId;
  if (!passCollection || !passId) {
    return { ok: false, status: 409, error: "현재 판매하지 않는 상품이거나 이용권 정보를 찾을 수 없어요." };
  }
  const passRef = userRef.collection(passCollection).doc(passId);
  const passSnap = await passRef.get();
  // 사용자가 환불을 신청하면 이용권이 즉시 refund_pending 으로 잠긴다(2026-09-24). 그 상태도
  // "한 번도 안 쓴" 것이므로 승인 대상이다 — unused 만 보면 사용자 요청 건을 승인할 수 없다.
  const passStatus = passSnap.data()?.status;
  if (!passSnap.exists || (passStatus !== "unused" && passStatus !== "refund_pending")) {
    return { ok: false, status: 409, error: "한 번도 사용하거나 활성화하지 않은 이용권만 환불할 수 있어요." };
  }

  let cancellation;
  try {
    const response = await portone.cancelPayment({ paymentId, reason });
    cancellation = response.cancellation;
  } catch (error) {
    console.error("[refund] cancelPayment 실패", paymentId, error);
    return { ok: false, status: 502, error: error instanceof Error ? error.message : "포트원 결제 취소에 실패했어요." };
  }

  const approvedByEmail = input.approvedBy
    ? await adminAuth.getUser(input.approvedBy).then((u) => u.email ?? null).catch(() => null)
    : null;
  const now = new Date().toISOString();
  const refundRequestRef = adminDb.collection("refundRequests").doc(paymentId);

  await adminDb.runTransaction(async (tx) => {
    const refundRequestSnap = await tx.get(refundRequestRef);
    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedByUid: input.approvedBy,
      refundedByEmail: approvedByEmail,
      refundedVia: input.approvedBy ? "admin" : "auto",
    });
    tx.update(passRef, { status: "refunded" });
    // 사용자 요청에서 시작한 건은 PG 취소와 동일한 트랜잭션에서 완료 처리한다. 취소는 됐는데
    // 요청만 대기 상태로 남는 운영상 혼선을 방지한다.
    if (refundRequestSnap.exists && refundRequestSnap.data()?.status === "pending") {
      tx.update(refundRequestRef, {
        status: "approved",
        approvedAt: now,
        approvedByUid: input.approvedBy,
        approvedVia: input.approvedBy ? "admin" : "auto",
      });
    }
  });

  return { ok: true, cancellation };
}
