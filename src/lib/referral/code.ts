import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { REFERRAL_SIGNUP_REWARD_CAP, REFERRAL_SIGNUP_REWARD_COINS } from "@/lib/tarot/pricing";

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

/** 신규 가입 유저가 리퍼럴 링크로 들어왔을 때, 추천인에게 가입 보상(1인당 누적 최대 500코인)을
 * 지급한다. referrerRef.referralGrants/{newUid} 문서를 멱등성 키로 써서, 콜백이 어떤 이유로든
 * 중복 실행되더라도 같은 신규 유저에 대해 두 번 지급되지 않는다. */
export async function grantSignupReferralReward(referrerUid: string, newUid: string): Promise<void> {
  if (referrerUid === newUid) return;
  const referrerRef = adminDb.collection("users").doc(referrerUid);
  const grantRef = referrerRef.collection("referralGrants").doc(newUid);

  await adminDb.runTransaction(async (tx) => {
    const [referrerSnap, grantSnap] = await Promise.all([tx.get(referrerRef), tx.get(grantRef)]);
    if (grantSnap.exists || !referrerSnap.exists) return;

    const earned = Number(referrerSnap.data()?.referralSignupCoinsEarned ?? 0);
    if (earned >= REFERRAL_SIGNUP_REWARD_CAP) return;

    const reward = Math.min(REFERRAL_SIGNUP_REWARD_COINS, REFERRAL_SIGNUP_REWARD_CAP - earned);
    tx.set(grantRef, { reward, createdAt: new Date().toISOString() });
    tx.set(
      referrerRef,
      { coins: FieldValue.increment(reward), referralSignupCoinsEarned: FieldValue.increment(reward) },
      { merge: true }
    );
  });
}
