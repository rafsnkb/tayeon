import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
const n = (key: string) => Number(process.env[key] ?? 0);
const add = (target: Record<string, number>, key: string) => { target[key] = (target[key] ?? 0) + 1; };
export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const snap = await adminDb.collection("apiUsageEvents").where("createdAt", ">=", since).get();
  const weekday: Record<string, number> = {}, hour: Record<string, number> = {}, gender: Record<string, number> = {}, age: Record<string, number> = {}, topic: Record<string, number> = {};
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  for (const doc of snap.docs) { const d = doc.data(); inputTokens += Number(d.inputTokens ?? 0); outputTokens += Number(d.outputTokens ?? 0); cacheReadTokens += Number(d.cacheReadInputTokens ?? 0); cacheCreationTokens += Number(d.cacheCreationInputTokens ?? 0); add(weekday, d.weekday ?? "unknown"); add(hour, String(d.hour ?? "unknown")); add(gender, d.gender ?? "unknown"); add(topic, d.topic ?? "미분류"); const y = Number(d.birthYear); add(age, Number.isFinite(y) ? `${Math.floor((new Date().getFullYear() - y) / 10) * 10}대` : "미상"); }
  const costKeys = ["ANTHROPIC_INPUT_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_OUTPUT_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_CACHE_READ_TOKEN_COST_USD_PER_MILLION", "ANTHROPIC_CACHE_CREATION_TOKEN_COST_USD_PER_MILLION", "USD_KRW_RATE"];
  const costConfigured = costKeys.every((key) => Number.isFinite(Number(process.env[key])) && Number(process.env[key]) > 0);
  const usd = (inputTokens * n("ANTHROPIC_INPUT_TOKEN_COST_USD_PER_MILLION") + outputTokens * n("ANTHROPIC_OUTPUT_TOKEN_COST_USD_PER_MILLION") + cacheReadTokens * n("ANTHROPIC_CACHE_READ_TOKEN_COST_USD_PER_MILLION") + cacheCreationTokens * n("ANTHROPIC_CACHE_CREATION_TOKEN_COST_USD_PER_MILLION")) / 1_000_000;
  return NextResponse.json({ periodDays: 30, requestCount: snap.size, tokens: { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }, estimatedCostWon: costConfigured ? Math.round(usd * n("USD_KRW_RATE")) : null, costConfigured, breakdown: { weekday, hour, gender, age, topic } });
}
