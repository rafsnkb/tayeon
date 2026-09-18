import { adminDb } from "@/lib/firebase/admin";
import { addMonthsClamped } from "@/lib/util/dateMath";

/** 생일 쿠폰은 수령 시 세 조합 중 하나를 고르게 하므로 여기서는 pendingRewards만 발급한다. */
export async function grantBirthdayCoupon(uid: string, birthdayKey: string, issuedAt = new Date().toISOString()) {
  const userRef = adminDb.collection("users").doc(uid);
  const ledgerRef = userRef.collection("birthdayCouponGrants").doc(birthdayKey);
  const rewardRef = userRef.collection("pendingRewards").doc();
  await adminDb.runTransaction(async (tx) => {
    if ((await tx.get(ledgerRef)).exists) return;
    tx.set(ledgerRef, { issuedAt, birthdayKey });
    tx.set(rewardRef, {
      source: "birthday", status: "pending", birthdayKey, createdAt: issuedAt,
      claimWindowExpiresAt: addMonthsClamped(issuedAt, 1),
      options: [
        { combo: "tarot-saju", freePasses: 8 },
        { combo: "tarot-ziwei", freePasses: 6 },
        { combo: "tarot-saju-ziwei", freePasses: 4 },
      ],
    });
  });
}
