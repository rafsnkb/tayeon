import { randomBytes } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { addMonthsClamped } from "@/lib/util/dateMath";
import { GRANT_MARKER_RETENTION_MONTHS } from "@/lib/legal/retention";
import { retentionExpiresAt } from "@/lib/legal/retentionTimestamp";
import {
  REFERRAL_SIGNUP_FRIEND_CAP,
  REFERRAL_SIGNUP_FREE_PASSES,
  SIGNUP_FREE_PASS_BASIS,
  SIGNUP_FREE_PASSES,
  SPREADS,
  PENDING_REWARD_CLAIM_WINDOW_MONTHS,
  signupFreePassAllowances,
} from "@/lib/tarot/pricing";
import {
  USERS,
  REFERRAL_CODES,
  REFERRAL_GRANTS,
  REFERRAL_GRANT_FRIENDS,
  SIGNUP_GRANTS,
  REFERRAL_SIGNUP_GRANTS,
  COUNT_PASSES,
  PENDING_REWARDS,
} from "@/lib/firestore/collections";

// 0/O, 1/I/L처럼 화면이나 발음으로 헷갈리기 쉬운 문자는 링크에 그대로 노출되는 코드라 아예 뺀다.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

// 부정 가입 방지 목적으로만 쓰는 최소 식별 마커(signupGrants/*, referralGrants/*/friends/*)의
// 만료 시각. 보유기간과 Timestamp 변환은 개인정보처리방침의 다른 보관기간과 함께
// src/lib/legal/retention.ts에 모아두었다. TTL 정책은 두 컬렉션 모두 ACTIVE 상태다.
function markerExpiresAt(fromIso: string): Timestamp {
  return retentionExpiresAt(fromIso, GRANT_MARKER_RETENTION_MONTHS);
}

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
  const userRef = adminDb.collection(USERS).doc(uid);
  const userSnap = await userRef.get();
  const existing = userSnap.data()?.referralCode;
  if (typeof existing === "string" && existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const codeRef = adminDb.collection(REFERRAL_CODES).doc(code);
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
  const snap = await adminDb.collection(REFERRAL_CODES).doc(code).get();
  const uid = snap.data()?.uid;
  return typeof uid === "string" ? uid : null;
}

/** 최초 가입 체험 보상. 고정 문서 ID를 써서 OAuth 콜백 재시도에도 한 번만 지급한다.
 * uid(=kakao:{카카오ID})는 결정적이라 탈퇴 후 재가입해도 동일하므로, 지급 이력은
 * users/{uid} 서브트리 밖의 최상위 signupGrants 컬렉션에 남겨 recursiveDelete로도
 * 지워지지 않게 한다(탈퇴→재가입 반복으로 무료 이용권이 재지급되는 것을 막기 위함). */
export async function grantSignupFreePass(uid: string): Promise<void> {
  const grantMarkerRef = adminDb.collection(SIGNUP_GRANTS).doc(uid);
  const passRef = adminDb.collection(USERS).doc(uid).collection(COUNT_PASSES).doc("signup-free");

  await adminDb.runTransaction(async (tx) => {
    if ((await tx.get(grantMarkerRef)).exists) return;
    const now = new Date().toISOString();
    tx.set(grantMarkerRef, { uid, createdAt: now, expiresAt: markerExpiresAt(now) });
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
 * monthlyReferralPayout)와 동일한 pendingRewards 스키마를 공유한다.
 *
 * 지급 이력(친구별 멱등 키 + 추천 인원수 카운터)은 users/{referrerUid} 서브트리가 아니라
 * 최상위 referralGrants/{referrerUid} 문서(+ friends 서브컬렉션)에 둔다. uid는 카카오ID로
 * 결정적이라, 탈퇴 후 재가입으로 추천인/친구 문서를 새로 만들어도 이 최상위 문서는 그대로 남아
 * 같은 추천인-친구 조합에 다시 지급되거나 인원수 상한이 리셋되는 것을 막는다.
 *
 * 다만 그 키는 추천인-친구 **쌍**이라, 추천인만 바꾸면 같은 사람이 계속 새로 받을 수 있었다 —
 * 초대 링크는 공개적으로 뿌리는 것이라 남의 코드를 모으는 건 어렵지 않다. 코드 20개를 모아
 * "가입 → 보상 수령 → 탈퇴 → 다른 코드로 재가입"을 돌리면 5회씩 계속 쌓였고, 매 회차마다
 * 추천인 쪽에도 똑같이 5회가 나가서 서비스는 두 배로 물었다(2026-09-24 발견). 그래서 받는
 * 사람 기준의 최상위 마커(referralSignupGrants/{uid})를 하나 더 둔다 — grantSignupFreePass 가
 * signupGrants 로 탈퇴→재가입을 막는 것과 똑같은 방식이다. */
export async function grantSignupReferralReward(referrerUid: string, newUid: string): Promise<void> {
  if (referrerUid === newUid) return;
  const referrerRef = adminDb.collection(USERS).doc(referrerUid);
  const grantParentRef = adminDb.collection(REFERRAL_GRANTS).doc(referrerUid);
  const grantRef = grantParentRef.collection(REFERRAL_GRANT_FRIENDS).doc(newUid);
  const recipientMarkerRef = adminDb.collection(REFERRAL_SIGNUP_GRANTS).doc(newUid);

  await adminDb.runTransaction(async (tx) => {
    const [referrerSnap, grantParentSnap, grantSnap, recipientSnap] = await Promise.all([
      tx.get(referrerRef),
      tx.get(grantParentRef),
      tx.get(grantRef),
      tx.get(recipientMarkerRef),
    ]);
    if (grantSnap.exists || !referrerSnap.exists) return;
    // 이 사람이 가입 보상을 이미 받은 적이 있으면 추천인이 누구든 다시 주지 않는다.
    if (recipientSnap.exists) {
      console.warn("[referral] 이미 가입 보상을 받은 계정 — 재지급하지 않는다", { referrerUid, newUid });
      return;
    }

    const invitedFriends = Number(grantParentSnap.data()?.friendsInvited ?? 0);
    if (invitedFriends >= REFERRAL_SIGNUP_FRIEND_CAP) return;

    const now = new Date().toISOString();
    const claimWindowExpiresAt = addMonthsClamped(now, PENDING_REWARD_CLAIM_WINDOW_MONTHS);
    const basis = REFERRAL_SIGNUP_FREE_PASSES * SPREADS.one.cost;
    const referrerRewardRef = referrerRef.collection(PENDING_REWARDS).doc();
    const friendRef = adminDb.collection(USERS).doc(newUid);
    const friendRewardRef = friendRef.collection(PENDING_REWARDS).doc();
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

    // grantParentRef(friendsInvited 누적 카운터)에는 expiresAt을 두지 않는다 — 친구마다
    // 만료 시점이 다른데 부모 문서까지 TTL로 지워지면 누적 카운터가 의도치 않게 리셋된다.
    tx.set(grantRef, { freePasses: REFERRAL_SIGNUP_FREE_PASSES, createdAt: now, expiresAt: markerExpiresAt(now) });
    // 받는 사람 기준 마커에는 expiresAt 을 두지 않는다 — TTL 로 지워지면 그 순간부터 같은
    // 계정이 또 받을 수 있게 되므로, 막으려던 것이 그대로 되돌아온다.
    tx.set(recipientMarkerRef, { uid: newUid, referrerUid, createdAt: now });
    tx.set(referrerRewardRef, pendingReward("referrer"));
    tx.set(friendRewardRef, pendingReward("friend"));
    tx.set(grantParentRef, { referrerUid, friendsInvited: FieldValue.increment(1) }, { merge: true });
  });
}

/** 추천인이 지금까지 리워드를 받은 친구 수. users 문서가 아니라 최상위 referralGrants 문서를
 * 기준으로 삼아 탈퇴→재가입으로 카운터가 리셋되지 않게 한다. `/api/referral/me`에서 사용. */
export async function getReferralInvitedFriendsCount(referrerUid: string): Promise<number> {
  const snap = await adminDb.collection(REFERRAL_GRANTS).doc(referrerUid).get();
  return Number(snap.data()?.friendsInvited ?? 0);
}
