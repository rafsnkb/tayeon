import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { bonusRewardRateForWon, rewardPassesForWon } from "@/lib/tarot/pricing";
import { USERS, PAYMENTS } from "@/lib/firestore/collections";

/** 피그마 "Screen / RewardInfoModal", MyPage "n월 보너스 리워드" — 아직 정산 전인 이번 달의
 * 실시간 예상치를 보여준다. 실제 지급은 functions/src/index.ts의 monthlyBonusRewardPayout이
 * 다음달 5일에 처리한다(이 라우트는 조회만, 지급은 하지 않음). */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // functions/src/index.ts의 monthlyReferralPayout과 동일한 KST 보정 — new Date()는 UTC 기준이라
  // getUTCMonth()를 바로 쓰면 KST로는 이미 다음 달인데 이전 달로 계산되는 경우가 생긴다.
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const periodStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 1));
  const month = periodStart.getUTCMonth() + 1;

  const paymentsSnap = await adminDb
    .collection(USERS)
    .doc(uid)
    .collection(PAYMENTS)
    .where("status", "==", "fulfilled")
    .where("paidAt", ">=", periodStart.toISOString())
    .where("paidAt", "<", periodEnd.toISOString())
    .get();

  let totalWon = 0;
  for (const doc of paymentsSnap.docs) {
    const priceWon = Number(doc.data().priceWon ?? 0);
    if (Number.isFinite(priceWon) && priceWon > 0) totalWon += priceWon;
  }

  const rate = bonusRewardRateForWon(totalWon);
  const projectedPasses = totalWon > 0 ? rewardPassesForWon(totalWon, rate) : 0;

  return NextResponse.json({ month, totalWon, rate, projectedPasses });
}
