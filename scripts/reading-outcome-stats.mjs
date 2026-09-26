// 무과금 리딩이 왜 무과금이 됐는지를 사유별로 세는 집계 스크립트.
//
// 2026-09-26 전수 조사에서 무과금이 241건 중 62건(25.7%)이었고, 그 대부분이 어뷰즈도 안내도
// 아닌 "안전망이 이건 리딩이 아니라고 본" 경우였다. 안전망 기준을 손본 뒤 며칠 지나 같은 집계를
// 다시 돌려 개선 여부를 보려고 일회성 조사 스크립트 대신 정식 스크립트로 남긴다.
//
// **완전 읽기 전용이다.** write/update/delete 를 한 줄도 하지 않는다 — 진단 목적으로 프로덕션
// Firestore 를 직접 읽기 때문에, 실수로 운영 데이터를 건드릴 여지를 아예 두지 않는다.
//
// 컬렉션 그룹 쿼리에 where/orderBy 를 쓰지 않는 이유: readings 는 방(tarotRooms) 아래
// 서브컬렉션이라 collectionGroup 에 필터를 걸면 COLLECTION_GROUP_ASC 복합 인덱스를 요구한다.
// 이 진단 하나를 위해 프로덕션에 인덱스를 추가할 일은 아니고, 문서 수도 수백 단위라 필터 없이
// 전량 스캔해서 메모리에서 세는 게 싸다. 문서가 수만 건으로 늘면 그때 다시 생각할 문제다.
//
// 사용:
//   CLOUDSDK_CONFIG="$HOME/.gcloud-tayeon" \
//   GOOGLE_APPLICATION_CREDENTIALS="$HOME/.gcloud-tayeon/application_default_credentials.json" \
//   GCLOUD_PROJECT=tayeon-d5149 node scripts/reading-outcome-stats.mjs
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) {
  console.error("GCLOUD_PROJECT 가 없다 — 어느 프로젝트를 읽는지 명시해야 한다.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const pct = (n, total) => (total === 0 ? "—" : `${((n / total) * 100).toFixed(1)}%`);
const bar = (n, max) => "█".repeat(max === 0 ? 0 : Math.round((n / max) * 24));

// ── readings 전량 스캔 ────────────────────────────────────────────────────────
const readingDocs = (await db.collectionGroup("readings").get()).docs.map((d) => d.data());

// 계측 이전(2026-09-10) 문서에는 guidanceOnly/flaggedForAbuse 필드가 아예 없다. 없는 걸 false
// 로 읽으면 전부 slip 으로 잡혀 사유 분포가 통째로 거짓이 된다 — 그래서 "분류불가(legacy)" 로
// 따로 세고, 사유별 비율의 분모에서 뺀다.
const hasReasonFields = (r) =>
  typeof r.guidanceOnly === "boolean" || typeof r.flaggedForAbuse === "boolean";

// 2026-09-08 문서 11건에는 charged 필드 자체가 없다(코인 시절 — 차감액이 cost 에만 있었다).
// 이걸 "charged !== true" 로 읽으면 전부 무과금으로 잡혀 무과금 비율이 25.7% → 30.3% 로 부풀고,
// legacy 버킷도 35건이 아니라 46건이 된다. 과금 여부를 알 수 없는 문서라 모든 비율에서 뺀다.
const knowsCharged = (r) => typeof r.charged === "boolean";

const counts = { charged: 0, abuse: 0, guidance: 0, slip: 0, legacy: 0, preLlm: 0, preChargedField: 0 };
const spreadSlip = new Map(); // spread → { total, slip }
const byDay = new Map(); // YYYY-MM-DD → { total, free }
const nearMiss = new Map(); // "9/10" → 건수
let demotedByKeywordGate = 0;
let verdictPresent = 0;

for (const r of readingDocs) {
  if (!knowsCharged(r)) {
    counts.preChargedField += 1;
    continue;
  }
  const charged = r.charged === true;
  const day = typeof r.createdAt === "string" ? r.createdAt.slice(0, 10) : "unknown";
  const dayBucket = byDay.get(day) ?? { total: 0, free: 0, classifiable: 0, slip: 0 };
  dayBucket.total += 1;
  if (!charged) dayBucket.free += 1;
  byDay.set(day, dayBucket);

  const spread = typeof r.spread === "string" ? r.spread : "unknown";
  const spreadBucket = spreadSlip.get(spread) ?? { total: 0, slip: 0 };

  if (r.verdict && typeof r.verdict === "object") {
    verdictPresent += 1;
    // 키워드 게이트(looksLikeInjection)가 모델의 no_charge 마커를 안내로 강등시킨 건수.
    // 지금까지 console.warn 으로만 나가서 사후에 셀 수 없던 값이다.
    if (r.verdict.markerRaw === "no_charge" && r.verdict.abuseConfirmed === false) {
      demotedByKeywordGate += 1;
    }
    const drawn = r.verdict.drawnCardCount;
    const mentioned = r.verdict.mentionedDrawnCardCount;
    if (typeof drawn === "number" && typeof mentioned === "number" && !charged) {
      const key = `${mentioned}/${drawn}`;
      nearMiss.set(key, (nearMiss.get(key) ?? 0) + 1);
    }
  }

  // slip 비율의 분모는 "사유 필드가 있어서 slip 인지 아닌지 판정 가능한 문서"다. 과금분도 포함해야
  // 비율이 되지만, 사유 필드가 없던 시절 문서는 과금분까지 통째로 빼야 한다 — 아래 legacy 분기는
  // 무과금만 세기 때문에(과금 문서는 첫 분기에서 먼저 걸린다) 사유 필드가 없는 과금 문서 118건이
  // 집계에서 안 보인다. 그걸 분모에 넣으면 slip 비율이 구조적으로 과소평가된다.
  const reasonKnown = hasReasonFields(r);
  // LLM 호출 전 결정적 차단(route.ts:340 — 궁합 옵션 없이 파트너를 물은 경우). 그 경로는 문서에
  // timePassApplied 를 쓰지 않고 본 경로는 항상 쓰므로, 이게 "모델을 부르지도 않았다"의 표지다.
  // verdict 부재로 판정하면 계측 배포 전의 LLM 경유 안내까지 여기로 흡수된다(실제로 09-12 의
  // 안내 1건이 그렇게 섞여 들어가 guidance 가 0건으로 나왔다). 토큰을 안 썼으니 낭비 집계에서 뺀다.
  // 남는 구멍(2026-09-26 확인): 2026-09-12 이전에 **LLM 을 거친** guidance 가 있었다면 그 시절엔
  // 본 경로도 timePassApplied 를 쓰지 않았으므로 사전 차단으로 잘못 집힌다. 현재 데이터에는 없다 —
  // 09-10 에 guidanceOnly 를 가진 문서는 그 3건(전부 사전 차단)뿐이고 역방향도 0건이다. 이 창은
  // 다시 열리지 않으니 코드로 막지 않고, 같은 표지를 의심할 사람을 위해 적어만 둔다.
  const preLlmBlocked = reasonKnown && r.guidanceOnly === true && !("timePassApplied" in r);
  if (reasonKnown && !preLlmBlocked) {
    spreadBucket.total += 1;
    spreadSlip.set(spread, spreadBucket);
    dayBucket.classifiable += 1;
  }

  if (charged) {
    counts.charged += 1;
  } else if (!reasonKnown) {
    counts.legacy += 1;
  } else if (preLlmBlocked) {
    counts.preLlm += 1;
  } else if (r.flaggedForAbuse === true) {
    counts.abuse += 1;
  } else if (r.guidanceOnly === true) {
    counts.guidance += 1;
  } else {
    counts.slip += 1;
    spreadBucket.slip += 1;
    spreadSlip.set(spread, spreadBucket);
    dayBucket.slip += 1;
  }
}

const total = readingDocs.length - counts.preChargedField;
const free = total - counts.charged;
// 분류 가능한 무과금 = legacy 를 뺀 나머지. 사유별 비율은 이 분모로 낸다.
const classifiable = counts.abuse + counts.guidance + counts.slip + counts.preLlm;

console.log(`\n=== 리딩 무과금 사유 집계 (${new Date().toISOString().slice(0, 10)}, ${projectId}) ===`);
console.log(`\n[1] 전체 ${total}건 / 과금 ${counts.charged}건(${pct(counts.charged, total)}) / 무과금 ${free}건(${pct(free, total)})`);

console.log(`\n[2] 무과금 사유별 (분모 = 분류가능 ${classifiable}건, legacy 제외)`);
for (const [label, n] of [
  ["slip (안전망이 리딩이 아니라고 판단)", counts.slip],
  ["guidance (안내만, 사용자 잘못 아님)", counts.guidance],
  ["abuse (인젝션·무관 요청 확정)", counts.abuse],
  ["[4] pre-LLM 차단 (모델 호출 전, 토큰 0)", counts.preLlm],
]) {
  console.log(`  ${label.padEnd(40)} ${String(n).padStart(4)}건  ${pct(n, classifiable)}`);
}

console.log(`\n[3] 분류불가(legacy) ${counts.legacy}건 — guidanceOnly/flaggedForAbuse 필드 자체가 없는 계측 이전 문서.`);
console.log(`    slip 으로 세면 안 된다. 위 비율의 분모에서 빠져 있다.`);
console.log(`    verdict 필드가 있는 문서: ${verdictPresent}건 / ${total}건 (계측 적용 이후)`);
if (verdictPresent === 0) {
  console.log(`    verdict 가 0건이면 계측이 아직 배포되지 않은 것이다 — [5][6] 과 [7] 의 outcome 분해는 그때까지 비어 있다.`);
}

console.log(`\n[5] 키워드 게이트 강등: ${demotedByKeywordGate}건`);
console.log(`    모델은 no_charge 마커를 박았지만 looksLikeInjection 이 통과시키지 않아 안내로 낮춘 건수.`);

console.log(`\n[6] 안전망 근접 실패 분포 (무과금 건의 호명 카드 수 / 뽑힌 카드 수)`);
if (nearMiss.size === 0) {
  console.log("  (verdict 가 있는 무과금 건이 없다)");
} else {
  const rows = [...nearMiss.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0][1];
  for (const [key, n] of rows) {
    console.log(`  ${key.padStart(7)}  ${String(n).padStart(4)}건 ${bar(n, max)}`);
  }
  console.log(`    "10장 중 9장만 호명" 류가 많으면 전량 호명 기준이 과하다는 근거가 된다.`);
}

// ── apiUsageEvents: 버려진 토큰 ───────────────────────────────────────────────
const usageDocs = (await db.collection("apiUsageEvents").get()).docs.map((d) => d.data());
const finalEvents = usageDocs.filter((e) => e.final === true);
const retryEvents = usageDocs.filter((e) => e.attempt === 2);
const tokensOf = (e) =>
  (e.inputTokens ?? 0) + (e.outputTokens ?? 0) + (e.cacheReadInputTokens ?? 0) + (e.cacheCreationInputTokens ?? 0);
const days = usageDocs
  .map((e) => (typeof e.createdAt === "string" ? e.createdAt.slice(0, 10) : null))
  .filter(Boolean)
  .sort();

const byOutcome = new Map();
for (const e of finalEvents) {
  const key = typeof e.outcome === "string" ? e.outcome : "(outcome 없음)";
  const b = byOutcome.get(key) ?? { n: 0, tokens: 0 };
  b.n += 1;
  b.tokens += tokensOf(e);
  byOutcome.set(key, b);
}

console.log(`\n[7] 원장(apiUsageEvents) 기준 토큰 — final:true 이벤트만`);
console.log(`    ※ 원장 ${usageDocs.length}건은 readings ${total}건보다 적어 전 기간을 덮지 못한다.`);
console.log(`    ※ 이 절의 수치는 원장이 덮는 기간(${days[0] ?? "—"} ~ ${days.at(-1) ?? "—"})만 대상이다.`);
let wasted = 0;
if (byOutcome.size === 0) {
  console.log(`  (final:true 이벤트가 없다 — outcome/final 계측이 아직 배포되지 않았다)`);
}
for (const [outcome, b] of [...byOutcome.entries()].sort((a, b) => b[1].tokens - a[1].tokens)) {
  console.log(`  ${outcome.padEnd(18)} ${String(b.n).padStart(4)}건  ${String(b.tokens).padStart(9)} 토큰`);
  if (outcome !== "charged" && outcome !== "(outcome 없음)") wasted += b.tokens;
}
console.log(`  → 버려진 토큰(charged 아닌 final 이벤트 합): ${wasted}`);
console.log(`  → 재시도 비용(attempt===2 이벤트, final 여부 무관): ${retryEvents.length}건 ${retryEvents.reduce((s, e) => s + tokensOf(e), 0)} 토큰`);

// ── 일자별·스프레드별 ────────────────────────────────────────────────────────
console.log(`\n[8-a] 일자별 무과금 비율 + slip 비율`);
console.log(`    slip 비율의 분모는 그날의 판정가능 건수([8-b] 와 같은 기준)다. 사유 필드 도입 전 날짜는`);
console.log(`    판정가능이 0~3건뿐이라 slip 이 비어 보인다 — 데이터가 없다는 뜻이고 개선된 게 아니다.`);
for (const [day, b] of [...byDay.entries()].sort()) {
  const mark = b.classifiable < b.total / 2 ? "  ← 사유 필드 도입 전" : "";
  console.log(
    `  ${day}  전체 ${String(b.total).padStart(4)}  무과금 ${String(b.free).padStart(4)}  ${pct(b.free, b.total).padStart(6)}` +
      `   판정가능 ${String(b.classifiable).padStart(4)}  slip ${String(b.slip).padStart(3)}  ${pct(b.slip, b.classifiable).padStart(6)}${mark}`
  );
}
console.log(`\n[8-b] 스프레드별 slip 비율`);
console.log(`    분모 = 사유 필드가 있어 판정 가능한 문서(과금분 포함, legacy 전체·pre-LLM 제외).`);
console.log(`    모수가 얇으니 비율만 보고 순서를 신호로 읽지 말 것 — 건수를 같이 보세요.`);
for (const [spread, b] of [...spreadSlip.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.log(`  ${spread.padEnd(16)} 판정가능 ${String(b.total).padStart(4)}  slip ${String(b.slip).padStart(4)}  ${pct(b.slip, b.total)}`);
}
console.log();
