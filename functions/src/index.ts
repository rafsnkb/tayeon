import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

export const ping = onRequest((req, res) => {
  res.json({ ok: true });
});

// 친구 초대(리퍼럴) 월간 5% 정산 — asset/Screen/friendInvite.png 기획, src/lib/tarot/pricing.ts의
// REFERRAL_MONTHLY_COMMISSION_RATE와 동일한 값을 쓴다(패키지가 분리돼 있어 상수를 공유 import할
// 수 없으므로 값만 그대로 복사, 바꾸려면 두 군데 다 고칠 것).
const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

// 타연엔 1자리 단위(1~9코인)로 소모되는 컨텐츠가 없어서, 리워드로 지급되는 코인도 항상 10의
// 배수여야 자연스럽다(예: 8,900원 결제의 5%는 445원 — 10의 배수가 아님). 유저에게 지급되는
// 금액이니 반올림 대신 항상 올림으로 처리해서 애매하게 깎이는 일이 없게 한다.
function ceilToTens(n: number): number {
  return Math.ceil(n / 10) * 10;
}

// 매월 5일 03:00(KST)에 "지난달" 결제 건을 정산한다 — 월초 며칠의 여유는 말일 늦은 밤 결제까지
// 웹훅/콜백이 처리될 시간을 넉넉히 준 것.
export const monthlyReferralPayout = onSchedule(
  { schedule: "0 3 5 * *", timeZone: "Asia/Seoul", region: "asia-east1" },
  async () => {
    const db = getFirestore();

    // new Date()는 UTC 기준이라 getUTCMonth()를 바로 쓰면, 예를 들어 스케줄이 매월 1일
    // 03:00(KST)일 때 그 순간의 UTC 날짜는 전날(말일) 18:00이라 한 달 전 월로 잘못 계산되는
    // 경우가 생긴다(스케줄 실행일이 언제든 안전하도록, KST 오프셋(+9h)을 더한 뒤 그 값의 UTC
    // 필드를 "KST 달력 날짜"로 취급).
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
    const periodStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1));
    const payoutKey = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, "0")}`;

    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    // 1. 지난달에 결제 완료(fulfill.ts가 남기는 status: "fulfilled")된 모든 결제를 유저별로 합산.
    const paymentsSnap = await db
      .collectionGroup("payments")
      .where("status", "==", "fulfilled")
      .where("paidAt", ">=", startIso)
      .where("paidAt", "<", endIso)
      .get();

    const totalByPayerUid = new Map<string, number>();
    for (const doc of paymentsSnap.docs) {
      const payerUid = doc.ref.parent.parent?.id;
      if (!payerUid) continue;
      const priceWon = Number(doc.data().priceWon ?? 0);
      if (!Number.isFinite(priceWon) || priceWon <= 0) continue;
      totalByPayerUid.set(payerUid, (totalByPayerUid.get(payerUid) ?? 0) + priceWon);
    }

    if (totalByPayerUid.size === 0) {
      console.log("[referral-payout] 지난달 결제 없음, 종료");
      return;
    }

    // 2. 결제한 유저들의 referredBy를 조회해서, 추천인별 "결제액 합계"로 먼저 재집계한다 — 피그마
    // 문구("친구들의 이번달 결제 비용이 총합 10만원이라면")도 개별 결제가 아니라 추천인 기준
    // 합계에 5%를 적용하는 것으로 설명하고 있어서, 올림도 합산 후 한 번만 적용해야 값이 맞다
    // (결제 건마다 먼저 올림한 뒤 합치면 실제보다 더 많이 지급될 수 있음).
    const totalWonByReferrerUid = new Map<string, number>();
    for (const [payerUid, totalWon] of totalByPayerUid) {
      const payerSnap = await db.collection("users").doc(payerUid).get();
      const referredBy = payerSnap.data()?.referredBy;
      if (typeof referredBy !== "string" || !referredBy) continue;
      totalWonByReferrerUid.set(referredBy, (totalWonByReferrerUid.get(referredBy) ?? 0) + totalWon);
    }

    const commissionByReferrerUid = new Map<string, number>();
    for (const [referrerUid, totalWon] of totalWonByReferrerUid) {
      const commission = ceilToTens(totalWon * REFERRAL_MONTHLY_COMMISSION_RATE);
      if (commission > 0) commissionByReferrerUid.set(referrerUid, commission);
    }

    // 3. 추천인별로 이번 정산 주기 1회만 지급(referralPayouts/{yyyy-mm} 문서를 멱등성 키로 사용 —
    // 함수가 재시도/중복 실행되더라도 같은 달에 두 번 지급되지 않는다).
    for (const [referrerUid, commission] of commissionByReferrerUid) {
      const referrerRef = db.collection("users").doc(referrerUid);
      const payoutRef = referrerRef.collection("referralPayouts").doc(payoutKey);

      await db.runTransaction(async (tx) => {
        const [referrerSnap, payoutSnap] = await Promise.all([tx.get(referrerRef), tx.get(payoutRef)]);
        if (payoutSnap.exists || !referrerSnap.exists) return;

        tx.set(payoutRef, {
          coins: commission,
          rate: REFERRAL_MONTHLY_COMMISSION_RATE,
          periodStart: startIso,
          periodEnd: endIso,
          createdAt: new Date().toISOString(),
        });
        tx.set(referrerRef, { coins: FieldValue.increment(commission) }, { merge: true });
      });
    }

    console.log(`[referral-payout] ${payoutKey} 정산 완료 — 추천인 ${commissionByReferrerUid.size}명`);
  }
);

// 보너스 리워드(자체 결제 캐시백) 티어 — src/lib/tarot/pricing.ts의 PAYMENT_BONUS_REWARD_TIERS와
// 동일한 값을 쓴다(패키지가 분리돼 있어 값만 그대로 복사, 바꾸려면 두 군데 다 고칠 것). 친구 결제
// 리워드(monthlyReferralPayout)와 달리 이건 유저 "본인"의 결제 총액을 기준으로 한다.
const PAYMENT_BONUS_REWARD_TIERS: { minWon: number; rate: number }[] = [
  { minWon: 1_000_000, rate: 0.1 },
  { minWon: 800_000, rate: 0.07 },
  { minWon: 400_000, rate: 0.05 },
  { minWon: 200_000, rate: 0.04 },
  { minWon: 100_000, rate: 0.03 },
  { minWon: 50_000, rate: 0.015 },
  { minWon: 30_000, rate: 0.01 },
  { minWon: 0, rate: 0.005 },
];

function bonusRewardRateForWon(totalWon: number): number {
  const tier = PAYMENT_BONUS_REWARD_TIERS.find((t) => totalWon >= t.minWon);
  return tier?.rate ?? 0;
}

// 매월 5일 03:00(KST)에 "지난달" 내가 결제한 코인ㆍ이용권 금액을 정산해 보너스 리워드를 지급한다.
export const monthlyBonusRewardPayout = onSchedule(
  { schedule: "0 3 5 * *", timeZone: "Asia/Seoul", region: "asia-east1" },
  async () => {
    const db = getFirestore();

    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const periodEnd = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1));
    const periodStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1));
    const payoutKey = `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, "0")}`;

    const startIso = periodStart.toISOString();
    const endIso = periodEnd.toISOString();

    // 1. 지난달에 결제 완료된 모든 결제를 유저별로 합산(친구 여부와 무관하게 결제한 본인 기준).
    const paymentsSnap = await db
      .collectionGroup("payments")
      .where("status", "==", "fulfilled")
      .where("paidAt", ">=", startIso)
      .where("paidAt", "<", endIso)
      .get();

    const totalByUid = new Map<string, number>();
    for (const doc of paymentsSnap.docs) {
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;
      const priceWon = Number(doc.data().priceWon ?? 0);
      if (!Number.isFinite(priceWon) || priceWon <= 0) continue;
      totalByUid.set(uid, (totalByUid.get(uid) ?? 0) + priceWon);
    }

    if (totalByUid.size === 0) {
      console.log("[bonus-reward-payout] 지난달 결제 없음, 종료");
      return;
    }

    // 2. 유저별로 이번 정산 주기 1회만 지급(bonusRewardPayouts/{yyyy-mm} 문서를 멱등성 키로 사용 —
    // 함수가 재시도/중복 실행되더라도 같은 달에 두 번 지급되지 않는다).
    for (const [uid, totalWon] of totalByUid) {
      const rate = bonusRewardRateForWon(totalWon);
      const coins = ceilToTens(totalWon * rate);
      if (coins <= 0) continue;

      const userRef = db.collection("users").doc(uid);
      const payoutRef = userRef.collection("bonusRewardPayouts").doc(payoutKey);

      await db.runTransaction(async (tx) => {
        const [userSnap, payoutSnap] = await Promise.all([tx.get(userRef), tx.get(payoutRef)]);
        if (payoutSnap.exists || !userSnap.exists) return;

        tx.set(payoutRef, {
          coins,
          rate,
          totalWon,
          periodStart: startIso,
          periodEnd: endIso,
          createdAt: new Date().toISOString(),
        });
        tx.set(userRef, { coins: FieldValue.increment(coins) }, { merge: true });
      });
    }

    console.log(`[bonus-reward-payout] ${payoutKey} 정산 완료 — 유저 ${totalByUid.size}명`);
  }
);
