// 이 스크립트가 왜 있는가.
//
// TTL 을 `sajuReadings` 문서 한 곳에만 걸면 안 지워지는 게 남는다 — 실제 본문은 `pages`
// 서브컬렉션에, 이미지는 `assets/image` 문서에 있는데 Firestore 는 부모가 지워져도
// 서브컬렉션을 지우지 않는다(doc/사주_구현설계.md §11, src/lib/legal/retentionTimestamp.ts
// 런북). 그래서 `saveSajuPage`·`saveSajuPageFailure`(storage.ts)·`putSajuImageBytes`
// (imageStore.ts)가 이제 부모와 같은 `expiresAtTs` 를 자식 문서에도 심는다(2026-09-26).
//
// **그 코드가 배포되기 전에 이미 만들어진 문서는 이 필드가 없다.** 이 스크립트는 그런 문서를
// 찾아 부모 리포트의 `expiresAtTs` 를 그대로 복사해 넣는다 — 일회성이고, 배포 뒤에 한 번만
// 돌리면 된다(그 뒤로 새로 만드는 문서는 코드가 알아서 채운다).
//
// ══════════════════════════════════════════════════════════════════════════════
// 기본값은 **드라이런**이다. 실제로 쓰려면 `--apply` 를 명시해야 한다.
// ══════════════════════════════════════════════════════════════════════════════
//
// **이 스크립트는 아직 실행되지 않았다** — 작성만 하고 실행은 안 했다(2026-09-26). 프로덕션
// Firestore 를 쓰는 일이라 사용자 승인이 필요하다. 승인이 나면 먼저 드라이런으로 몇 건이
// 걸리는지 확인한 뒤 `--apply` 로 실행할 것.
//
// **정말 백필이 필요한지부터 판단할 것.** 지금까지 사주 리포트는 한 번도 실제 API 호출로
// 만들어진 적이 없다(doc/사주_구현설계.md §12, §11 "실호출 검증 — 구현이 끝난 뒤로 미룬다").
// QA 환경은 프로덕션과 같은 Firebase 프로젝트를 공유하므로(메모리 "QA environment") QA
// 테스트 결제가 실제 리포트를 만들었다면 그 문서들이 대상이다 — 드라이런의 건수가 0이면
// 백필이 필요 없다는 뜻이고, 이 스크립트도 지울 수 있다.
//
// ── 컬렉션 이름 충돌 주의 ─────────────────────────────────────────────────────
// `pages`·`assets` 는 collectionGroup 쿼리라 **이름이 같으면 깊이와 무관하게** 다 걸린다.
// 2026-09-26 기준 grep 으로 확인한 바로는 이 저장소에서 이 두 이름을 쓰는 곳이 사주 서브
// 컬렉션뿐이지만(src/lib/firestore/collections.ts 의 SAJU_PAGES·SAJU_ASSETS), 나중에 다른
// 기능이 같은 이름을 쓰기 시작했다면 이 스크립트가 그것까지 건드린다 — 실행 전에 다시 확인할 것.
// 그래서 아래는 한 겹 더 방어한다: 부모의 부모 컬렉션이 정확히 "sajuReadings" 인 문서만 만진다.
//
// 사용:
//   CLOUDSDK_CONFIG="$HOME/.gcloud-tayeon" \
//   GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcloud-tayeon/application_default_credentials.json" \
//   GCLOUD_PROJECT=tayeon-d5149 node scripts/backfill-saju-page-expiry.mjs           ← 드라이런
//   GCLOUD_PROJECT=tayeon-d5149 node scripts/backfill-saju-page-expiry.mjs --apply   ← 실제 백필
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const SAJU_READINGS = "sajuReadings";
const SAJU_PAGES = "pages";
const SAJU_ASSETS = "assets";

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error("GCLOUD_PROJECT 가 없다 — 어느 프로젝트를 건드리는지 명시해야 한다.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/** 이 문서가 정말 사주 리포트의 자식인지 확인한다 — 컬렉션 이름 충돌에 대한 두 번째 방어선
 *  (위 머리말 "컬렉션 이름 충돌 주의" 참고). */
function isUnderSajuReadings(docRef) {
  return docRef.parent.parent?.parent?.id === SAJU_READINGS;
}

/** 부모 리포트를 찾아 `expiresAtTs` 를 읽는다. 없으면(리포트 자체가 그 값을 가진 적 없는
 *  매우 옛 문서이거나, 부모가 이미 지워진 고아 문서) 백필하지 않고 별도로 센다 — 잘못된 값을
 *  지어내지 않는다. */
async function parentExpiresAtTs(docRef) {
  const readingRef = docRef.parent.parent;
  if (!readingRef) return null;
  const snap = await readingRef.get();
  const value = snap.data()?.expiresAtTs;
  return value && typeof value.toMillis === "function" ? value : null;
}

async function backfillCollectionGroup(collectionId) {
  const snap = await db.collectionGroup(collectionId).get();
  let missing = 0;
  let fixed = 0;
  let skippedOther = 0;
  let skippedNoParentExpiry = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    if (doc.data().expiresAtTs) continue; // 이미 있다 — 새 코드로 만들어진 문서.
    missing += 1;
    if (!isUnderSajuReadings(doc.ref)) {
      skippedOther += 1;
      continue;
    }
    const expiresAtTs = await parentExpiresAtTs(doc.ref);
    if (!expiresAtTs) {
      skippedNoParentExpiry += 1;
      console.warn(`  - 부모에 expiresAtTs 가 없어 건너뜀: ${doc.ref.path}`);
      continue;
    }
    console.log(`  - ${APPLY ? "쓴다" : "(드라이런) 썼을 것"}: ${doc.ref.path} → ${expiresAtTs.toDate().toISOString()}`);
    if (APPLY) {
      batch.update(doc.ref, { expiresAtTs });
      batchCount += 1;
      if (batchCount >= 400) {
        // Firestore batch 상한은 500 — 여유를 두고 끊는다.
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }
    fixed += 1;
  }
  if (APPLY && batchCount > 0) await batch.commit();

  console.log(
    `[${collectionId}] 전체 ${snap.size}건 · expiresAtTs 없음 ${missing}건 · ` +
      `대상(sajuReadings 자식) ${fixed}건 · 다른 기능 소유로 건너뜀 ${skippedOther}건 · ` +
      `부모 만료값 없어 건너뜀 ${skippedNoParentExpiry}건`
  );
  if (skippedOther > 0) {
    console.warn(
      `  ⚠️ "${collectionId}" 라는 이름의 컬렉션이 사주 말고 다른 곳에도 있다 — 그쪽은 이 스크립트가 건드리지 않았지만, TTL 정책을 걸 때 이 이름 충돌부터 다시 확인할 것.`
    );
  }
}

console.log(`프로젝트: ${projectId} · 모드: ${APPLY ? "적용(--apply)" : "드라이런"}`);
await backfillCollectionGroup(SAJU_PAGES);
await backfillCollectionGroup(SAJU_ASSETS);
