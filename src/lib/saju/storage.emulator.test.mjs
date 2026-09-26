// 저장 계층의 **트랜잭션 실행 경로** 테스트. Firestore 에뮬레이터가 있어야 돈다.
//
// 순수 판정(`pageGateReason`·`openGateReason`)은 `purchase.test.mjs` 가 이미 덮는다. 여기서
// 덮는 건 그 판정이 **트랜잭션 안에서 실제로 걸리는가**다 — 멱등성, 덮어쓰기 금지, 실패 자리표가
// 뒤를 풀어 주는 동작. 거기가 돈이 어긋나는 자리다.
//
// ⚠️ **가드는 fail-closed 다.** 아래 세 조건 중 하나라도 안 맞으면 **아무것도 하지 않고** 전부
// 건너뛴다. 이게 유일한 방어선이다 — 이게 없으면 같은 코드가 프로덕션 Firestore 를 친다.
//   1. FIRESTORE_EMULATOR_HOST 가 있어야 한다
//   2. FIREBASE_AUTH_EMULATOR_HOST 가 있어야 한다
//   3. GCLOUD_PROJECT 가 정확히 "tayeon-test" 여야 한다 — 변수 두 개만으로는 실수 한 번에 뚫린다
// 그래서 `npm test` 를 그냥 돌리면 이 파일은 조용히 skip 되고, 에뮬레이터를 띄웠을 때만 돈다.
//
// 실행:
//   firebase emulators:start --only firestore,auth --project tayeon-test
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//     GCLOUD_PROJECT=tayeon-test npm test
import test from "node:test";
import assert from "node:assert/strict";

const EXPECTED_PROJECT = "tayeon-test";
const emulatorReady =
  Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
  Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
  process.env.GCLOUD_PROJECT === EXPECTED_PROJECT;

if (!emulatorReady) {
  test("Firestore 에뮬레이터 테스트 (건너뜀)", { skip: "에뮬레이터 환경변수가 없다" }, () => {});
}

// import 자체가 admin SDK 를 초기화하므로 가드 뒤에서 한다.
const storage = emulatorReady ? await import("@/lib/saju/storage") : null;

const suite = emulatorReady ? test : () => {};

let seq = 0;
/** 테스트마다 다른 uid 를 쓴다 — 에뮬레이터를 비우지 않아도 서로 간섭하지 않는다. */
const newUid = () => `emu-${process.pid}-${(seq += 1)}`;

const birthInfo = {
  calendarType: "solar",
  isLeapMonth: false,
  birthDate: "1996-04-12",
  birthTime: "14:30",
  timeUnknown: false,
  jasiRule: "midnight",
  gender: "female",
  useTrueSolarTime: false,
  birthPlace: null,
};

const chart = { mode: "integrated", saju: null, sajuFortune: null, ziwei: null, ziweiHoroscope: null };
const outline = {
  sections: [
    { id: "a", title: "가", gist: "", sajuBasis: "", ziweiBasis: "" },
    { id: "b", title: "나", gist: "", sajuBasis: "", ziweiBasis: "" },
    { id: "c", title: "다", gist: "", sajuBasis: "", ziweiBasis: "" },
  ],
  thesis: "",
  usedMetaphors: [],
  imageBrief: null,
};
const section = (title) => ({
  id: "a",
  title,
  summary: "요지",
  sajuBasis: "사주",
  ziweiBasis: "자미두수",
  crossStatus: null,
  crossSummary: "",
  actionGuide: "행동",
});

async function openedReading(uid) {
  return storage.createSajuReading({
    uid,
    productSlug: "single-love",
    birthInfo,
    chart,
    outline,
    userInput: "",
    paymentId: "pay-1",
  });
}

suite("주문 마커가 결제 → 환불을 거치며 열기를 막는다", async () => {
  const uid = newUid();
  await storage.recordSajuOrderIntent({
    uid,
    paymentId: "pay-1",
    productSlug: "single-love",
    mode: "integrated",
    birthSnapshot: birthInfo,
    userInput: "",
  });
  assert.equal((await storage.getSajuOrder(uid, "pay-1")).status, "pending");

  // fulfill 의 네 번째 갈래가 하는 일 — 트랜잭션 안에서 paid 로 올린다.
  const { adminDb } = await import("@/lib/firebase/admin");
  await adminDb.runTransaction(async (tx) => {
    await tx.get(storage.sajuOrderRef(uid, "pay-1"));
    storage.markSajuOrderPaid(tx, uid, "pay-1", "2026-09-26T00:00:00.000Z");
  });
  assert.equal((await storage.getSajuOrder(uid, "pay-1")).status, "paid");

  // revoke 가 하는 일 — 마커를 내린다. 환불이 열기보다 먼저 온 경우다.
  await adminDb.runTransaction(async (tx) => {
    await tx.get(storage.sajuOrderRef(uid, "pay-1"));
    storage.markSajuOrderRefunded(tx, uid, "pay-1");
  });
  const refunded = await storage.getSajuOrder(uid, "pay-1");
  assert.equal(refunded.status, "refunded");
  assert.equal(refunded.readingId, null, "환불된 주문에 리포트가 붙어 있으면 안 된다");
});

suite("리포트와 마커를 한 트랜잭션에서 묶는다 — 둘 중 하나만 남지 않는다", async () => {
  const uid = newUid();
  await storage.recordSajuOrderIntent({
    uid,
    paymentId: "pay-1",
    productSlug: "single-love",
    mode: "integrated",
    birthSnapshot: birthInfo,
    userInput: "",
  });
  const { adminDb } = await import("@/lib/firebase/admin");
  const readingId = storage.newSajuReadingId(uid);
  await adminDb.runTransaction(async (tx) => {
    await tx.get(storage.sajuOrderRef(uid, "pay-1"));
    await storage.createSajuReading({
      uid,
      id: readingId,
      productSlug: "single-love",
      birthInfo,
      chart,
      outline,
      userInput: "",
      paymentId: "pay-1",
      tx,
    });
    tx.update(storage.sajuOrderRef(uid, "pay-1"), { readingId });
  });
  assert.equal((await storage.getSajuOrder(uid, "pay-1")).readingId, readingId);
  const saved = await storage.getSajuReading(uid, readingId);
  assert.equal(saved.id, readingId);
  // 뽑은 판을 그대로 얼려 두는가(§7) — 재계산 없이 이걸 다시 쓴다.
  assert.deepEqual(saved.birthSnapshot, birthInfo);
  assert.deepEqual(saved.chart, chart);
  assert.equal(saved.status, "generating");
  assert.equal(saved.lastReadPage, 0);
});

suite("같은 페이지를 두 번 저장해도 먼저 쓴 본문이 남는다 — 읽던 문장이 바뀌지 않는다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  const first = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("처음") });
  assert.equal(first.outcome, "created");

  const second = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("나중") });
  assert.equal(second.outcome, "exists");
  assert.equal(second.page.title, "처음", "나중 것이 먼저 것을 덮었다");
  assert.equal((await storage.getSajuPage(uid, reading.id, 1)).title, "처음");
});

suite("동시에 같은 페이지를 저장해도 하나만 이긴다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  const results = await Promise.all([
    storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("A") }),
    storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("B") }),
  ]);
  const created = results.filter((r) => r.outcome === "created");
  assert.equal(created.length, 1, "둘 다 created 면 나중 것이 먼저 것을 덮었다는 뜻이다");
  const stored = await storage.getSajuPage(uid, reading.id, 1);
  assert.equal(stored.title, created[0].page.title);
});

suite("앞 페이지가 없으면 트랜잭션이 거절한다 — 순차 제약이 서버에서 걸린다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  const skipped = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 3, section: section("셋") });
  assert.equal(skipped.outcome, "rejected");
  assert.equal(skipped.gate.reason, "missing_previous");
  assert.equal(skipped.gate.missing, 2);
  assert.equal(await storage.getSajuPage(uid, reading.id, 3), null, "거절했는데 문서가 써졌다");

  const tooFar = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 9, section: section("아홉") });
  assert.equal(tooFar.gate.reason, "out_of_range");
});

suite("실패 자리표가 뒤를 풀어 준다 — 그리고 재시도 성공이 자리표를 본문으로 바꾼다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("하나") });

  // 2번이 3회까지 실패했다. 자리표가 없으면 3번부터 끝까지 영구히 막힌다.
  const placeholder = await storage.saveSajuPageFailure({ uid, id: reading.id, pageNumber: 2, attempts: 3 });
  assert.equal(placeholder.outcome, "created");
  assert.equal(placeholder.page.kind, "failed");
  assert.equal(placeholder.page.attempts, 3);

  // 자리표 덕분에 3번이 만들어진다.
  const third = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 3, section: section("셋") });
  assert.equal(third.outcome, "created");

  // 자리표에 또 실패를 쓰려 해도 덮지 않는다.
  const again = await storage.saveSajuPageFailure({ uid, id: reading.id, pageNumber: 2, attempts: 9 });
  assert.equal(again.outcome, "exists");
  assert.equal(again.page.attempts, 3);

  // 뒤늦게 재시도가 성공하면 **자리표는 본문으로 바뀐다**(덮어쓰기 금지의 유일한 예외).
  const retried = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 2, section: section("둘") });
  assert.equal(retried.outcome, "created");
  const stored = await storage.getSajuPage(uid, reading.id, 2);
  assert.equal(stored.kind, "section");
  assert.equal(stored.title, "둘");
});

suite("환불로 잠근 리포트는 뒤 페이지가 생성되지 않는다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 1, section: section("하나") });

  const { adminDb } = await import("@/lib/firebase/admin");
  await adminDb.runTransaction(async (tx) => {
    await tx.get(storage.sajuOrderRef(uid, "pay-1"));
    storage.markSajuReadingFailed(uid, reading.id, "결제 취소로 회수됨", tx);
  });
  assert.equal((await storage.getSajuReading(uid, reading.id)).status, "failed");

  const blocked = await storage.saveSajuPage({ uid, id: reading.id, pageNumber: 2, section: section("둘") });
  assert.equal(blocked.outcome, "rejected");
  assert.equal(blocked.gate.reason, "reading_failed");
  assert.equal(await storage.getSajuPage(uid, reading.id, 2), null);
});

suite("총평은 한 번만 쓰이고, 이미지는 다시 뽑을 때마다 횟수만 오른다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  const closing = { title: "총평", body: "본문", nextSteps: [] };
  assert.equal((await storage.saveSajuClosing({ uid, id: reading.id, closing })).outcome, "created");
  assert.equal((await storage.getSajuReading(uid, reading.id)).status, "complete");

  const again = await storage.saveSajuClosing({ uid, id: reading.id, closing: { ...closing, body: "다른 본문" } });
  assert.equal(again.outcome, "exists");
  assert.equal((await storage.getSajuReading(uid, reading.id)).closing.body, "본문");

  // 이미지는 반대로 **덮는 게 맞다** — 사용자가 "다시 그려 달라"를 누른 결과다.
  assert.deepEqual(await storage.saveSajuImage({ uid, id: reading.id, url: "a.webp" }), {
    url: "a.webp",
    regeneratedCount: 0,
  });
  assert.deepEqual(await storage.saveSajuImage({ uid, id: reading.id, url: "b.webp" }), {
    url: "b.webp",
    regeneratedCount: 1,
  });
});

suite("읽던 위치는 뒤로 넘겨도 그대로 기록된다", async () => {
  const uid = newUid();
  const reading = await openedReading(uid);
  await storage.updateLastReadPage(uid, reading.id, 3);
  assert.equal((await storage.getSajuReading(uid, reading.id)).lastReadPage, 3);
  // "가장 멀리 본"이 아니라 "마지막으로 본"이다 — 다시 들어오면 덮던 자리에서 이어져야 한다.
  await storage.updateLastReadPage(uid, reading.id, 1);
  assert.equal((await storage.getSajuReading(uid, reading.id)).lastReadPage, 1);
});

suite("저장분 조회는 페이지를 번호 순으로 준다 — 문서 id 문자열 순이 아니다", async () => {
  const uid = newUid();
  const many = {
    ...outline,
    sections: Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, title: `${i}`, gist: "", sajuBasis: "", ziweiBasis: "" })),
  };
  const reading = await storage.createSajuReading({
    uid,
    productSlug: "single-love",
    birthInfo,
    chart,
    outline: many,
    userInput: "",
  });
  for (let n = 1; n <= 11; n += 1) {
    await storage.saveSajuPage({ uid, id: reading.id, pageNumber: n, section: section(`page${n}`) });
  }
  const { pages } = await storage.getSajuReadingWithPages(uid, reading.id);
  assert.deepEqual(
    pages.map((p) => p.pageNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    '문서 id 문자열 정렬이면 "10" 이 "2" 앞에 온다'
  );
});

suite("궁합 상품은 상대 스냅샷까지 얼려 저장하고 그대로 복원한다", async () => {
  const uid = newUid();
  const partnerSnapshot = {
    nickname: "혜윤",
    birthInfo: { ...birthInfo, birthDate: "1994-07-03", gender: "male" },
  };
  const reading = await storage.createSajuReading({
    uid,
    productSlug: "crush-reading",
    birthInfo,
    partnerSnapshot,
    chart: { mode: "integrated", self: null, partner: null },
    outline,
    userInput: "",
  });
  const saved = await storage.getSajuReading(uid, reading.id);
  // 닉네임까지 얼려야 한다 — 본문이 상대를 그 이름으로 부르고, 프로필 닉네임은 나중에 바뀔 수
  // 있으며 구매 화면에서 고친 값은 프로필에 아예 없을 수도 있다.
  assert.deepEqual(saved.partnerBirthSnapshot, partnerSnapshot);
  assert.equal(saved.partnerBirthSnapshot.nickname, "혜윤");

  // 상대가 필요 없는 상품은 null 로 남는다.
  const solo = await storage.createSajuReading({
    uid,
    productSlug: "single-love",
    birthInfo,
    chart,
    outline,
    userInput: "",
  });
  assert.equal((await storage.getSajuReading(uid, solo.id)).partnerBirthSnapshot, null);
});
