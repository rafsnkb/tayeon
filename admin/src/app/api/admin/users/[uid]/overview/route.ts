import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

const RECENT_READING_LIMIT = 20;

function byNewest<T extends { createdAt: string }>(a: T, b: T) {
  return b.createdAt.localeCompare(a.createdAt);
}

function toPassItem(id: string, data: Record<string, unknown>) {
  return {
    id,
    source: typeof data.source === "string" ? data.source : "purchase",
    status: typeof data.status === "string" ? data.status : "unknown",
    combo: typeof data.combo === "string" ? data.combo : null,
    minutes: typeof data.minutes === "number" ? data.minutes : null,
    remaining: typeof data.remaining === "number" ? data.remaining : null,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
    usableUntil: typeof data.usableUntil === "string" ? data.usableUntil : null,
  };
}

/** 사용자 행을 펼칠 때만 호출한다. 최근 리딩은 사용자 전체에서 최신 20건만 반환한다. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return NextResponse.json({ error: "존재하지 않는 사용자입니다." }, { status: 404 });

  try {
    const roomsSnap = await userRef.collection("rooms").get();
    const [readingsByRoom, paymentsSnap, countPassesSnap, timePassesSnap, pendingRewardsSnap, suspensionLogSnap] =
      await Promise.all([
        Promise.all(
          roomsSnap.docs.map(async (room) => {
            const readings = await room.ref.collection("readings").orderBy("createdAt", "desc").limit(RECENT_READING_LIMIT).get();
            return readings.docs.map((reading) => {
              const data = reading.data();
              return {
                id: reading.id,
                roomId: room.id,
                roomTitle: room.data().title ?? "새 대화",
                question: data.question ?? "",
                createdAt: data.createdAt ?? "",
                charged: data.charged !== false,
                flaggedForAbuse: data.flaggedForAbuse === true,
                topic: data.topic ?? null,
              };
            });
          })
        ),
        userRef.collection("payments").get(),
        userRef.collection("countPasses").get(),
        userRef.collection("timePasses").get(),
        userRef.collection("pendingRewards").get(),
        userRef.collection("suspensionLog").get(),
      ]);

    const recentReadings = readingsByRoom.flat().sort(byNewest).slice(0, RECENT_READING_LIMIT);
    const livePayments = paymentsSnap.docs
      .map((payment) => ({ id: payment.id, data: payment.data() as Record<string, unknown> }))
      .filter((payment) => payment.data.channelType === "LIVE" && payment.data.isTest !== true)
      .sort((a, b) => String(b.data.paidAt ?? b.data.fulfilledAt ?? "").localeCompare(String(a.data.paidAt ?? a.data.fulfilledAt ?? "")))
      .map((payment) => ({
        id: payment.id,
        productId: payment.data.productId ?? null,
        productType: payment.data.productType ?? null,
        orderName: payment.data.orderName ?? null,
        priceWon: Number(payment.data.priceWon ?? 0),
        status: payment.data.status ?? "unknown",
        paidAt: payment.data.paidAt ?? payment.data.fulfilledAt ?? null,
        refundedAt: payment.data.refundedAt ?? null,
      }));

    return NextResponse.json({
      recentReadings,
      recentFreeReadings: recentReadings.filter((reading) => !reading.charged).length,
      purchasedPasses: [
        ...countPassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data())).filter((pass) => pass.source === "purchase"),
        ...timePassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data())).filter((pass) => pass.source === "purchase"),
      ].sort(byNewest),
      rewardPasses: [
        ...countPassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data())).filter((pass) => pass.source !== "purchase"),
        ...pendingRewardsSnap.docs.map((reward) => toPassItem(reward.id, reward.data())),
      ].sort(byNewest),
      livePayments,
      suspensionLog: suspensionLogSnap.docs
        .map((log) => ({ id: log.id, data: log.data() as Record<string, unknown> }))
        .sort((a, b) => String(b.data.createdAt ?? b.data.suspendedAt ?? "").localeCompare(String(a.data.createdAt ?? a.data.suspendedAt ?? "")))
        .map((log) => ({
          id: log.id,
          action: log.data.action ?? (log.data.suspended ? "suspended" : "unsuspended"),
          reason: log.data.reason ?? null,
          durationDays: typeof log.data.durationDays === "number" ? log.data.durationDays : null,
          suspendedUntil: typeof log.data.suspendedUntil === "string" ? log.data.suspendedUntil : null,
          createdAt: log.data.createdAt ?? log.data.suspendedAt ?? null,
        })),
    });
  } catch (error) {
    console.error("[admin/users/overview] 사용자 상세 조회 실패", { uid, error });
    return NextResponse.json({ error: "사용자 상세 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
