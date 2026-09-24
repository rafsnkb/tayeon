// 타워(관제센터)로 하루치 매출·지출을 보내는 배치.
//
// 집계 로직은 여기 없다 — src/tawer/ 의 공용 리포터가 한다. 이 파일은 **타연의 데이터가
// 어디에 어떤 이름으로 있는지**만 알려준다. 그래서 타워 계약이 바뀌어도 여기는 안 바뀌고,
// 타연 스키마가 바뀌면 여기만 바뀐다.
//
// 설정은 타워 ARCHITECTURE.md §4(전송 계약)·§5(리포터)를 따른다.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

import { createDailyReporter } from "./tawer/index.ts";
import type { MetricContext } from "./tawer/index.ts";

const TAWER_INGEST_KEY = defineSecret("TAWER_INGEST_KEY");
// 타워가 아직 배포 전이라 값이 비어 있을 수 있다. 비어 있으면 전송을 건너뛴다 —
// 실패 로그를 매일 쌓는 것보다 "아직 안 붙었다"가 한 줄 남는 게 낫다.
const TAWER_ENDPOINT = defineString("TAWER_ENDPOINT", { default: "" });

const reporter = createDailyReporter({
  serviceId: "tayeon",
  endpoint: () => TAWER_ENDPOINT.value(),
  apiKey: () => TAWER_INGEST_KEY.value(),
  db: () => getFirestore(),
  trailingDays: 7,

  // ── 매출 ────────────────────────────────────────────────────────
  // status 를 "fulfilled" 로만 좁히면 **과거 매출이 줄어든다.** 환불하면 같은 문서의
  // status 가 "refunded" 로 바뀌기 때문이다(admin/src/lib/refundExecute.ts). 후행 7일
  // 재전송이 도는 순간 그날 총결제액이 조용히 깎이고, 그러면 "얼마 팔았나"를 영영 알 수 없다.
  // 결제는 결제대로 세고 환불은 아래에서 따로 센다.
  //
  // "duplicate_cancelled"(보유 제한으로 즉시 자동취소)는 뺀다. 승인 직후 전액 취소되어
  // 실제로 남는 돈이 아니고, PG 정산에서도 결제-취소가 상계돼 0이 된다.
  payments: {
    source: { collectionGroup: "payments" },
    where: [["status", "in", ["fulfilled", "refunded"]]],
    dateField: "paidAt",
    amountField: "priceWon",
    productField: "productId",
    payerFrom: "parentDoc", // users/{uid}/payments/{id}
    // 테스트 결제를 버리지 않고 분리한다(계약 규칙 4). 카드사 심사 중이라 지금은
    // 이쪽만 들어오는데, 버리는 설계였다면 첫 실결제까지 파이프라인 검증이 불가능했다.
    testField: "isTest",
  },

  // 환불은 환불된 **날**에 귀속된다. refundedAt 은 환불된 문서에만 있어서 status 조건이
  // 필요 없다 — 필드 유무가 곧 필터다. 부분 환불이 없으므로(cancelPayment 에 금액을
  // 넘기지 않는다) 환불액은 결제액 전액이다.
  refunds: {
    source: { collectionGroup: "payments" },
    dateField: "refundedAt",
    originalDateField: "paidAt", // 전일 이전 결제분을 갈라낸다
    testField: "isTest",
  },

  // ── AI 원가 ─────────────────────────────────────────────────────
  // 단가는 넘기지 않는다. 여기 박아두면 가격이 바뀌었을 때 조용히 틀린 금액을 보고하게 된다
  // (index.ts 의 ONE_CARD_BASIS 가 정확히 그렇게 틀렸다 — 그 주석 참고).
  // 토큰 수만 보내고 금액 환산은 타워가 한다. 단가는 한 군데에만 있어야 한다.
  aiUsage: {
    source: { collection: "apiUsageEvents" },
    dateField: "createdAt",
    tokenFields: {
      input: "inputTokens",
      output: "outputTokens",
      cacheRead: "cacheReadInputTokens",
      cacheCreation: "cacheCreationInputTokens",
    },
  },

  usage: async (ctx) => {
    const day = await loadDay(ctx);
    const totals = await loadUserTotals(ctx.db);
    return {
      // users 문서에 가입 시각이 없다(provider/updatedAt 만 있고 updatedAt 은 로그인할 때마다
      // 덮어써진다). 0으로 보내면 "그날 가입자 없음"이라는 거짓말이 되므로 미측정으로 둔다.
      newUserCount: null,
      activeUserCount: day[ctx.environment].activeUsers,
      totalUserCount: ctx.environment === "live" ? totals.live : totals.test,
    };
  },

  metrics: {
    chargedReadings: async (ctx) => (await loadDay(ctx))[ctx.environment].chargedReadings,
    // "돈은 받았는데 이용권은 못 준" 상태. 자동 취소가 실패한 건이라 수동 환불이 필요하고,
    // 그전까지는 PG 정산에만 있고 타연 매출에는 없는 차이로 남는다. 월 마감에서 이걸
    // 원인 미상으로 헤매지 않게 숫자로 띄워 둔다.
    stuckDuplicateWon: async (ctx) => (await loadStuckDuplicates(ctx))[ctx.environment],
  },
});

export const tawerDailyReport = onSchedule(
  {
    // 04:10 KST — 전날이 확실히 끝난 뒤.
    schedule: "10 4 * * *",
    timeZone: "Asia/Seoul",
    region: "asia-east1", // 다른 배치와 같은 리전
    secrets: [TAWER_INGEST_KEY],
    timeoutSeconds: 540,
  },
  async () => {
    if (!TAWER_ENDPOINT.value()) {
      console.log("[tawer-reporter] TAWER_ENDPOINT 미설정 — 전송 건너뜀");
      return;
    }
    // 캐시는 실행마다 비운다. 인스턴스가 재사용되면 어제 계산한 값이 오늘 후행 재전송에
    // 그대로 실려서, 고쳐진 숫자가 영영 반영되지 않는다.
    dayCache.clear();
    stuckCache.clear();
    await reporter.run();
  }
);

// ── 타연 고유 집계 ───────────────────────────────────────────────

type DayBucket = { chargedReadings: number; activeUsers: number };
type DaySplit = { live: DayBucket; test: DayBucket };

// live/test 로 두 번 도는 동안 같은 쿼리를 두 번 하지 않는다. 함수 인스턴스가 살아 있는
// 동안만 유지되는 캐시라 날짜별로 최대 2회 쓰이고 버려진다.
const dayCache = new Map<string, Promise<DaySplit>>();
const loadDay = (ctx: MetricContext): Promise<DaySplit> => {
  const hit = dayCache.get(ctx.date);
  if (hit) return hit;
  const p = computeDay(ctx.db, ctx.startIso, ctx.endIso);
  dayCache.set(ctx.date, p);
  return p;
};

async function computeDay(db: Firestore, startIso: string, endIso: string): Promise<DaySplit> {
  const snap = await db
    .collectionGroup("readings")
    .where("charged", "==", true)
    .where("createdAt", ">=", startIso)
    .where("createdAt", "<", endIso)
    // orderBy 를 빼면 Firestore 가 (charged ASC, createdAt ASC) 인덱스를 찾는데, 있는 건
    // (charged ASC, createdAt DESC) 다(firestore.indexes.json). 방향을 맞춰 기존 인덱스를 쓴다.
    .orderBy("createdAt", "desc")
    .get();

  const countByUid = new Map<string, number>();
  let orphan = 0;
  for (const doc of snap.docs) {
    // users/{uid}/rooms/{roomId}/readings/{id}
    const uid = doc.ref.parent.parent?.parent.parent?.id;
    if (!uid) {
      orphan += 1;
      continue;
    }
    countByUid.set(uid, (countByUid.get(uid) ?? 0) + 1);
  }
  if (orphan > 0) console.warn(`[tawer-reporter] uid를 못 읽은 리딩 ${orphan}건 — live로 계상`);

  // 리딩에는 test 표시가 없다. 가입 경로로 가른다 — 실제 운영 DB에 curl 로 만든 테스트
  // 계정이 섞여 통계를 오염시킨 적이 있어서(admin/src/lib/stats.ts) 같은 기준을 쓴다.
  const uids = [...countByUid.keys()];
  const kakao = await filterKakaoUids(db, uids);

  const out: DaySplit = {
    live: { chargedReadings: orphan, activeUsers: 0 },
    test: { chargedReadings: 0, activeUsers: 0 },
  };
  for (const [uid, count] of countByUid) {
    const bucket = kakao.has(uid) ? out.live : out.test;
    bucket.chargedReadings += count;
    bucket.activeUsers += 1;
  }
  return out;
}

/** uid 들 중 provider === "kakao" 인 것만. 300개씩 끊어 한 번에 읽는다. */
async function filterKakaoUids(db: Firestore, uids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < uids.length; i += 300) {
    const refs = uids.slice(i, i + 300).map((uid) => db.collection("users").doc(uid));
    const snaps = await db.getAll(...refs, { fieldMask: ["provider"] });
    for (const s of snaps) if (s.data()?.provider === "kakao") out.add(s.id);
  }
  return out;
}

/** 전체 가입자 수. 문서를 읽지 않고 집계 쿼리로 센다. */
async function loadUserTotals(db: Firestore): Promise<{ live: number; test: number }> {
  const users = db.collection("users");
  // provider != "kakao" 로 세면 provider 필드가 아예 없는 문서가 빠진다 — 그런 문서야말로
  // 손으로 만든 테스트 계정이다. 전체에서 빼는 방식이라야 둘을 합쳐 전체가 된다.
  const [all, kakao] = await Promise.all([
    users.count().get(),
    users.where("provider", "==", "kakao").count().get(),
  ]);
  const live = kakao.data().count;
  return { live, test: all.data().count - live };
}

const stuckCache = new Map<string, Promise<{ live: number; test: number }>>();
const loadStuckDuplicates = (ctx: MetricContext) => {
  const hit = stuckCache.get(ctx.date);
  if (hit) return hit;
  const p = computeStuckDuplicates(ctx.db, ctx.startIso, ctx.endIso);
  stuckCache.set(ctx.date, p);
  return p;
};

async function computeStuckDuplicates(db: Firestore, startIso: string, endIso: string) {
  const snap = await db
    .collectionGroup("payments")
    .where("status", "==", "duplicate_cancelled")
    .where("paidAt", ">=", startIso)
    .where("paidAt", "<", endIso)
    .get();
  const out = { live: 0, test: 0 };
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.cancelFailed !== true) continue; // 정상적으로 취소된 건은 상계돼 0이다
    const won = Number(d.priceWon ?? 0);
    if (!Number.isFinite(won)) continue;
    if (d.isTest === true) out.test += won;
    else out.live += won;
  }
  return out;
}
