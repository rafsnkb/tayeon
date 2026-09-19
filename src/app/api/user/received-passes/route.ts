import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { COMBOS, countAllowancesForCombo, type ComboKey } from "@/lib/tarot/pricing";
import { USERS, PENDING_REWARDS, COUNT_PASSES } from "@/lib/firestore/collections";

type ReceivedPass = {
  id: string;
  label: string;
  status: "pending" | "claimed" | "expired";
  freePasses: number;
  basis: number;
  createdAt: string;
  claimWindowExpiresAt: string | null;
  claimedAt: string | null;
  claimedCombo?: ComboKey;
  comboAllowances?: Record<ComboKey, Record<string, number>>;
};

function sourceLabel(source: string, recipient?: string): string {
  if (source === "bonus-reward") return "결제 리워드";
  if (source === "referral-payout") return "친구 결제 리워드";
  if (source === "referral-signup") return recipient === "friend" ? "친구초대 가입 리워드" : "친구 초대 리워드";
  if (source === "admin-grant") return "운영자 지급 특별 이용권";
  return "이용권";
}

function monthLabelFromCreatedAt(createdAt: string): string {
  return String(new Date(createdAt).getMonth() + 1);
}

/** GET /api/user/received-passes — "받은 이용권 내역"(asset/Screen/SendTicketHistory.png).
 * 결제/친구초대 리워드(pendingRewards, 사용자가 조합을 골라 수령해야 함)와 운영자 지급
 * 이용권(countPasses, source:"admin-grant" — 관리자가 지급 시점에 조합까지 확정해 이미 지급 완료)을
 * 한 목록으로 병합해서 보여준다. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const [rewardsSnap, adminGrantsSnap] = await Promise.all([
    userRef.collection(PENDING_REWARDS).get(),
    userRef.collection(COUNT_PASSES).where("source", "==", "admin-grant").get(),
  ]);

  const now = Date.now();
  const rewards: ReceivedPass[] = rewardsSnap.docs.map((doc) => {
    const data = doc.data();
    const status: "pending" | "claimed" | "expired" =
      data.status === "pending" && new Date(data.claimWindowExpiresAt).getTime() <= now
        ? "expired"
        : data.status;
    return {
      id: doc.id,
      label: `${monthLabelFromCreatedAt(data.createdAt)}월 ${sourceLabel(data.source, data.recipient)}`,
      status,
      freePasses: data.freePasses,
      basis: data.basis,
      createdAt: data.createdAt,
      claimWindowExpiresAt: data.claimWindowExpiresAt ?? null,
      claimedAt: data.claimedAt ?? null,
      claimedCombo: data.claimedComboAndPassId?.combo,
      comboAllowances:
        status === "pending"
          ? (Object.fromEntries(
              (Object.keys(COMBOS) as ComboKey[]).map((combo) => [combo, countAllowancesForCombo(data.basis, combo)])
            ) as Record<ComboKey, Record<string, number>>)
          : undefined,
    };
  });

  const adminGrants: ReceivedPass[] = adminGrantsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      label: sourceLabel("admin-grant") + (data.reason ? ` · ${data.reason}` : ""),
      status: "claimed",
      freePasses: Math.round(Number(data.basis ?? 0) / 200),
      basis: data.basis,
      createdAt: data.createdAt,
      claimWindowExpiresAt: null,
      claimedAt: data.createdAt,
      claimedCombo: data.combo,
    };
  });

  const entries = [...rewards, ...adminGrants].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ entries });
}
