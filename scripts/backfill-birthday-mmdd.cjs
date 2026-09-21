// 일회성 백필 — 기존 users 문서에 정규화된 생일(birthdayMMDD)을 심는다.
//
// 생일 쿠폰 일배치가 users 전체 스캔에서 birthdayMMDD 동등 쿼리로 바뀌었기 때문에
// (functions/src/index.ts), 이 필드가 없는 기존 사용자는 쿠폰을 받지 못한다. 배포 전에 한 번
// 실행할 것. 여러 번 실행해도 안전하다(이미 같은 값이면 건너뛴다).
//
//   node scripts/backfill-birthday-mmdd.cjs          # 무엇이 바뀔지만 출력(기본)
//   node scripts/backfill-birthday-mmdd.cjs --apply  # 실제 반영
//
// 로컬에서 돌리려면 gcloud ADC가 살아 있어야 한다: gcloud auth application-default login
const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const APPLY = process.argv.includes("--apply");

initializeApp({ credential: applicationDefault(), projectId: "tayeon-d5149" });
const db = getFirestore();

// src/lib/user/birthday.ts의 normalizeBirthdayMMDD와 동일한 규칙(스크립트라 TS를 못 import).
function normalizeBirthdayMMDD(kakaoBirthday, birthDate) {
  if (typeof kakaoBirthday === "string" && /^\d{4}$/.test(kakaoBirthday)) return kakaoBirthday;
  if (typeof birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return birthDate.slice(5, 10).replace("-", "");
  }
  return null;
}

(async () => {
  const snap = await db.collection("users").get();
  let changed = 0;
  let unchanged = 0;
  let noBirthday = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const next = normalizeBirthdayMMDD(data.kakaoBirthday, data.birthInfo?.birthDate);
    if (next === null) {
      noBirthday++;
      continue;
    }
    if (data.birthdayMMDD === next) {
      unchanged++;
      continue;
    }
    changed++;
    console.log(`  ${doc.id}: ${data.birthdayMMDD ?? "(없음)"} -> ${next}`);
    if (APPLY) {
      batch.set(doc.ref, { birthdayMMDD: next }, { merge: true });
      pending++;
      if (pending >= 400) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }
  if (APPLY && pending > 0) await batch.commit();

  console.log(
    `\n전체 ${snap.size}명 / 반영 대상 ${changed} / 이미 일치 ${unchanged} / 생일 정보 없음 ${noBirthday}`
  );
  console.log(APPLY ? "반영 완료" : "미반영(확인만) — 실제로 적용하려면 --apply 를 붙여 다시 실행");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
