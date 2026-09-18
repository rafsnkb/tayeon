import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { COMBOS, countAllowancesForCombo, type ComboKey } from "@/lib/tarot/pricing";

/** GET /api/user/pending-rewards — "받은 이용권 내역"(결제 리워드/친구초대 리워드) 목록.
 * 조회 시점에 수령 가능 기간(claimWindowExpiresAt)이 지난 미수령 건은 lazy하게 expired로
 * 전환한다(users/{uid}.activeTimePass 만료 정리와 같은 패턴, src/app/api/user/me/route.ts 참고).
 * 각 pending 항목에는 4개 조합별 예상 횟수 표를 함께 내려줘서 프론트가 그대로 선택 UI를 그릴 수
 * 있게 한다. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.collection("pendingRewards").orderBy("createdAt", "desc").get();

  const now = Date.now();
  const expiredIds: string[] = [];
  const rewards = snap.docs.map((doc) => {
    const data = doc.data();
    let status = data.status as "pending" | "claimed" | "expired";
    if (status === "pending" && new Date(data.claimWindowExpiresAt).getTime() <= now) {
      status = "expired";
      expiredIds.push(doc.id);
    }
    return {
      id: doc.id,
      source: data.source as "bonus-reward" | "referral-payout" | "referral-signup",
      recipient: data.recipient as "referrer" | "friend" | undefined,
      freePasses: data.freePasses as number,
      basis: data.basis as number,
      status,
      createdAt: data.createdAt as string,
      claimWindowExpiresAt: data.claimWindowExpiresAt as string,
      claimedAt: data.claimedAt as string | null,
      claimedCombo: data.claimedComboAndPassId?.combo as ComboKey | undefined,
      comboAllowances:
        status === "pending"
          ? Object.fromEntries(
              (Object.keys(COMBOS) as ComboKey[]).map((combo) => [
                combo,
                countAllowancesForCombo(data.basis as number, combo),
              ])
            )
          : undefined,
    };
  });

  if (expiredIds.length > 0) {
    await Promise.all(
      expiredIds.map((id) => userRef.collection("pendingRewards").doc(id).update({ status: "expired" }))
    );
  }

  return NextResponse.json({ rewards });
}
