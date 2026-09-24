import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { portone } from "@/lib/payment/portone";
import { executeRefund } from "@/lib/refundExecute";
import { notifyOwner } from "@/lib/notifyOwner";
import { addBusinessDays, refundDue } from "@/lib/refundDue";
import { assessRefundRisk } from "@/lib/refundRisk";
import { constantTimeEquals } from "@/lib/constantTime";

/** 사람이 손대지 않으면 자동 승인되기까지의 영업일. 법정 기한(3영업일)보다 짧아야 의미가 있다. */
const AUTO_APPROVE_BUSINESS_DAYS = 2;
/** 한 번에 처리할 최대 건수 — 무언가 잘못돼도 한 번에 다 나가지 않게 막아 둔다. */
const BATCH_LIMIT = 20;

/**
 * 접수 후 2영업일이 지나도록 처리되지 않은 환불 요청을 자동 승인한다. 스케줄러(functions 의
 * `hourlyRefundAutoApprove`)가 매시 호출한다.
 *
 * **기본은 드라이런이다.** 판정과 알림까지만 하고 실제 결제 취소는 하지 않는다. 사람 확인 없이
 * 돈을 움직이기 시작하는 시점이라, 며칠 돌려 판정이 믿을 만한지 본 뒤 `REFUND_AUTO_APPROVE=on`
 * 으로 켠다(2026-09-24 사용자와 합의).
 *
 * 청약철회는 승인 대상이 아니라 소비자의 권리이고(전자상거래법 제17조), 미사용 이용권이면
 * 거절할 법적 근거가 없다. 자동 승인은 그 사실을 구조로 옮긴 것이다 — 사람이 늦어도 법정
 * 기한(제18조②2호, 3영업일)을 넘기지 않는다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  if (!constantTimeEquals(req.headers.get("x-internal-secret"), secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const dryRun = process.env.REFUND_AUTO_APPROVE !== "on";
  const now = new Date();

  // 오래된 것부터 본다. 정렬이 없으면 Firestore 가 문서 id(= randomUUID 인 paymentId) 순으로
  // 주는데, 그건 매 시간 **같은** 20건이라는 뜻이다. 처리되지 않고 남는 건(드라이런이면 전부)이
  // 20개만 쌓여도 그 뒤로 들어온 요청은 영원히 읽히지도 않아 알림 한 번 없이 법정 기한을
  // 넘긴다(2026-09-24). 오름차순이면 최소한 기한이 임박한 것부터 처리·통보된다.
  const pending = await adminDb
    .collection("refundRequests")
    .where("status", "==", "pending")
    .orderBy("requestedAt", "asc")
    .limit(BATCH_LIMIT)
    .get();

  const summary = { checked: pending.size, due: 0, approved: 0, held: 0, failed: 0, dryRun };

  for (const doc of pending.docs) {
    const request = doc.data();
    const requestedAt = String(request.requestedAt ?? "");
    const requested = new Date(requestedAt);
    if (Number.isNaN(requested.getTime())) continue;
    // 아직 사람이 처리할 시간이 남아 있으면 건드리지 않는다.
    if (addBusinessDays(requested, AUTO_APPROVE_BUSINESS_DAYS) > now) continue;
    summary.due += 1;

    const uid = String(request.uid ?? "");
    const paymentId = doc.id;
    const outcome = await handleOne({ uid, paymentId, request, requestedAt, dryRun });
    summary[outcome] += 1;
  }

  console.log("[refund-auto] ", JSON.stringify(summary));
  return NextResponse.json(summary);
}

async function handleOne(input: {
  uid: string;
  paymentId: string;
  request: FirebaseFirestore.DocumentData;
  requestedAt: string;
  dryRun: boolean;
}): Promise<"approved" | "held" | "failed"> {
  const { uid, paymentId, request, requestedAt, dryRun } = input;
  const userRef = adminDb.collection("users").doc(uid);

  // 판정에 필요한 것들을 모은다 — 이용권 상태, 포트원 실제 결제 상태, 이 사용자의 다른 요청.
  const paymentSnap = await userRef.collection("payments").doc(paymentId).get();
  const payment = paymentSnap.data();
  const passCollection =
    payment?.productType === "countPass" ? "countPasses" : payment?.productType === "timePass" ? "timePasses" : null;
  const passId = payment?.productType === "countPass" ? payment?.countPassId : payment?.timePassId;
  const passStatus = passCollection && passId
    ? (await userRef.collection(passCollection).doc(String(passId)).get()).data()?.status
    : undefined;
  const live = await portone.getPayment({ paymentId }).catch(() => null);
  const others = await adminDb
    .collection("refundRequests")
    .where("uid", "==", uid)
    .get()
    .then((snap) => snap.docs.filter((d) => d.id !== paymentId).map((d) => String(d.data().requestedAt ?? "")))
    .catch(() => [] as string[]);

  const risk = assessRefundRisk({
    passStatus: typeof passStatus === "string" ? passStatus : undefined,
    paymentStatus: live && "status" in live ? String(live.status) : undefined,
    paidAmount: live && "amount" in live ? (live.amount as { total?: number })?.total : undefined,
    recordedAmount: typeof payment?.priceWon === "number" ? payment.priceWon : undefined,
    paidAt: typeof payment?.paidAt === "string" ? payment.paidAt : undefined,
    requestedAt,
    otherRequestedAt: others,
  });

  const due = refundDue(requestedAt);
  const won = Number(request.priceWon ?? 0).toLocaleString("ko-KR");
  const product = String(request.orderName ?? request.productId ?? "-");
  const common = {
    fields: [
      ["상품", product],
      ["요청자", uid],
      ["사유", String(request.reason ?? "").slice(0, 300)],
      ["접수", requestedAt],
      ["법정 마감", due ? `${due.dueAt.toISOString()} (남은 ${due.businessDaysLeft}영업일)` : "-"],
    ] as [string, string][],
    link: { label: "어드민에서 처리", url: `${process.env.ADMIN_BASE_URL ?? ""}/refund-requests` },
  };

  if (risk.hold) {
    await notifyOwner({
      key: `refund-hold/${paymentId}`,
      level: due?.overdue ? "urgent" : "warn",
      title: `자동 승인 보류 · ${won}원`,
      note: `**⚠️ 이상 징후 ${risk.reasons.length}건 — 직접 확인해 주세요.**\n`
        + risk.reasons.map((r) => `· ${r}`).join("\n"),
      ...common,
    });
    return "held";
  }

  if (dryRun) {
    await notifyOwner({
      key: `refund-dryrun/${paymentId}`,
      level: "warn",
      title: `자동 승인 대상 · ${won}원`,
      note: "**드라이런이라 실제 취소는 하지 않았습니다.** 이상 징후는 없습니다 — 어드민에서 직접 승인해 주세요.\n"
        + "(`REFUND_AUTO_APPROVE=on` 을 켜면 이 건은 자동으로 취소됩니다.)",
      ...common,
    });
    return "held";
  }

  const result = await executeRefund({
    uid,
    paymentId,
    reason: `환불 요청 접수 후 ${AUTO_APPROVE_BUSINESS_DAYS}영업일 경과 — 자동 승인`,
    approvedBy: null,
  });
  if (!result.ok) {
    await notifyOwner({
      key: `refund-failed/${paymentId}/${new Date().toISOString().slice(0, 13)}`,
      level: "urgent",
      title: `자동 승인 실패 · ${won}원`,
      note: `**🚨 자동 취소가 실패했습니다. 수동 처리가 필요합니다.**\n· ${result.error}`,
      ...common,
    });
    return "failed";
  }
  await notifyOwner({
    key: `refund-approved/${paymentId}`,
    level: "info",
    title: `자동 승인 완료 · ${won}원`,
    ...common,
  });
  return "approved";
}
