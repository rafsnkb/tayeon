import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, PAYMENTS, COUNT_PASSES, TIME_PASSES, REFUND_REQUESTS } from "@/lib/firestore/collections";
import { REFUND_WINDOW_DAYS } from "@/lib/payment/refundPolicy";
import { DISPUTE_RECORD_RETENTION_MONTHS } from "@/lib/legal/retention";
import { retentionExpiresAt } from "@/lib/legal/retentionTimestamp";
import { notifyOwner } from "@/lib/notify/owner";
import { assessRefundRisk } from "@/lib/payment/refundRisk";
import { addBusinessDays, refundDue, REFUND_AUTO_APPROVE_BUSINESS_DAYS } from "@/lib/util/businessDays";
import { ADMIN_REFUND_REQUESTS_URL } from "@/lib/company";

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
  if (!passCollection || !passId) return NextResponse.json({ error: "미사용 이용권만 환불을 요청할 수 있어요." }, { status: 409 });
  const passRef = userRef.collection(passCollection).doc(passId);
  const requestRef = adminDb.collection(REFUND_REQUESTS).doc(paymentId);
  const requestedAt = new Date().toISOString();
  try {
    // 요청 접수와 이용권 잠금을 한 트랜잭션에 묶는다. 따로 하면 접수만 되고 이용권은 멀쩡한
    // 순간이 생기고, 그 틈에 쓰면 "요청 → 사용 → 환불"로 공짜가 된다.
    await adminDb.runTransaction(async (tx) => {
      const [passSnap, existingSnap] = await Promise.all([tx.get(passRef), tx.get(requestRef)]);
      if (passSnap.data()?.status !== "unused") throw new Error("PASS_NOT_UNUSED");
      // 거절된 건은 다시 요청할 수 있다. 청약철회는 소비자의 권리라 한 번 거절됐다고 막으면
      // 권리 행사를 막는 것이 된다(약관 제9조3항 — 제17조②에 해당할 때만 거절 가능).
      // 이전 시도는 지우지 않고 history 에 쌓는다 — 분쟁처리 기록 3년 보존 대상이다.
      const existing = existingSnap.data();
      if (existing && existing.status !== "rejected") throw new Error("ALREADY_PENDING");
      const history = Array.isArray(existing?.history) ? existing.history : [];
      if (existing) {
        history.push({
          reason: existing.reason ?? null,
          requestedAt: existing.requestedAt ?? null,
          status: existing.status ?? null,
          rejectedAt: existing.rejectedAt ?? null,
          rejectionReason: existing.rejectionReason ?? null,
        });
      }
      const write = existing ? tx.set.bind(tx) : tx.create.bind(tx);
      write(requestRef, { uid, paymentId, reason: reason.trim().slice(0, 1000), status: "pending", requestedAt,
        history, attempt: history.length + 1,
        rejectedAt: null, rejectionReason: null, rejectedByUid: null,
        // 소비자 불만·분쟁처리 기록 3년(개인정보처리방침 제3조).
        expiresAt: retentionExpiresAt(requestedAt, DISPUTE_RECORD_RETENTION_MONTHS), productId: payment.productId ?? null, orderName: payment.orderName ?? null, productType: payment.productType ?? null, priceWon: payment.priceWon ?? 0, paidAt: payment.paidAt ?? null, paymentMethod: payment.paymentMethod ?? null });
      // 승인 전까지 못 쓰게 잠근다. "쓸 수 있는가"를 묻는 검사는 전부 unused/active 만 보므로
      // 이 값이 되는 순간 목록에서도 사라지고 활성화도 막힌다. 거절되면 unused 로 되돌린다
      // (admin/src/app/api/admin/refund-requests/[id]/reject).
      tx.update(passRef, { status: "refund_pending", refundRequestedAt: requestedAt });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PASS_NOT_UNUSED") return NextResponse.json({ error: "미사용 이용권만 환불을 요청할 수 있어요." }, { status: 409 });
    if (error instanceof Error && error.message === "ALREADY_PENDING") return NextResponse.json({ error: "이미 환불 요청이 접수되어 있어요." }, { status: 409 });
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : null;
    if (code === 6 || code === "already-exists") return NextResponse.json({ error: "이미 환불 요청이 접수되어 있어요." }, { status: 409 });
    throw error;
  }
  // 접수 사실을 운영자에게 알린다. 자동 승인(2영업일)이 사람 확인 없이 실제 결제를 취소하므로,
  // 그 전에 알림이 반드시 가야 한다. 실패해도 접수 자체는 이미 끝났으므로 응답을 막지 않는다.
  void notifyRefundRequested({ uid, paymentId, payment, reason: reason.trim(), requestedAt });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** 접수 알림. 이상 징후가 이미 보이면 "자동 승인 보류 예정"으로 등급을 올려 메일까지 보낸다. */
async function notifyRefundRequested(input: {
  uid: string;
  paymentId: string;
  payment: FirebaseFirestore.DocumentData;
  reason: string;
  requestedAt: string;
}) {
  const { uid, paymentId, payment, reason, requestedAt } = input;
  // 접수 시점에 알 수 있는 것만 본다 — 포트원 재조회는 자동 승인 때 다시 한다.
  const others = await adminDb
    .collection(REFUND_REQUESTS)
    .where("uid", "==", uid)
    .get()
    .then((snap) => snap.docs.filter((doc) => doc.id !== paymentId).map((doc) => String(doc.data().requestedAt ?? "")))
    .catch(() => [] as string[]);
  const risk = assessRefundRisk({
    passStatus: "refund_pending",
    paymentStatus: "PAID",
    paidAmount: payment.priceWon,
    recordedAmount: payment.priceWon,
    paidAt: payment.paidAt,
    requestedAt,
    otherRequestedAt: others,
  });
  const due = refundDue(requestedAt);
  const autoAt = addBusinessDays(new Date(requestedAt), REFUND_AUTO_APPROVE_BUSINESS_DAYS);
  const when = (d: Date) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }).format(d);

  await notifyOwner({
    key: `refund-requested/${paymentId}`,
    level: risk.hold ? "warn" : "info",
    title: `환불 요청 접수 · ${Number(payment.priceWon ?? 0).toLocaleString("ko-KR")}원`,
    fields: [
      ["상품", String(payment.orderName ?? payment.productId ?? "-")],
      ["요청자", uid],
      ["사유", reason.slice(0, 300)],
      ["접수", when(new Date(requestedAt))],
      ["자동 승인", risk.hold ? "보류 — 아래 사유" : when(autoAt)],
      ["법정 마감", due ? `${when(due.dueAt)} (3영업일)` : "-"],
    ],
    note: risk.hold
      ? `**⚠️ 이상 징후 ${risk.reasons.length}건 — 자동 승인이 보류됩니다. 직접 처리해 주세요.**\n`
        + risk.reasons.map((r) => `· ${r}`).join("\n")
      : undefined,
    link: { label: "어드민에서 처리", url: ADMIN_REFUND_REQUESTS_URL },
  });
}

/** GET /api/user/refund-requests — 내 환불 요청의 진행 상황.
 *
 * 알림 목록(/notifications)이 "이용권 도착"만 보여주고 있어서, 환불을 신청해도 앱 안에
 * 아무 흔적이 남지 않았다(2026-09-24 사용자 지적). 결제 내역 화면은 배지로 보여주지만
 * 그건 찾아 들어가야 보인다.
 *
 * 접수·거절·완료를 각각 하나의 알림 항목으로 펼쳐서 돌려준다 — 한 요청이 거절됐다가 다시
 * 접수되면 둘 다 보여야 하므로 history 도 같이 훑는다. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const snap = await adminDb.collection(REFUND_REQUESTS).where("uid", "==", uid).get();
  const entries: { id: string; source: string; label: string; createdAt: string; detail?: string }[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = String(data.orderName ?? data.productId ?? "이용권");
    const past = Array.isArray(data.history) ? data.history : [];

    // 지난 시도(거절된 것들)를 먼저 펼친다.
    past.forEach((item: Record<string, unknown>, index: number) => {
      if (typeof item.requestedAt === "string") {
        entries.push({ id: `${doc.id}:h${index}:requested`, source: "refund-requested", label: name, createdAt: item.requestedAt });
      }
      if (typeof item.rejectedAt === "string") {
        entries.push({
          id: `${doc.id}:h${index}:rejected`, source: "refund-rejected", label: name,
          createdAt: item.rejectedAt,
          detail: typeof item.rejectionReason === "string" ? item.rejectionReason : undefined,
        });
      }
    });

    if (typeof data.requestedAt === "string") {
      entries.push({ id: `${doc.id}:requested`, source: "refund-requested", label: name, createdAt: data.requestedAt });
    }
    if (data.status === "rejected" && typeof data.rejectedAt === "string") {
      entries.push({
        id: `${doc.id}:rejected`, source: "refund-rejected", label: name,
        createdAt: data.rejectedAt,
        detail: typeof data.rejectionReason === "string" ? data.rejectionReason : undefined,
      });
    }
    if (data.status === "approved" && typeof data.approvedAt === "string") {
      entries.push({ id: `${doc.id}:approved`, source: "refund-approved", label: name, createdAt: data.approvedAt });
    }
  }

  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ entries });
}
