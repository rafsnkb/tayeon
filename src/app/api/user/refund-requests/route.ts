import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, PAYMENTS, COUNT_PASSES, TIME_PASSES, REFUND_REQUESTS } from "@/lib/firestore/collections";
import { REFUND_WINDOW_DAYS } from "@/lib/payment/refundPolicy";
import { DISPUTE_RECORD_RETENTION_MONTHS, retentionExpiresAt } from "@/lib/legal/retention";

const WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** 사용자의 환불 요청. 승인 시점에도 admin API가 동일 조건을 다시 검사한다. */
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { paymentId, reason } = (await req.json().catch(() => ({}))) as { paymentId?: string; reason?: string };
  if (!paymentId || !reason?.trim()) return NextResponse.json({ error: "환불 사유를 입력해주세요." }, { status: 400 });
  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentRef = userRef.collection(PAYMENTS).doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) return NextResponse.json({ error: "결제 내역을 찾을 수 없어요." }, { status: 404 });
  const payment = paymentSnap.data()!;
  const paidAt = Date.parse(payment.paidAt ?? "");
  if (payment.status !== "fulfilled" || !Number.isFinite(paidAt) || paidAt > Date.now() || Date.now() - paidAt > WINDOW_MS) return NextResponse.json({ error: "환불 가능 기간이 지났어요." }, { status: 409 });
  const passCollection = payment.productType === "countPass" ? COUNT_PASSES : payment.productType === "timePass" ? TIME_PASSES : null;
  const passId = payment.productType === "countPass" ? payment.countPassId : payment.timePassId;
  if (!passCollection || !passId || (await userRef.collection(passCollection).doc(passId).get()).data()?.status !== "unused") return NextResponse.json({ error: "미사용 이용권만 환불을 요청할 수 있어요." }, { status: 409 });
  const requestRef = adminDb.collection(REFUND_REQUESTS).doc(paymentId);
  try {
    const requestedAt = new Date().toISOString();
    await requestRef.create({ uid, paymentId, reason: reason.trim().slice(0, 1000), status: "pending", requestedAt,
      // 소비자 불만·분쟁처리 기록 3년(개인정보처리방침 제3조).
      expiresAt: retentionExpiresAt(requestedAt, DISPUTE_RECORD_RETENTION_MONTHS), productId: payment.productId ?? null, orderName: payment.orderName ?? null, productType: payment.productType ?? null, priceWon: payment.priceWon ?? 0, paidAt: payment.paidAt ?? null, paymentMethod: payment.paymentMethod ?? null });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : null;
    if (code === 6 || code === "already-exists") return NextResponse.json({ error: "이미 환불 요청이 접수되어 있어요." }, { status: 409 });
    throw error;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
