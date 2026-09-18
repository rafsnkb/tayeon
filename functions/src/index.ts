import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

export const ping = onRequest((req, res) => {
  res.json({ ok: true });
});

// 친구 초대(리퍼럴) 월간 5% 정산. Functions 패키지는 앱 코드와 분리되어 있어 아래 가격 규칙을
// 같은 값으로 유지한다.
const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;
const ONE_CARD_BASIS = 200;

function rewardPassesForWon(totalWon: number, rate: number): number {
  return Math.round((totalWon * rate) / ONE_CARD_BASIS);
}

// 받은 이용권 수령 가능 기간(지급일로부터 이 기간 내 미수령 시 소멸) — src/lib/tarot/pricing.ts의
// PENDING_REWARD_CLAIM_WINDOW_MONTHS와 동일한 값(패키지 분리로 값만 복사).
const PENDING_REWARD_CLAIM_WINDOW_MONTHS = 1;

// src/lib/util/dateMath.ts의 addMonthsClamped와 동일한 로직(패키지 분리로 복사).
function addMonthsClamped(iso: string, months: number): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}

/** 매일 KST 00:10에 저장된 생년월일과 일치하는 사용자에게 생일 쿠폰을 1회 발급한다. */
export const dailyBirthdayCouponPayout = onSchedule(
  { schedule: "10 0 * * *", timeZone: "Asia/Seoul", region: "asia-east1" },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const year = pick("year"), month = pick("month"), day = pick("day");
    const birthdayKey = `${year}-${month}${day}`;
    const users = await db.collection("users").get();
    for (const user of users.docs) {
      const data = user.data();
      const birthDate = data.birthInfo?.birthDate;
      const birthday = typeof data.kakaoBirthday === "string" ? data.kakaoBirthday : typeof birthDate === "string" ? birthDate.slice(5, 10).replace("-", "") : null;
      if (birthday !== `${month}${day}`) continue;
      const ledger = user.ref.collection("birthdayCouponGrants").doc(birthdayKey);
      const reward = user.ref.collection("pendingRewards").doc();
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ledger)).exists) return;
        const issuedAt = new Date().toISOString();
        tx.set(ledger, { birthdayKey, issuedAt });
        tx.set(reward, { source: "birthday", status: "pending", birthdayKey, createdAt: issuedAt, claimWindowExpiresAt: addMonthsClamped(issuedAt, 1), options: [{ combo: "tarot-saju", freePasses: 8 }, { combo: "tarot-ziwei", freePasses: 6 }, { combo: "tarot-saju-ziwei", freePasses: 4 }] });
      });
    }
  }
);

// 2026-09-18부터 이 두 스케줄 함수는 이용권을 즉시 지급하지 않고 "받은 이용권 내역"에서 사용자가
// 조합(타로전용/+사주/+자미두수/+사주자미두수)을 골라 수령해야 하는 대기(pending) 레코드를 만든다
// (src/app/api/user/pending-rewards/**, src/lib/referral/code.ts의 grantSignupReferralReward와
// 동일한 pendingRewards 스키마 공유). 조합별 횟수 계산(countAllowancesForCombo)은 수령 시점에
// Next 앱 쪽에서 담당하므로 여기서는 더 이상 allowances를 미리 계산해두지 않는다.
function pendingRewardData(
  source: "bonus-reward" | "referral-payout",
  freePasses: number,
  createdAt: string
) {
  return {
    source,
    freePasses,
    basis: freePasses * ONE_CARD_BASIS,
    status: "pending" as const,
    createdAt,
    claimWindowExpiresAt: addMonthsClamped(createdAt, PENDING_REWARD_CLAIM_WINDOW_MONTHS),
    claimedAt: null,
  };
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

    const passesByReferrerUid = new Map<string, number>();
    for (const [referrerUid, totalWon] of totalWonByReferrerUid) {
      const freePasses = rewardPassesForWon(totalWon, REFERRAL_MONTHLY_COMMISSION_RATE);
      if (freePasses > 0) passesByReferrerUid.set(referrerUid, freePasses);
    }

    // 3. 추천인별로 이번 정산 주기 1회만 지급(referralPayouts/{yyyy-mm} 문서를 멱등성 키로 사용 —
    // 함수가 재시도/중복 실행되더라도 같은 달에 두 번 지급되지 않는다).
    for (const [referrerUid, freePasses] of passesByReferrerUid) {
      const referrerRef = db.collection("users").doc(referrerUid);
      const payoutRef = referrerRef.collection("referralPayouts").doc(payoutKey);
      const rewardRef = referrerRef.collection("pendingRewards").doc();

      await db.runTransaction(async (tx) => {
        const [referrerSnap, payoutSnap] = await Promise.all([tx.get(referrerRef), tx.get(payoutRef)]);
        if (payoutSnap.exists || !referrerSnap.exists) return;

        const createdAt = new Date().toISOString();
        tx.set(payoutRef, {
          freePasses,
          rate: REFERRAL_MONTHLY_COMMISSION_RATE,
          periodStart: startIso,
          periodEnd: endIso,
          createdAt,
        });
        tx.set(rewardRef, pendingRewardData("referral-payout", freePasses, createdAt));
      });
    }

    console.log(`[referral-payout] ${payoutKey} 정산 완료 — 추천인 ${passesByReferrerUid.size}명`);
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
      const freePasses = rewardPassesForWon(totalWon, rate);
      if (freePasses <= 0) continue;

      const userRef = db.collection("users").doc(uid);
      const payoutRef = userRef.collection("bonusRewardPayouts").doc(payoutKey);
      const rewardRef = userRef.collection("pendingRewards").doc();

      await db.runTransaction(async (tx) => {
        const [userSnap, payoutSnap] = await Promise.all([tx.get(userRef), tx.get(payoutRef)]);
        if (payoutSnap.exists || !userSnap.exists) return;

        const createdAt = new Date().toISOString();
        tx.set(payoutRef, {
          freePasses,
          rate,
          totalWon,
          periodStart: startIso,
          periodEnd: endIso,
          createdAt,
        });
        tx.set(rewardRef, pendingRewardData("bonus-reward", freePasses, createdAt));
      });
    }

    console.log(`[bonus-reward-payout] ${payoutKey} 정산 완료 — 유저 ${totalByUid.size}명`);
  }
);
