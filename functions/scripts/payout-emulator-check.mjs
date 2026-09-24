// functions/ 의 월간 정산 두 함수를 Firestore 에뮬레이터에서 실제로 실행해 본다.
// 실 Firestore 금지 — 에뮬레이터 호스트가 안 잡혀 있으면 바로 죽는다.
process.env.GCLOUD_PROJECT ??= "tayeon-test";
process.env.FIREBASE_CONFIG ??= JSON.stringify({ projectId: process.env.GCLOUD_PROJECT });
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST 가 없다. 실 Firestore 로 돌릴 뻔했다 — 중단.");
  process.exit(1);
}

const { getFirestore } = await import("firebase-admin/firestore");
const fns = await import("../lib/index.js");
const app = await import("../../src/lib/reward/rules.ts");

const db = getFirestore();

// functions 가 쓰는 것과 같은 방식으로 "지난달" 구간을 계산한다.
const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
const periodStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() - 1, 1));
const midLastMonth = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 15)).toISOString();
const thisMonth = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 2)).toISOString();

async function wipe() {
  const users = await db.collection("users").get();
  for (const u of users.docs) {
    for (const sub of ["payments", "pendingRewards", "bonusRewardPayouts", "referralPayouts"]) {
      const snap = await u.ref.collection(sub).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
    await u.ref.delete();
  }
}

async function seedUser(uid, { referredBy = null, payments = [] } = {}) {
  await db.collection("users").doc(uid).set(referredBy ? { referredBy } : {});
  let i = 0;
  for (const p of payments) {
    await db.collection("users").doc(uid).collection("payments").doc(`p${i++}`).set({
      status: p.status ?? "fulfilled",
      priceWon: p.priceWon,
      paidAt: p.paidAt ?? midLastMonth,
    });
  }
}

async function rewardsOf(uid) {
  const snap = await db.collection("users").doc(uid).collection("pendingRewards").get();
  return snap.docs.map((d) => d.data());
}

const results = [];
function check(name, actual, expected, note = "") {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ ok, name, actual, expected, note });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}\n      실행결과=${JSON.stringify(actual)}  기대=${JSON.stringify(expected)}${note ? `\n      ${note}` : ""}`);
}

// 앱(=사용자에게 보이는 예상치, /api/user/bonus-reward)이 같은 결제액에 대해 계산하는 값.
function appExpectedPasses(grossWon) {
  const supply = app.supplyWon(grossWon);
  return app.rewardPassesForWon(supply, app.bonusRewardRateForWon(supply));
}

await wipe();

// ── 보너스 리워드: 경계값 ────────────────────────────────────────────────
await seedUser("u_99999", { payments: [{ priceWon: 99_999 }] });
await seedUser("u_100000", { payments: [{ priceWon: 100_000 }] });
await seedUser("u_100001", { payments: [{ priceWon: 100_001 }] });
await seedUser("u_110000", { payments: [{ priceWon: 110_000 }] });         // 공급가액 정확히 10만
await seedUser("u_split", { payments: [{ priceWon: 60_000 }, { priceWon: 60_000 }] }); // 합산 12만
await seedUser("u_refunded", { payments: [{ priceWon: 100_000, status: "refunded" }] });
await seedUser("u_thismonth", { payments: [{ priceWon: 1_000_000, paidAt: thisMonth }] });
await seedUser("u_1100000", { payments: [{ priceWon: 1_100_000 }] });      // 공급가액 100만 = 최상위 구간

await fns.monthlyBonusRewardPayout.run({});

for (const [uid, gross] of [["u_99999", 99_999], ["u_100000", 100_000], ["u_100001", 100_001], ["u_110000", 110_000], ["u_split", 120_000], ["u_1100000", 1_100_000]]) {
  const got = (await rewardsOf(uid)).map((r) => r.freePasses);
  check(
    `보너스 ${uid} (결제총액 ${gross.toLocaleString()}원)`,
    got,
    appExpectedPasses(gross) > 0 ? [appExpectedPasses(gross)] : [],
    `앱 예상치 기준: 공급가액 ${app.supplyWon(gross).toLocaleString()}원 · 요율 ${app.bonusRewardRateForWon(app.supplyWon(gross))} → ${appExpectedPasses(gross)}회`
  );
}
check("보너스 환불건 제외 (u_refunded)", (await rewardsOf("u_refunded")).length, 0);
check("보너스 이번달 결제 제외 (u_thismonth)", (await rewardsOf("u_thismonth")).length, 0);

// 멱등성 — 같은 달에 두 번 실행
await fns.monthlyBonusRewardPayout.run({});
check("보너스 멱등성 (재실행해도 1건)", (await rewardsOf("u_1100000")).length, 1);

// basis 가 freePasses × 원카드 단가와 맞는지
const r = (await rewardsOf("u_1100000"))[0];
check("보너스 basis = freePasses × 원카드 단가", r?.basis, (r?.freePasses ?? 0) * app.ONE_CARD_BASIS);
check("보너스 status/claimedAt 스키마", [r?.status, r?.claimedAt, typeof r?.claimWindowExpiresAt], ["pending", null, "string"]);

// ── 친구 결제 리워드 ────────────────────────────────────────────────────
await wipe();
await seedUser("ref_A");                                                    // 추천인
await seedUser("friend_1", { referredBy: "ref_A", payments: [{ priceWon: 60_000 }] });
await seedUser("friend_2", { referredBy: "ref_A", payments: [{ priceWon: 60_000 }] });  // 합산 12만 → 지급
await seedUser("ref_B");
await seedUser("friend_3", { referredBy: "ref_B", payments: [{ priceWon: 99_999 }] });  // 미달 → 미지급
await seedUser("ref_C");
await seedUser("friend_4", { referredBy: "ref_C", payments: [{ priceWon: 110_000 }] }); // 공급가액 정확히 10만

await fns.monthlyReferralPayout.run({});

function appReferralPasses(grossSum) {
  const supply = app.supplyWon(grossSum);
  if (supply < app.REFERRAL_MONTHLY_MIN_WON) return 0;
  return app.rewardPassesForWon(supply, app.REFERRAL_MONTHLY_COMMISSION_RATE);
}
for (const [uid, sum] of [["ref_A", 120_000], ["ref_B", 99_999], ["ref_C", 110_000]]) {
  const got = (await rewardsOf(uid)).map((x) => x.freePasses);
  const want = appReferralPasses(sum);
  check(
    `친구결제 ${uid} (친구 합산 ${sum.toLocaleString()}원)`,
    got,
    want > 0 ? [want] : [],
    `앱 기준: 공급가액 ${app.supplyWon(sum).toLocaleString()}원 · 하한 ${app.REFERRAL_MONTHLY_MIN_WON.toLocaleString()}원 → ${want}회`
  );
}
await fns.monthlyReferralPayout.run({});
check("친구결제 멱등성 (재실행해도 1건)", (await rewardsOf("ref_A")).length, 1);

const failed = results.filter((x) => !x.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`);
process.exit(failed.length ? 1 : 0);
