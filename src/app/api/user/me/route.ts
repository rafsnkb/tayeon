import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { DEFAULT_TONE } from "@/lib/tarot/tone";
import { pickActiveCountPass } from "@/lib/tarot/activeCountPass";
import type { ComboKey, CountPassStatus } from "@/lib/tarot/pricing";
import { USERS, TIME_PASSES, COUNT_PASSES, PENDING_REWARDS, REFUND_REQUESTS } from "@/lib/firestore/collections";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const snap = await userRef.get();
  const data = snap.data();

  let activeTimePass = data?.activeTimePass as
    | { passId: string; minutes: number; combo?: ComboKey; includesOptions?: boolean; startedAt: string; expiresAt: string }
    | null
    | undefined;
  if (activeTimePass && new Date(activeTimePass.expiresAt).getTime() <= Date.now()) {
    // Lazy cleanup: the pass ran out since it was started. This is display bookkeeping only —
    // /api/tarot/reading independently re-checks expiresAt against "now" on every request, so
    // billing correctness never depends on this write actually happening.
    await Promise.all([
      userRef.update({ activeTimePass: null }),
      userRef.collection(TIME_PASSES).doc(activeTimePass.passId).update({ status: "expired" }),
    ]);
    activeTimePass = null;
  }

  const timePassesSnap = await userRef
    .collection(TIME_PASSES)
    .where("status", "==", "unused")
    .get();
  const timePasses = timePassesSnap.docs
    .filter((doc) => {
      const usableUntil = doc.data().usableUntil;
      return typeof usableUntil !== "string" || new Date(usableUntil).getTime() > Date.now();
    })
    .map((doc) => ({
      id: doc.id,
      minutes: doc.data().minutes,
      combo: (doc.data().combo as ComboKey | undefined) ?? (doc.data().includesOptions ? "tarot-saju-ziwei" : "tarot"),
    }));

  const [countPassesSnap, pendingRewardsSnap] = await Promise.all([
    userRef.collection(COUNT_PASSES).get(),
    userRef.collection(PENDING_REWARDS).get(),
  ]);
  const activePointerPassId = data?.activeCountPass?.passId as string | undefined;
  const activePass = pickActiveCountPass(countPassesSnap.docs, activePointerPassId);
  const activeCountPass = activePass
    ? {
        passId: activePass.id,
        combo: activePass.data().combo as ComboKey | "any",
        basis: activePass.data().basis as number,
        remaining: activePass.data().remaining as number,
        expiresAt: (activePass.data().expiresAt as string | null | undefined) ?? null,
        source: activePass.data().source as string | undefined,
        productId: activePass.data().productId as string | undefined,
      }
    : null;

  const countPasses = countPassesSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as {
      id: string;
      remaining: number;
      expiresAt?: string | null;
      basis: number;
      productId?: string;
      source?: string;
      createdAt: string;
      combo: ComboKey | "any";
      status: CountPassStatus;
      allowances: Record<string, number>;
    }))
    .filter(
      (pass) =>
        Number(pass.remaining) > 0 &&
        (pass.status === "unused" || pass.status === "active") &&
        (!pass.expiresAt || new Date(pass.expiresAt).getTime() > Date.now())
    );

  // 알림(운영자 지급/리워드 도착) 배지 — asset/Screen/Notification.png. "받은 이용권 내역"
  // (/api/user/received-passes)과 같은 두 소스(admin-grant countPasses + pendingRewards)를
  // 훑어서, 마지막으로 알림을 확인한 시각(notificationsSeenAt) 이후 새로 생긴 게 있으면 켠다.
  const notificationsSeenAt = data?.notificationsSeenAt as string | undefined;
  // 환불 진행(접수/거절/완료)도 알림 목록에 뜨므로 배지 판단에 같이 넣는다 — 목록에는
  // 보이는데 점이 안 켜지면 사용자는 새 알림이 온 걸 모른다(2026-09-24).
  const refundSnap = await adminDb
    .collection(REFUND_REQUESTS)
    .where("uid", "==", uid)
    .get()
    .catch(() => null);
  const notifiableCreatedAts = [
    ...countPassesSnap.docs.filter((doc) => doc.data().source === "admin-grant").map((doc) => doc.data().createdAt as string),
    ...pendingRewardsSnap.docs.map((doc) => doc.data().createdAt as string),
    ...(refundSnap?.docs.flatMap((doc) => {
      const data = doc.data();
      return [data.requestedAt, data.rejectedAt, data.approvedAt].filter((v): v is string => typeof v === "string");
    }) ?? []),
  ];
  const hasUnreadNotifications = notifiableCreatedAts.some(
    (createdAt) => typeof createdAt === "string" && (!notificationsSeenAt || createdAt > notificationsSeenAt)
  );

  return NextResponse.json({
    hasUnreadNotifications,
    nickname: data?.nickname ?? null,
    profileImage: data?.profileImage ?? null,
    email: data?.email ?? null,
    termsAgreedAt: data?.termsAgreedAt ?? null,
    countPasses,
    activeCountPass,
    tone: data?.tone ?? DEFAULT_TONE,
    useReversedCards: data?.useReversedCards ?? true,
    birthInfo: data?.birthInfo ?? null,
    partner: data?.partner ?? null,
    activeTimePass: activeTimePass
      ? { ...activeTimePass, combo: activeTimePass.combo ?? (activeTimePass.includesOptions ? "tarot-saju-ziwei" : "tarot") }
      : null,
    timePasses,
  });
}
