import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export const USER_PAGE_SIZE = 100;

type PassStatus = "unused" | "active" | "exhausted" | "expired" | "refunded" | "refund_pending" | undefined;

/** 아직 사용자가 들고 있는 이용권인가 — 상태와 유효기간을 같이 본다.
 *  본체 src/lib/tarot/pricing.ts 의 isHeldPass 와 같은 판정이다(별도 앱이라 복제). */
export function isCurrentlyHeld(data: DocumentData): boolean {
  const status = data.status as PassStatus;
  // 환불 신청 중인 이용권도 아직 사용자 소유다 — 승인 전까지는 보유로 센다.
  if (status !== "unused" && status !== "active" && status !== "refund_pending") return false;

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

async function summarizeUser(user: DocumentSnapshot): Promise<UserListItem> {
  const data = user.data();
  if (!data) throw new Error("USER_NOT_FOUND");
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

/** UID(문서 ID) 정확 일치 또는 닉네임 정확 일치로 사용자를 찾는다. */
export async function searchUsers(q: string): Promise<UserListItem[]> {
  const matches = new Map<string, DocumentSnapshot>();

  const byUid = await adminDb.collection("users").doc(q).get();
  if (byUid.exists) matches.set(byUid.id, byUid);

  const byNickname = await adminDb.collection("users").where("nickname", "==", q).limit(20).get();
  for (const doc of byNickname.docs) matches.set(doc.id, doc);

  return Promise.all(Array.from(matches.values()).map(summarizeUser));
}

