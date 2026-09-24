// ⚠ 자동 복사본 — 여기서 고치지 마세요.
//
// 원본: tawer/packages/reporter/src/index.ts (@tawer/reporter@1.0.0)
// 고칠 일이 있으면 타워에서 고치고 아래 명령으로 다시 복사합니다.
//   node scripts/sync-reporter.mjs C:/Works/tayeon/functions/src/tawer
//
// 여기서 직접 고치면 다음 복사 때 조용히 사라집니다.

// @tawer/reporter — 서비스가 하루치 매출·지출을 타워로 보내는 공용 리포터.
//
// 설계 의도(ARCHITECTURE.md §0, §5): 서비스마다 집계 코드를 새로 짜지 않는다.
// **매핑 설정**만 넘기면 나머지(KST 날짜 경계, 후행 재전송, live/test 분리,
// 재시도, 계약 모양 맞추기)는 여기서 한다.
//
// 이 패키지는 firebase-functions에 의존하지 않는다. 스케줄·리전·시크릿·메모리는
// **배포하는 쪽의 결정**이라 서비스가 직접 onSchedule로 감싼다. 그래야 리포터를
// 고치지 않고도 리전을 옮기거나 실행 주기를 바꿀 수 있다.

import { Timestamp } from "firebase-admin/firestore";
import type { Firestore, Query, WhereFilterOp } from "firebase-admin/firestore";

import { toKstDate, kstDayRange, trailingKstDates } from "./dates.ts";
import { aggregateRevenue, tokenCostUsd } from "./aggregate.ts";
import type { PaymentRow, RefundRow, PricePerMillionUsd, TokenCounts } from "./aggregate.ts";
import { sendReport } from "./send.ts";
import type { SendResult } from "./send.ts";

export const CONTRACT_VERSION = 1;
export const REPORTER_VERSION = "@tawer/reporter@1.0.0";

export type Environment = "live" | "test";
export type Source = { collection: string } | { collectionGroup: string };
export type Where = [field: string, op: WhereFilterOp, value: unknown];

/**
 * 날짜 필드가 ISO 문자열인지 Firestore Timestamp인지.
 * 쿼리 경계 타입을 읽기 **전에** 정해야 해서 자동 판별이 불가능하다 —
 * 추측이 틀리면 결과가 0건이고, 그건 "그날 매출 0원"과 구분되지 않는다.
 */
export type DateType = "iso" | "timestamp";

export type CollectionSpec = {
  source: Source;
  where?: Where[];
  dateField: string;
  dateType?: DateType;
  amountField: string;
  productField?: string;
  /** 결제자 uid 위치. 서브컬렉션이면 "parentDoc", 문서 안 필드면 필드명. */
  payerFrom?: "parentDoc" | string;
  /** 이 필드가 true면 environment: "test"로 분리한다(계약 규칙 4). 버리지 않는다. */
  testField?: string;
};

export type RefundSpec = Omit<CollectionSpec, "amountField" | "payerFrom"> & {
  /** 부분 환불이 없는 서비스는 생략한다 — 그러면 결제액 전액을 환불액으로 본다. */
  amountField?: string;
  /** 원결제 시각 필드. refundOfPriorDaysWon 계산에 쓴다. */
  originalDateField?: string;
};

export type AiUsageSpec = {
  source: Source;
  where?: Where[];
  dateField: string;
  dateType?: DateType;
  tokenFields: { input: string; output: string; cacheRead: string; cacheCreation: string };
  /** 없으면 토큰 수만 보내고 금액은 null(미측정)로 둔다. */
  pricePerMillionUsd?: PricePerMillionUsd;
};

export type MetricContext = {
  db: Firestore;
  date: string;
  startIso: string;
  endIso: string;
  environment: Environment;
};

export type DailyReporterConfig = {
  serviceId: string;
  /** 문자열 또는 "부를 때 읽는" 함수. Functions 파라미터는 모듈 로드 시점에 값이
   *  없을 수 있어서(배포 분석 단계) 함수로 넘길 수 있게 둔다. */
  endpoint: string | (() => string);
  /** 키를 읽어오는 함수. 값을 직접 받지 않는 건 배포 분석 시점에 시크릿이 없기 때문이다. */
  apiKey: () => string;
  db: () => Firestore;
  trailingDays?: number;
  currency?: string;
  payments: CollectionSpec;
  refunds?: RefundSpec;
  aiUsage?: AiUsageSpec;
  /** 서비스 고유 지표. null을 돌려주면 "미측정"으로 기록된다. */
  metrics?: Record<string, (ctx: MetricContext) => Promise<number | null>>;
  usage?: (ctx: MetricContext) => Promise<{
    newUserCount?: number | null;
    activeUserCount?: number | null;
    totalUserCount?: number | null;
  }>;
  /** 프로모션(무상 지급) 정가 환산. 없으면 null. */
  promotionWon?: (ctx: MetricContext) => Promise<number | null>;
};

export type DayOutcome = { date: string; environment: Environment; result: SendResult };

export function createDailyReporter(config: DailyReporterConfig) {
  const trailingDays = config.trailingDays ?? 7;

  async function runForDate(date: string): Promise<DayOutcome[]> {
    const db = config.db();
    const { startIso, endIso } = kstDayRange(date);

    const payments = await readPayments(db, config.payments, startIso, endIso);
    const refunds = await readRefunds(db, config, startIso, endIso);
    const ai = config.aiUsage ? await readAiUsage(db, config.aiUsage, startIso, endIso) : null;

    const outcomes: DayOutcome[] = [];
    for (const environment of ["live", "test"] as const) {
      const isTest = environment === "test";
      const ctx: MetricContext = { db, date, startIso, endIso, environment };

      const revenue = aggregateRevenue(
        date,
        payments.filter((p) => p.isTest === isTest),
        refunds.filter((r) => r.isTest === isTest)
      );

      const payload = {
        contractVersion: CONTRACT_VERSION,
        serviceId: config.serviceId,
        environment,
        date,
        currency: config.currency ?? "KRW",
        revenue,
        cost: {
          // AI 비용은 live에만 싣는다. 실제로 나간 돈은 하나인데 두 환경에 모두 실으면
          // 합산이 두 배가 된다. test에서는 0이 아니라 "미측정"(null)이다.
          aiUsd: isTest ? null : (ai?.usd ?? null),
          aiTokens: isTest ? null : (ai?.tokens ?? null),
          promotionWon: config.promotionWon ? await config.promotionWon(ctx) : null,
        },
        usage: await readUsage(config, ctx),
        metrics: await readMetrics(config, ctx),
        reporterVersion: REPORTER_VERSION,
      };

      const endpoint = typeof config.endpoint === "function" ? config.endpoint() : config.endpoint;
      const result = await sendReport(payload, { endpoint, apiKey: config.apiKey() });
      outcomes.push({ date, environment, result });
    }
    return outcomes;
  }

  /**
   * 후행 재전송 포함 실행. **한 날짜가 실패해도 나머지를 계속 보낸다** —
   * 하루가 막혀서 일주일이 통째로 비는 쪽이 더 나쁘다.
   */
  async function run(now: Date = new Date()): Promise<DayOutcome[]> {
    const all: DayOutcome[] = [];
    for (const date of trailingKstDates(now, trailingDays)) {
      try {
        all.push(...(await runForDate(date)));
      } catch (err) {
        console.error(`[tawer-reporter] ${date} 집계 실패`, err);
        all.push({
          date,
          environment: "live",
          result: {
            ok: false,
            status: null,
            error: err instanceof Error ? err.message : String(err),
            attempts: 0,
            retriable: true,
          },
        });
      }
    }
    const failed = all.filter((o) => !o.result.ok);
    console.log(`[tawer-reporter] ${config.serviceId} 전송 ${all.length}건 중 실패 ${failed.length}건`);
    for (const f of failed) {
      if (!f.result.ok) console.error(`[tawer-reporter] 실패 ${f.date}/${f.environment}: ${f.result.error}`);
    }
    return all;
  }

  return { run, runForDate };
}

// ── Firestore 읽기 ────────────────────────────────────────────────

function baseQuery(db: Firestore, source: Source, where: Where[] | undefined): Query {
  let q: Query =
    "collectionGroup" in source ? db.collectionGroup(source.collectionGroup) : db.collection(source.collection);
  for (const [field, op, value] of where ?? []) q = q.where(field, op, value);
  return q;
}

function ranged(q: Query, field: string, dateType: DateType, startIso: string, endIso: string): Query {
  if (dateType === "timestamp") {
    return q
      .where(field, ">=", Timestamp.fromDate(new Date(startIso)))
      .where(field, "<", Timestamp.fromDate(new Date(endIso)));
  }
  return q.where(field, ">=", startIso).where(field, "<", endIso);
}

function readDate(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return null;
}

async function readPayments(
  db: Firestore,
  spec: CollectionSpec,
  startIso: string,
  endIso: string
): Promise<(PaymentRow & { isTest: boolean })[]> {
  const snap = await ranged(
    baseQuery(db, spec.source, spec.where),
    spec.dateField,
    spec.dateType ?? "iso",
    startIso,
    endIso
  ).get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      amountWon: Number(d[spec.amountField] ?? 0),
      paidAt: readDate(d[spec.dateField]) ?? startIso,
      productId: spec.productField ? str(d[spec.productField]) : null,
      payerUid:
        spec.payerFrom === "parentDoc"
          ? (doc.ref.parent.parent?.id ?? null)
          : spec.payerFrom
            ? str(d[spec.payerFrom])
            : null,
      isTest: spec.testField ? d[spec.testField] === true : false,
    };
  });
}

async function readRefunds(
  db: Firestore,
  config: DailyReporterConfig,
  startIso: string,
  endIso: string
): Promise<(RefundRow & { isTest: boolean })[]> {
  const spec = config.refunds;
  if (!spec) return [];
  const amountField = spec.amountField ?? config.payments.amountField;
  const snap = await ranged(
    baseQuery(db, spec.source, spec.where),
    spec.dateField,
    spec.dateType ?? "iso",
    startIso,
    endIso
  ).get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      amountWon: Number(d[amountField] ?? 0),
      refundedAt: readDate(d[spec.dateField]) ?? startIso,
      paidAt: spec.originalDateField ? readDate(d[spec.originalDateField]) : null,
      isTest: spec.testField ? d[spec.testField] === true : false,
    };
  });
}

async function readAiUsage(
  db: Firestore,
  spec: AiUsageSpec,
  startIso: string,
  endIso: string
): Promise<{ tokens: TokenCounts; usd: number | null }> {
  const snap = await ranged(
    baseQuery(db, spec.source, spec.where),
    spec.dateField,
    spec.dateType ?? "iso",
    startIso,
    endIso
  ).get();
  const tokens: TokenCounts = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  for (const doc of snap.docs) {
    const d = doc.data();
    tokens.input += num(d[spec.tokenFields.input]);
    tokens.output += num(d[spec.tokenFields.output]);
    tokens.cacheRead += num(d[spec.tokenFields.cacheRead]);
    tokens.cacheCreation += num(d[spec.tokenFields.cacheCreation]);
  }
  return { tokens, usd: tokenCostUsd(tokens, spec.pricePerMillionUsd) };
}

async function readUsage(config: DailyReporterConfig, ctx: MetricContext) {
  const got = config.usage ? await config.usage(ctx) : {};
  // 안 준 값은 생략이 아니라 null이다(계약 규칙 6). 0과 "미측정"은 다른 값이다.
  return {
    newUserCount: got.newUserCount ?? null,
    activeUserCount: got.activeUserCount ?? null,
    totalUserCount: got.totalUserCount ?? null,
  };
}

async function readMetrics(
  config: DailyReporterConfig,
  ctx: MetricContext
): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  for (const [key, fn] of Object.entries(config.metrics ?? {})) {
    try {
      out[key] = await fn(ctx);
    } catch (err) {
      // 고유 지표 하나가 깨졌다고 그날 매출까지 통째로 버리지 않는다.
      console.error(`[tawer-reporter] 지표 ${key} 계산 실패`, err);
      out[key] = null;
    }
  }
  return out;
}

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export { toKstDate, kstDayRange, trailingKstDates, aggregateRevenue, tokenCostUsd, sendReport };
