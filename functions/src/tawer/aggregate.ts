// ⚠ 자동 복사본 — 여기서 고치지 마세요.
//
// 원본: tawer/packages/reporter/src/aggregate.ts (@tawer/reporter@1.0.0)
// 고칠 일이 있으면 타워에서 고치고 아래 명령으로 다시 복사합니다.
//   node scripts/sync-reporter.mjs C:/Works/tayeon/functions/src/tawer
//
// 여기서 직접 고치면 다음 복사 때 조용히 사라집니다.

// 집계는 Firestore를 모른다. 평범한 배열을 받아 계약(§4) 모양의 숫자를 만든다.
// 이렇게 해 둬야 실제 DB 없이 검사할 수 있다 — 돈 계산은 눈으로 봐서는 안 맞는다.

import { toKstDate } from "./dates.ts";

export type PaymentRow = {
  amountWon: number;
  /** 결제 시각. 환불 여부와 무관하게 **결제된 날**에 귀속된다. */
  paidAt: string;
  productId: string | null;
  payerUid: string | null;
};

export type RefundRow = {
  amountWon: number;
  refundedAt: string;
  /** 원결제 시각. 전일 이전 결제분을 갈라내는 데 쓴다. 모르면 null. */
  paidAt: string | null;
};

export type RevenuePayload = {
  grossWon: number;
  refundWon: number;
  refundOfPriorDaysWon: number;
  orderCount: number;
  refundCount: number;
  payingUserCount: number | null;
  byProduct: Record<string, { count: number; won: number }>;
};

/** productId를 못 읽은 결제를 조용히 버리지 않는다 — 버리면 Σ byProduct ≠ grossWon이 된다. */
export const UNKNOWN_PRODUCT = "(미분류)";

export function aggregateRevenue(date: string, payments: PaymentRow[], refunds: RefundRow[]): RevenuePayload {
  let grossWon = 0;
  let orderCount = 0;
  const payers = new Set<string>();
  let anyPayerKnown = false;
  const byProduct: Record<string, { count: number; won: number }> = {};

  for (const p of payments) {
    const won = intWon(p.amountWon);
    grossWon += won;
    orderCount += 1;
    if (p.payerUid) {
      payers.add(p.payerUid);
      anyPayerKnown = true;
    }
    const key = p.productId ?? UNKNOWN_PRODUCT;
    const slot = byProduct[key] ?? (byProduct[key] = { count: 0, won: 0 });
    slot.count += 1;
    slot.won += won;
  }

  let refundWon = 0;
  let refundCount = 0;
  let refundOfPriorDaysWon = 0;
  for (const r of refunds) {
    const won = intWon(r.amountWon);
    refundWon += won;
    refundCount += 1;
    // 원결제일을 모르면 "전일 이전"이라고 단정하지 않는다. 모르는 것을 0으로 세면
    // 월 마감 대사에서 원인 없는 차이가 생긴다(§6.2).
    if (r.paidAt && toKstDate(r.paidAt) < date) refundOfPriorDaysWon += won;
  }

  return {
    grossWon,
    refundWon,
    refundOfPriorDaysWon,
    orderCount,
    refundCount,
    // 결제는 있는데 결제자를 한 건도 못 읽었다면 0이 아니라 "미측정"이다(계약 규칙 6).
    payingUserCount: orderCount > 0 && !anyPayerKnown ? null : payers.size,
    byProduct,
  };
}

export type TokenCounts = { input: number; output: number; cacheRead: number; cacheCreation: number };
export type PricePerMillionUsd = Partial<TokenCounts>;

/**
 * 토큰 단가는 **설정이 있을 때만** 금액이 된다. 단가를 코드에 박으면 가격표가 바뀌었을 때
 * 조용히 틀린 금액을 보고하게 된다 — 타연 ONE_CARD_BASIS가 정확히 그렇게 틀렸다.
 * 단가가 없으면 토큰 수만 보내고 금액은 null(미측정)로 둔다.
 */
export function tokenCostUsd(tokens: TokenCounts, price: PricePerMillionUsd | undefined): number | null {
  if (!price) return null;
  const keys: (keyof TokenCounts)[] = ["input", "output", "cacheRead", "cacheCreation"];
  if (keys.some((k) => typeof price[k] !== "number" || !Number.isFinite(price[k] as number))) return null;
  const usd = keys.reduce((sum, k) => sum + tokens[k] * (price[k] as number), 0) / 1_000_000;
  // 소수 6자리. USD는 원 단위 반올림을 하면 안 된다 — 환산은 타워가 그날 환율로 한다(§4 규칙 5).
  return Math.round(usd * 1e6) / 1e6;
}

function intWon(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  // 원은 정수다. 소수점이 들어오면 여기서 끊어야 Σ프로젝트별 = 전체(§6.1)가 유지된다.
  return Math.round(n);
}
