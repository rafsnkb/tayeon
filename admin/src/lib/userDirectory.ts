import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const USER_PAGE_SIZE = 100;

type PassStatus = "unused" | "active" | "exhausted" | "expired" | "refunded" | undefined;

function isCurrentlyHeld(data: DocumentData): boolean {
  const status = data.status as PassStatus;
  if (status !== "unused" && status !== "active") return false;

  const expiresAt = data.expiresAt ?? data.usableUntil;
  return !expiresAt || Date.parse(String(expiresAt)) > Date.now();
}

function sourceIs(data: DocumentData, source: string): boolean {
  return data.source === source && isCurrentlyHeld(data);
}

export type UserListItem = {
  uid: string;
  nickname: string | null;
  status: "normal" | "suspended";
  suspendedAt: string | null;
  suspendedUntil: string | null;
  paymentTotalWon: number;
  refundTotalWon: number;
  countPasses: { held: number; active: number };
  timePasses: { held: number; active: number };
  bonusRewardPasses: number;
  friendInvitePasses: number;
};

async function summarizeUser(user: QueryDocumentSnapshot): Promise<UserListItem> {
  const userRef = user.ref;
  const [paymentsSnap, countPassesSnap, timePassesSnap, pendingRewardsSnap] = await Promise.all([
    userRef.collection("payments").get(),
    userRef.collection("countPasses").get(),
    userRef.collection("timePasses").get(),
    userRef.collection("pendingRewards").get(),
  ]);

  let paymentTotalWon = 0;
  let refundTotalWon = 0;
  for (const payment of paymentsSnap.docs) {
    const data = payment.data();
    // 테스트 결제와 이전 코인 결제는 운영 집계에서 제외한다.
    if (data.channelType !== "LIVE" || data.isTest === true) continue;
    const priceWon = Number(data.priceWon ?? 0);
    paymentTotalWon += priceWon;
    if (data.status === "refunded") refundTotalWon += priceWon;
  }

  const heldCountPasses = countPassesSnap.docs.filter((pass) => isCurrentlyHeld(pass.data()));
  const heldTimePasses = timePassesSnap.docs.filter((pass) => isCurrentlyHeld(pass.data()));
  const rewardPasses = heldCountPasses.filter((pass) => pass.data().source !== "purchase");
  const pendingRewards = pendingRewardsSnap.docs.filter((reward) => reward.data().status === "pending");

  const data = user.data();
  return {
    uid: user.id,
    nickname: data.nickname ?? null,
    status: data.suspended ? "suspended" : "normal",
    suspendedAt: data.suspendedAt ?? null,
    suspendedUntil: data.suspendedUntil ?? null,
    paymentTotalWon,
    refundTotalWon,
    countPasses: {
      held: heldCountPasses.length,
      active: heldCountPasses.filter((pass) => pass.data().status === "active").length,
    },
    timePasses: {
      held: heldTimePasses.length,
      active: heldTimePasses.filter((pass) => pass.data().status === "active").length,
    },
    bonusRewardPasses:
      rewardPasses.filter((pass) => sourceIs(pass.data(), "bonus-reward")).length +
      pendingRewards.filter((reward) => reward.data().source === "bonus-reward").length,
    friendInvitePasses:
      rewardPasses.filter(
        (pass) => sourceIs(pass.data(), "referral-signup") || sourceIs(pass.data(), "referral-payout")
      ).length +
      pendingRewards.filter(
        (reward) => reward.data().source === "referral-signup" || reward.data().source === "referral-payout"
      ).length,
  };
}

/** 목록은 UID 순서로 안정적으로 페이지를 나눈다. createdAt이 없는 기존 계정도 누락되지 않는다. */
export async function getUserPage(cursor: string | null) {
  let query = adminDb.collection("users").orderBy("__name__").limit(USER_PAGE_SIZE);
  if (cursor) {
    const cursorSnap = await adminDb.collection("users").doc(cursor).get();
    if (!cursorSnap.exists) throw new Error("INVALID_CURSOR");
    query = query.startAfter(cursorSnap);
  }

  const snapshot = await query.get();
  const users = await Promise.all(snapshot.docs.map(summarizeUser));
  return {
    users,
    nextCursor: snapshot.size === USER_PAGE_SIZE ? snapshot.docs.at(-1)?.id ?? null : null,
  };
}

