// 리딩 계측 필드(verdict / outcome / drawnCards)가 실제로 Firestore 에 찍히는지, 실제 리딩을
// 1회 돌려서 확인한다. 2026-09-26 route.ts 변경분의 유일한 검증 수단이다.
//
// ⚠️ **프로덕션 Firestore(tayeon-d5149)에 쓴다.** 그래서 지켜야 할 것이 두 가지다.
//   1. 이 스크립트가 만든 문서만 건드린다. 기존 사용자·이용권·리딩은 읽지도 고치지도 않는다.
//   2. 만든 것은 성공하든 실패하든 **finally 에서 전부 지운다.** 지울 대상은 만드는 즉시
//      created[] 에 넣는다 — 중간에 죽어도 흔적이 남지 않게.
//
// 셸에 환경변수를 붙이지 않는다(아래에서 직접 세팅). 명령이 `node scripts/verify-instrumentation.mjs`
// 한 줄로 고정돼야 .claude/settings.local.json 의 허용 규칙이 이 파일 하나에만 걸린다.
//
// 사용: node scripts/verify-instrumentation.mjs   (dev 서버가 localhost:3000 에 떠 있어야 한다)
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ADC 는 이 프로젝트 전용 경로에 따로 잡혀 있다(기본 gcloud 설정과 섞이면 엉뚱한 계정이 잡힌다).
const gcloudDir = join(homedir(), ".gcloud-tayeon");
process.env.CLOUDSDK_CONFIG ??= gcloudDir;
process.env.GOOGLE_APPLICATION_CREDENTIALS ??= join(gcloudDir, "application_default_credentials.json");

// .env.local 은 **읽기만** 한다. 값을 고치거나 다시 쓰지 않는다.
// \r 을 먼저 턴다 — 이 파일은 CRLF 이고, JS 정규식에서 `.` 는 \r 을 먹지 않아 `(.*)$` 가 통째로
// 실패한다(줄이 하나도 안 잡혀서 "키를 못 읽었다"로 끝난다).
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
);
const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const webApiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!projectId || !webApiKey) throw new Error(".env.local 에서 projectId/webApiKey 를 못 읽었다.");

const app = initializeApp({
  credential: applicationDefault(),
  projectId,
  // 커스텀 토큰 서명에 필요하다(ADC 사용자 자격으로는 IAM signBlob 으로 대신 서명한다).
  serviceAccountId: env.FIREBASE_SERVICE_ACCOUNT_EMAIL,
});
const db = getFirestore(app);
const auth = getAuth(app);

const UID = "tstverify260926";
const BASE = "http://localhost:3000";
const startedAt = new Date().toISOString();

/** 지울 것들. 만드는 즉시 넣는다. */
const created = [];
/** auth 사용자 삭제에 쓸 ID 토큰. Admin SDK 의 deleteUser 는 identitytoolkit 을 타는데 ADC 에
 *  quota_project_id 가 없으면 통째로 거부당한다 — 그때 테스트 계정이 프로덕션에 남는다.
 *  클라이언트용 REST(accounts:delete)는 웹 API 키 + ID 토큰만 쓰므로 그 문제를 안 탄다. */
let idTokenForCleanup = null;

const log = (...a) => console.log(...a);

async function main() {
  // ── 0. 사전 점검 ─────────────────────────────────────────────────────────
  // identitytoolkit 이 이 ADC 로 호출되는지 먼저 본다. ADC 에 quota_project_id 가 없으면 여기서
  // 막히는데, 그 상태면 서버의 verifyIdToken(checkRevoked:true) 도 같이 막혀 401 이 난다.
  // **아무것도 만들기 전에** 확인해야 정리할 것이 안 생긴다.
  try {
    await auth.listUsers(1);
    log("✓ identitytoolkit 호출 가능 (이 프로세스의 ADC 는 정상)");
  } catch (e) {
    throw new Error(
      `ADC 로 identitytoolkit 을 못 부른다. quota project 를 설정할 것: ${e.message}`
    );
  }

  // ── 1. 테스트 계정 ────────────────────────────────────────────────────────
  const userRef = db.collection("users").doc(UID);
  if ((await userRef.get()).exists) {
    throw new Error(`${UID} 가 이미 있다. 이전 실행이 정리를 못 끝낸 것이니 손으로 확인할 것.`);
  }
  await userRef.set({
    nickname: "계측검증",
    createdAt: startedAt,
    birthInfo: {
      calendarType: "solar",
      isLeapMonth: false,
      birthDate: "1996-04-12",
      birthTime: "14:30",
      timeUnknown: false,
      jasiRule: "early",
      gender: "female",
      useTrueSolarTime: false,
      birthPlace: null,
    },
  });
  created.push(userRef);
  log(`✓ 테스트 계정 생성: ${UID}`);

  // ── 2. 이용권 ────────────────────────────────────────────────────────────
  // src/lib/referral/code.ts 의 가입 무료체험 이용권 형태를 그대로 본뜬다(발명하지 않는다).
  // allowances 키는 countKey() 와 같은 `${spread}-${saju}-${ziwei}` 형식이다(pricing.ts:205).
  const allowances = {};
  for (const spread of ["one", "three", "dual", "celtic"]) {
    for (const saju of [0, 1]) for (const ziwei of [0, 1]) allowances[`${spread}-${saju}-${ziwei}`] = 4;
  }
  const passRef = userRef.collection("countPasses").doc("verify-free");
  await passRef.set({
    productId: "verify-free",
    source: "signup-free",
    freePasses: 4,
    basis: 4 * 300, // SIGNUP_FREE_PASS_BASIS = SIGNUP_FREE_PASSES * ONE_CARD_BASIS(300)
    remaining: 1,
    combo: "any",
    status: "unused",
    allowances,
    createdAt: startedAt,
    expiresAt: null,
  });
  created.push(passRef);
  log("✓ 이용권 생성 (가입 무료체험과 같은 형태)");

  // ── 3. ID 토큰 ───────────────────────────────────────────────────────────
  // 카카오 OAuth 는 스크립트로 못 뚫으므로 커스텀 토큰을 만들어 REST 로 교환한다.
  const customToken = await auth.createCustomToken(UID);
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${webApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const signIn = await signInRes.json();
  if (!signIn.idToken) throw new Error(`ID 토큰 교환 실패: ${JSON.stringify(signIn)}`);
  // signInWithCustomToken 이 auth 사용자를 **여기서** 만든다(createCustomToken 은 안 만든다).
  // 그러니 정리용 토큰은 이 시점부터 보관한다.
  idTokenForCleanup = signIn.idToken;
  const authHeader = { Authorization: `Bearer ${signIn.idToken}`, "Content-Type": "application/json" };
  log("✓ ID 토큰 발급");

  // ── 4. 방 + 리딩 ─────────────────────────────────────────────────────────
  const roomRes = await fetch(`${BASE}/api/tarot/rooms`, { method: "POST", headers: authHeader, body: "{}" });
  const room = await roomRes.json();
  const roomId = room.roomId ?? room.id ?? room.room?.id;
  if (!roomId) throw new Error(`방 생성 실패(${roomRes.status}): ${JSON.stringify(room)}`);
  created.push(userRef.collection("rooms").doc(roomId));
  log(`✓ 방 생성: ${roomId}`);

  // 켈틱을 쓰는 이유: 카드가 10장이라 drawnCardCount / mentionedDrawnCardCount 가 제대로
  // 채워지는지 눈으로 확인하기 좋다.
  log("… 리딩 생성 중 (켈틱, 20~30초)");
  const readRes = await fetch(`${BASE}/api/tarot/reading`, {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify({ question: "요즘 일이 잘 풀릴까요?", spread: "celtic", roomId }),
  });
  if (!readRes.ok) throw new Error(`리딩 실패(${readRes.status}): ${await readRes.text()}`);
  const raw = await readRes.text(); // 스트림이지만 본문은 안 보고 끝까지 받기만 한다
  log(`✓ 리딩 응답 수신 (${raw.length}바이트)`);

  // ── 5. 검증 ──────────────────────────────────────────────────────────────
  const readings = await userRef.collection("rooms").doc(roomId).collection("readings").get();
  log(`\n── readings ${readings.size}건`);
  for (const d of readings.docs) {
    const r = d.data();
    log(`  charged=${r.charged} cards=${(r.cards ?? []).length}장`);
    log(`  drawnCards=${r.drawnCards ? `${r.drawnCards.length}장 ✓` : "**없음 ✗**"}`);
    log(`  verdict=${r.verdict ? JSON.stringify(r.verdict) : "**없음 ✗**"}`);
  }

  const events = await db.collection("apiUsageEvents").where("createdAt", ">=", startedAt).get();
  log(`\n── apiUsageEvents ${events.size}건 (이번 실행분)`);
  for (const d of events.docs) {
    const e = d.data();
    created.push(d.ref);
    log(`  attempt=${e.attempt} final=${e.final} charged=${e.charged} outcome=${e.outcome ?? "-"} spread=${e.spread}`);
    log(`    verdict=${e.verdict ? JSON.stringify(e.verdict) : "**없음 ✗**"}`);
  }
}

async function cleanup() {
  log("\n── 정리");
  // 방 아래 readings 는 서브컬렉션이라 문서를 지워도 남는다. 먼저 훑어서 지운다.
  for (const ref of created) {
    if (ref.path?.includes("/rooms/")) {
      const subs = await ref.collection("readings").get().catch(() => ({ docs: [] }));
      for (const s of subs.docs) await s.ref.delete().catch(() => {});
    }
  }
  for (const ref of created.reverse()) {
    await ref.delete().catch((e) => log(`  삭제 실패 ${ref.path}: ${e.message}`));
  }
  log(`  문서 ${created.length}건 삭제`);
  if (idTokenForCleanup) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${webApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: idTokenForCleanup }),
      }
    ).catch((e) => ({ ok: false, text: async () => e.message }));
    if (res.ok) log("  auth 사용자 삭제");
    else log(`  ⚠️ auth 사용자 삭제 실패 — 손으로 지울 것(${UID}): ${await res.text()}`);
  }
}

try {
  await main();
  log("\n검증 완료.");
} catch (e) {
  log(`\n✗ 실패: ${e.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
