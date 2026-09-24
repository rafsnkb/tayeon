import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();

// 타워(관제센터) 일일 리포트. 설정은 tawerReport.ts 에 있고 집계 로직은 tawer/ 에 있다.
export { tawerDailyReport } from "./tawerReport.ts";

export const ping = onRequest((req, res) => {
  res.json({ ok: true });
});

// 친구 초대(리퍼럴) 월간 5% 정산. Functions 패키지는 앱 코드와 분리되어 있어 아래 가격 규칙을
// 같은 값으로 유지한다.
const REFERRAL_MONTHLY_COMMISSION_RATE = 0.05;

// 친구 결제 리워드 최소 기준 — src/lib/tarot/pricing.ts의 REFERRAL_MONTHLY_MIN_WON과 같은 값
// (패키지 분리로 값만 복사). 추천인의 친구들이 그 달에 합쳐서 이 금액 이상 결제해야 지급하며,
// 미달분은 다음 달로 이월되지 않는다.
const REFERRAL_MONTHLY_MIN_WON = 100_000;
// 원카드 1회 단가 — src/lib/tarot/pricing.ts의 SPREADS.one.cost와 같은 값(패키지 분리로 복사).
// 2026-09-24 가격표 개정(200 → 300)이 여기 반영되지 않아서, 배치가 표기한 freePasses가 실제
// 이용권이 주는 횟수보다 1.5배 많았다(110,000원 결제 → 받은 이용권 내역 "17회" / 실제 11회 /
// 마이페이지 예상치 11회). basis(= freePasses × 이 값)는 결국 결제액×요율 그대로라 지급되는
// 가치는 바뀌지 않고, 표기만 사실과 맞게 된다.
const ONE_CARD_BASIS = 300;

// src/lib/tarot/pricing.ts의 rewardPassesForWon과 같은 규칙(패키지 분리로 복사). 버림인 이유는
// 본체 주석 참고 — 올려 주면 지급하는 이용권이 리워드 금액보다 비싸진다(2026-09-24).
function rewardPassesForWon(totalWon: number, rate: number): number {
  const commissionWon = Math.round(totalWon * rate);
  return Math.floor(commissionWon / ONE_CARD_BASIS);
}

// 받은 이용권 수령 가능 기간(지급일로부터 이 기간 내 미수령 시 소멸) — src/lib/tarot/pricing.ts의
// PENDING_REWARD_CLAIM_WINDOW_MONTHS와 동일한 값(패키지 분리로 값만 복사).
const PENDING_REWARD_CLAIM_WINDOW_MONTHS = 1;

// 생일 쿠폰 수령 시 고를 수 있는 조합과 무료 횟수. 예전에는 이 표가 이 파일과
// src/lib/rewards/birthday.ts 양쪽에 그대로 복제돼 있었는데, 후자는 호출하는 곳이 없는 죽은
// 코드였다(2026-09-21 삭제). 지금은 생일 쿠폰을 발급하는 곳이 이 스케줄 함수 하나뿐이다.
const BIRTHDAY_COUPON_OPTIONS = [
  { combo: "tarot-saju", freePasses: 8 },
  { combo: "tarot-ziwei", freePasses: 6 },
  { combo: "tarot-saju-ziwei", freePasses: 4 },
];

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
    // 예전에는 users 컬렉션을 통째로 읽어 문서마다 생일을 계산해 비교했다. 사용자가 늘수록
    // 읽기 비용과 실행 시간이 선형으로 늘어나 결국 타임아웃에 걸리는 구조라, 쓰기 시점에
    // 정규화해 둔 birthdayMMDD(src/lib/user/birthday.ts)로 동등 쿼리만 한다.
    const users = await db.collection("users").where("birthdayMMDD", "==", `${month}${day}`).get();
    for (const user of users.docs) {
      const ledger = user.ref.collection("birthdayCouponGrants").doc(birthdayKey);
      const reward = user.ref.collection("pendingRewards").doc();
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ledger)).exists) return;
        const issuedAt = new Date().toISOString();
        tx.set(ledger, { birthdayKey, issuedAt });
        tx.set(reward, {
          source: "birthday",
          status: "pending",
          birthdayKey,
          createdAt: issuedAt,
          claimWindowExpiresAt: addMonthsClamped(issuedAt, PENDING_REWARD_CLAIM_WINDOW_MONTHS),
          options: BIRTHDAY_COUPON_OPTIONS,
        });
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

// 매월 10일 03:00(KST)에 "지난달" 결제 건을 정산한다 — 월초 며칠의 여유는 말일 늦은 밤 결제까지
// 웹훅/콜백이 처리될 시간을 넉넉히 준 것.
//
// ⚠️ 5일이 아니라 10일인 이유(2026-09-24): 정산은 status=="fulfilled" 결제만 합산하는데,
// 환불 가능 기간이 결제 후 7일이라 5일에 정산하면 아직 환불할 수 있는 결제까지 리워드로
// 쳐준다. "말일에 결제 → 5일에 리워드 수령 → 6일에 환불"로 공짜 이용권을 만들 수 있었다.
// 구간 경계가 Date.UTC 자정(= KST 09:00)이라 구간의 마지막 결제는 "다음달 1일 08:59 KST"이고,
// 그 환불 마감이 8일 08:59 KST다 — 그래서 8일도 6시간이 모자라고 9일부터 닫힌다. 10일은
// 42시간 여유를 둔 값이다. 이 상수를 앞당기려면 REFUND_WINDOW_DAYS(7)부터 다시 계산할 것.
// 사용자 문구도 같이 맞춰 둠: src/app/(app)/invite/page.tsx, src/app/(app)/me/page.tsx.
export const monthlyReferralPayout = onSchedule(
  { schedule: "0 3 10 * *", timeZone: "Asia/Seoul", region: "asia-east1" },
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
      // 합계가 기준 미달이면 그 달은 건너뛴다. 소액일수록 횟수 환산에서 남는 자투리 비중이 커져
      // 리워드가 제 가치보다 후해지기 때문이다(2026-09-24).
      if (totalWon < REFERRAL_MONTHLY_MIN_WON) continue;
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
];

function bonusRewardRateForWon(totalWon: number): number {
  const tier = PAYMENT_BONUS_REWARD_TIERS.find((t) => totalWon >= t.minWon);
  return tier?.rate ?? 0;
}

// 매월 10일 03:00(KST)에 "지난달" 내가 결제한 코인ㆍ이용권 금액을 정산해 보너스 리워드를 지급한다.
// 5일이 아니라 10일인 이유는 monthlyReferralPayout 위의 주석 참고(환불 가능 기간과 겹치지
// 않게 하기 위함 — 두 정산이 같은 날짜를 쓰므로 한쪽만 바꾸지 말 것).
export const monthlyBonusRewardPayout = onSchedule(
  { schedule: "0 3 10 * *", timeZone: "Asia/Seoul", region: "asia-east1" },
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

/**
 * 매시 :17에 어드민의 환불 자동 승인을 깨운다.
 *
 * 여기서는 판정도 결제 취소도 하지 않는다 — 환불 실행 로직은 어드민 한 곳에만 두고
 * (admin/src/lib/refundExecute.ts) 이 함수는 호출만 한다. Functions 에 포트원 SDK 를 또
 * 넣으면 "돈을 움직이는 코드"가 세 벌이 되고, 토스페이먼츠로 교체할 때 전부 고쳐야 한다.
 *
 * 정시(:00)를 피한 건 전 세계 스케줄러가 몰리는 시각이라서다. 2영업일 기한이라 몇 분 차이는
 * 아무 의미가 없다.
 */
export const hourlyRefundAutoApprove = onSchedule(
  { schedule: "17 * * * *", timeZone: "Asia/Seoul", region: "asia-east1" },
  async () => {
    const base = process.env.ADMIN_BASE_URL?.replace(/\/+$/, "");
    const secret = process.env.INTERNAL_API_SECRET;
    if (!base || !secret) {
      console.warn("[refund-auto] ADMIN_BASE_URL/INTERNAL_API_SECRET 미설정 — 건너뛴다");
      return;
    }
    const response = await fetch(`${base}/api/admin/refund-requests/auto-approve`, {
      method: "POST",
      headers: { "x-internal-secret": secret },
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) {
      // 여기서 던지면 Functions 가 재시도한다 — 자동 승인은 멱등(이미 approved 면 건너뜀)이라
      // 재시도가 안전하다.
      throw new Error(`자동 승인 호출 실패 ${response.status}: ${text.slice(0, 300)}`);
    }
    console.log("[refund-auto]", text.slice(0, 300));
  }
);
