import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { getUsdKrwRate } from "@/lib/exchangeRate";
const n = (key: string) => Number(process.env[key] ?? 0);
const add = (target: Record<string, number>, key: string) => { target[key] = (target[key] ?? 0) + 1; };

/** month(YYYY-MM, KST 기준)의 시작~다음달 시작을 UTC ISO로 반환한다.
 * apiUsageEvents.weekday/hour가 KST로 계산되어 저장되므로(reading/route.ts) 월 경계도 KST로 맞춘다. */
function monthRangeKst(monthParam: string | null) {
  const kstNow = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  let year = Number(kstNow.find((p) => p.type === "year")?.value);
  let month = Number(kstNow.find((p) => p.type === "month")?.value);

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    if (m >= 1 && m <= 12) { year = y; month = m; }
  }

  const start = new Date(Date.UTC(year, month - 1, 1, -9, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, -9, 0, 0));
  return { start, end, month: `${year}-${String(month).padStart(2, "0")}` };
}

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { start, end, month } = monthRangeKst(req.nextUrl.searchParams.get("month"));
  const snap = await adminDb.collection("apiUsageEvents")
    .where("createdAt", ">=", start.toISOString())
    .where("createdAt", "<", end.toISOString())
    .get();

  const weekday: Record<string, number> = {}, hour: Record<string, number> = {}, gender: Record<string, number> = {}, age: Record<string, number> = {}, topic: Record<string, number> = {};
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  for (const doc of snap.docs) { const d = doc.data(); inputTokens += Number(d.inputTokens ?? 0); outputTokens += Number(d.outputTokens ?? 0); cacheReadTokens += Number(d.cacheReadInputTokens ?? 0); cacheCreationTokens += Number(d.cacheCreationInputTokens ?? 0); add(weekday, d.weekday ?? "unknown"); add(hour, String(d.hour ?? "unknown")); add(gender, d.gender ?? "unknown"); add(topic, d.topic ?? "미분류"); const y = Number(d.birthYear); add(age, Number.isFinite(y) ? `${Math.floor((new Date().getFullYear() - y) / 10) * 10}대` : "미상"); }

  const costKeys = ["ANTHROPIC_INPUT_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_OUTPUT_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_CACHE_READ_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_CACHE_CREATION_TOKEN_COST_USD_PER_MILLION"];
  const tokenCostConfigured = costKeys.every((key) => Number.isFinite(Number(process.env[key])) && Number(process.env[key]) > 0);
  const usdKrwRate = tokenCostConfigured ? await getUsdKrwRate() : null;
  const costConfigured = tokenCostConfigured && usdKrwRate !== null;
  const usd = (inputTokens * n("ANTHROPIC_INPUT_TOKEN_COST_USD_PER_MILLION") + outputTokens * n("ANTHROPIC_OUTPUT_TOKEN_COST_USD_PER_MILLION") + cacheReadTokens * n("ANTHROPIC_CACHE_READ_TOKEN_COST_USD_PER_MILLION") + cacheCreationTokens * n("ANTHROPIC_CACHE_CREATION_TOKEN_COST_USD_PER_MILLION")) / 1_000_000;

  return NextResponse.json({
    month,
    requestCount: snap.size,
    tokens: { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens },
    estimatedCostUsd: costConfigured ? usd : null,
    estimatedCostWon: costConfigured ? Math.round(usd * (usdKrwRate as number)) : null,
    costConfigured,
    breakdown: { weekday, hour, gender, age, topic },
  });
}
