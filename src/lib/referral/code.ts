import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { addMonthsClamped } from "@/lib/util/dateMath";
import {
  REFERRAL_SIGNUP_FRIEND_CAP,
  REFERRAL_SIGNUP_FREE_PASSES,
  SIGNUP_FREE_PASS_BASIS,
  SIGNUP_FREE_PASSES,
  SPREADS,
  PENDING_REWARD_CLAIM_WINDOW_MONTHS,
  signupFreePassAllowances,
} from "@/lib/tarot/pricing";

// 0/O, 1/I/L처럼 화면이나 발음으로 헷갈리기 쉬운 문자는 링크에 그대로 노출되는 코드라 아예 뺀다.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

/** users/{uid}.referralCode가 없으면 새로 만들어서 저장하고, 있으면 그대로 반환한다.
 * referralCodes/{code} -> { uid }는 초대 링크 클릭 시 코드→uid 역조회용 인덱스. */
export async function ensureReferralCode(uid: string): Promise<string> {
  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.data()?.referralCode;
  if (typeof existing === "string" && existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const codeRef = adminDb.collection("referralCodes").doc(code);
    const created = await adminDb.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (codeSnap.exists) return false;
      tx.set(codeRef, { uid, createdAt: new Date().toISOString() });
      tx.set(userRef, { referralCode: code }, { merge: true });
      return true;
    });
    if (created) return code;
  }
  throw new Error("리퍼럴 코드 생성에 실패했어요.");
}

export async function findUidByReferralCode(code: string): Promise<string | null> {
  if (!code) return null;
  const snap = await adminDb.collection("referralCodes").doc(code).get();
  const uid = snap.data()?.uid;
  return typeof uid === "string" ? uid : null;
}

/** 최초 가입 체험 보상. 고정 문서 ID를 써서 OAuth 콜백 재시도에도 한 번만 지급한다. */
export async function grantSignupFreePass(uid: string): Promise<void> {
  const passRef = adminDb.collection("users").doc(uid).collection("countPasses").doc("signup-free");

  await adminDb.runTransaction(async (tx) => {
    if ((await tx.get(passRef)).exists) return;
    tx.set(passRef, {
      productId: "signup-free",
      source: "signup-free",
      freePasses: SIGNUP_FREE_PASSES,
      basis: SIGNUP_FREE_PASS_BASIS,
      remaining: 1,
      combo: "any",
      status: "unused",
      allowances: signupFreePassAllowances(),
      createdAt: new Date().toISOString(),
      expiresAt: null,
    });
  });
}

/** 신규 가입 리워드. 추천인과 친구 모두에게 원카드 기준 무료 이용권 5회 상당을 멱등 지급한다.
 * 2026-09-18부터 즉시 지급이 아니라 "받은 이용권 내역"에서 조합을 골라 수령하는 대기(pending)
 * 레코드로 바뀌었다(지급일로부터 1개월 내 미수령 시 소멸) — 월간 결제 리워드(functions/src/index.ts의
 * monthlyReferralPayout)와 동일한 pendingRewards 스키마를 공유한다. */
export async function grantSignupReferralReward(referrerUid: string, newUid: string): Promise<void> {
  if (referrerUid === newUid) return;
  const referrerRef = adminDb.collection("users").doc(referrerUid);
  const grantRef = referrerRef.collection("referralGrants").doc(newUid);

  await adminDb.runTransaction(async (tx) => {
    const [referrerSnap, grantSnap] = await Promise.all([tx.get(referrerRef), tx.get(grantRef)]);
    if (grantSnap.exists || !referrerSnap.exists) return;

    const invitedFriends = Number(referrerSnap.data()?.referralSignupFriends ?? 0);
    if (invitedFriends >= REFERRAL_SIGNUP_FRIEND_CAP) return;

    const now = new Date().toISOString();
    const claimWindowExpiresAt = addMonthsClamped(now, PENDING_REWARD_CLAIM_WINDOW_MONTHS);
    const basis = REFERRAL_SIGNUP_FREE_PASSES * SPREADS.one.cost;
    const referrerRewardRef = referrerRef.collection("pendingRewards").doc();
    const friendRef = adminDb.collection("users").doc(newUid);
    const friendRewardRef = friendRef.collection("pendingRewards").doc();
    const pendingReward = (recipient: "referrer" | "friend") => ({
      source: "referral-signup" as const,
      recipient,
      freePasses: REFERRAL_SIGNUP_FREE_PASSES,
      basis,
      status: "pending" as const,
      createdAt: now,
      claimWindowExpiresAt,
      claimedAt: null,
    });

    tx.set(grantRef, { freePasses: REFERRAL_SIGNUP_FREE_PASSES, createdAt: now });
    tx.set(referrerRewardRef, pendingReward("referrer"));
    tx.set(friendRewardRef, pendingReward("friend"));
    tx.set(referrerRef, { referralSignupFriends: FieldValue.increment(1) }, { merge: true });
  });
}
