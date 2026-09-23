import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { scanReadings } from "@/lib/moderation";
import { countAllowancesForCombo, type ComboKey } from "@/lib/countPassPackages";

const REVIEW_SCAN_LIMIT = 100;

function byNewest<T extends { createdAt: string }>(a: T, b: T) {
  return b.createdAt.localeCompare(a.createdAt);
}

/** remaining은 "남은 횟수"가 아니라 전체 이용권 대비 남은 비율(1.0=100%, src/lib/tarot/pricing.ts의
 * availableCount/remainingAfterUse 참고) — 관리자 화면에서는 그 원시값 대신, 가장 저렴한 스프레드
 * (원카드) 기준으로 환산한 실제 잔여 횟수를 보여준다. combo:"any"(가입 무료체험)는 옵션과 무관하게
 * 모든 스프레드가 같은 횟수로 고정돼 있어 어느 키를 골라도 같은 값이 나온다. */
function remainingCount(data: Record<string, unknown>): number | null {
  const remaining = typeof data.remaining === "number" ? data.remaining : null;
  if (remaining === null) return null;

  const allowances = data.allowances as Record<string, number> | undefined;
  const combo = typeof data.combo === "string" ? data.combo : null;
  const basis = typeof data.basis === "number" ? data.basis : null;

  const oneCardAllowance =
    allowances?.one ??
    allowances?.["one-0-0"] ??
    (combo && combo !== "any" && basis !== null ? countAllowancesForCombo(basis, combo as ComboKey).one : undefined);

  return typeof oneCardAllowance === "number" ? Math.max(0, Math.round(remaining * oneCardAllowance)) : null;
}

type PassSourceType = "countPass" | "timePass" | "pendingReward";

function toPassItem(id: string, data: Record<string, unknown>, type: PassSourceType) {
  return {
    id,
    type,
    // 시간제 이용권은 source 를 안 쓴다(fulfill.ts 가 구매분만 만든다) — 없으면 구매분이다.
    source: typeof data.source === "string" ? data.source : "purchase",
    // 구매분을 환불하려면 결제 건을 알아야 한다. 이용권 문서가 이미 들고 있다.
    paymentId: typeof data.paymentId === "string" ? data.paymentId : null,
    status: typeof data.status === "string" ? data.status : "unknown",
    combo: typeof data.combo === "string" ? data.combo : null,
    minutes: typeof data.minutes === "number" ? data.minutes : null,
    remainingCount: remainingCount(data),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
    usableUntil: typeof data.usableUntil === "string" ? data.usableUntil : null,
  };
}

/** 사용자 행을 펼칠 때만 호출한다. 무료처리/부정요청 등 검토가 필요한 리딩만(방마다 최근
 * REVIEW_SCAN_LIMIT건 범위) 반환하며, 일반 리딩은 목록에서 제외한다. */
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
    const [{ noChargeCount, flagged }, paymentsSnap, countPassesSnap, timePassesSnap, pendingRewardsSnap, suspensionLogSnap] =
      await Promise.all([
        scanReadings(uid, REVIEW_SCAN_LIMIT),
        userRef.collection("payments").get(),
        userRef.collection("countPasses").get(),
        userRef.collection("timePasses").get(),
        userRef.collection("pendingRewards").get(),
        userRef.collection("suspensionLog").get(),
      ]);

    const reviewReadings = flagged.slice(0, REVIEW_SCAN_LIMIT);
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
      reviewReadings,
      reviewReadingsTotal: noChargeCount,
      purchasedPasses: [
        ...countPassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data(), "countPass")).filter((pass) => pass.source === "purchase"),
        ...timePassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data(), "timePass")).filter((pass) => pass.source === "purchase"),
      ].sort(byNewest),
      rewardPasses: [
        ...countPassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data(), "countPass")).filter((pass) => pass.source !== "purchase"),
        ...timePassesSnap.docs.map((pass) => toPassItem(pass.id, pass.data(), "timePass")).filter((pass) => pass.source !== "purchase"),
        ...pendingRewardsSnap.docs.map((reward) => toPassItem(reward.id, reward.data(), "pendingReward")),
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
