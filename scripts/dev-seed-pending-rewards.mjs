// 로컬 에뮬레이터에 "미수령 리워드가 있는 계정"을 심고, 그 계정으로 로그인할 커스텀 토큰을 찍는다.
//
// 받은 이용권 수령 화면(조합 4종을 고르고 "받기")은 미수령 건이 있어야만 볼 수 있는데, 리워드를
// 만드는 건 매월 10일 정산 배치뿐이라 로컬에서는 열어볼 방법이 없었다(2026-09-24 인계 1번).
//
// 사용:
//   firebase emulators:start --only firestore,auth --project tayeon-test
//   node scripts/dev-seed-pending-rewards.mjs            # 토큰이 stdout 으로 나온다
//   # 그 토큰으로 브라우저에서: await window.__devSignIn("<토큰>")
//   # (앱을 NEXT_PUBLIC_FIREBASE_EMULATORS=1 로 띄웠을 때만 있는 창구 — src/lib/firebase/client.ts)
//
// 필요한 환경변수: FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST,
// GOOGLE_APPLICATION_CREDENTIALS(아무 형식만 맞는 더미 서비스계정 JSON — 에뮬레이터는 서명을
// 검사하지 않는다), GCLOUD_PROJECT.
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import {
  addMonthsClamped,
  ONE_CARD_BASIS,
  PENDING_REWARD_CLAIM_WINDOW_MONTHS,
} from "../src/lib/reward/rules.ts";

// 실 Firestore 에 가짜 리워드를 심는 사고를 막는다. 에뮬레이터가 아니면 아무것도 하지 않는다.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST 가 없다 — 중단한다.");
  process.exit(1);
}

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credsPath) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS 가 없다(더미 서비스계정 JSON 경로).");
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(credsPath, "utf8"))),
  projectId: process.env.GCLOUD_PROJECT ?? "tayeon-test",
});

const db = getFirestore();
const auth = getAuth();

const UID = process.env.SEED_UID ?? "devuser";
const now = new Date().toISOString();

await auth.deleteUser(UID).catch(() => {});
await auth.createUser({ uid: UID, displayName: "테스터" });

// birthInfo 는 isValidBirthInfo(src/lib/tarot/birthInfo.ts)를 통과하는 모양이어야 한다 —
// birthDate/birthTime 만 넣으면 화면은 자미두수 조합을 고르게 해 주는데 서버가 409 로 막는다.
await db.collection("users").doc(UID).set({
  nickname: "테스터",
  birthInfo: {
    calendarType: "solar",
    isLeapMonth: false,
    birthDate: "1990-05-05",
    birthTime: "13:30",
    timeUnknown: false,
    jasiRule: "midnight",
    gender: "female",
    useTrueSolarTime: false,
  },
  createdAt: now,
});

// 2026-09-25 에뮬레이터 검증에서 실제로 나온 값들 — 공급가액 109,090원의 친구 결제 5% = 18회,
// 공급가액 100만원의 보너스 10% = 333회.
const rewards = [
  { source: "referral-payout", freePasses: 18 },
  { source: "bonus-reward", freePasses: 333 },
];

const col = db.collection("users").doc(UID).collection("pendingRewards");
for (const doc of (await col.get()).docs) await doc.ref.delete();

for (const reward of rewards) {
  await col.add({
    source: reward.source,
    freePasses: reward.freePasses,
    basis: reward.freePasses * ONE_CARD_BASIS,
    status: "pending",
    createdAt: now,
    claimWindowExpiresAt: addMonthsClamped(now, PENDING_REWARD_CLAIM_WINDOW_MONTHS),
    claimedAt: null,
  });
}

console.log(await auth.createCustomToken(UID));
