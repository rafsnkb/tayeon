"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type Data = { periodDays: number; requestCount: number; tokens: Record<string, number>; estimatedCostWon: number | null; costConfigured: boolean; breakdown: Record<string, Record<string, number>> };

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const rows = Object.entries(values).sort(([, a], [, b]) => b - a);
  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const maximum = rows[0]?.[1] ?? 0;
  return <section className="rounded-3xl border border-[#E9E3EF] bg-white p-5 shadow-[0_8px_30px_rgba(55,38,71,.04)]"><h2 className="font-semibold text-[#30253A]">{title}</h2>{rows.length === 0 ? <p className="mt-5 text-sm text-[#817789]">집계된 데이터가 없습니다.</p> : <ul className="mt-4 space-y-3">{rows.map(([name, value]) => { const percentage = total ? value / total * 100 : 0; return <li key={name}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-[#51475B]">{name}</span><span className="shrink-0 font-medium text-[#30253A]">{percentage.toFixed(1)}% <span className="font-normal text-[#817789]">({value.toLocaleString("ko-KR")})</span></span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#F1EDF4]"><div className="h-full rounded-full bg-[#B81D6E]" style={{ width: `${maximum ? value / maximum * 100 : 0}%` }} /></div></li>; })}</ul>}</section>;
}

export default function AnalyticsPage() {
  const router = useRouter(); const [data, setData] = useState<Data | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (user) => { if (!user) return router.push("/login"); const response = await fetch("/api/admin/analytics", { headers: { authorization: `Bearer ${await user.getIdToken()}` } }); if (!response.ok) return setError("분석 데이터를 불러오지 못했습니다."); setData(await response.json()); }), [router]);
  if (error) return <main className="min-h-screen bg-[#F7F5FA] p-12 text-center text-[#9D285F]">{error}</main>;
  if (!data) return <main className="min-h-screen bg-[#F7F5FA] p-12 text-center text-[#817789]">분석 데이터를 불러오는 중...</main>;
  const totalTokens = data.tokens.inputTokens + data.tokens.outputTokens + data.tokens.cacheReadTokens + data.tokens.cacheCreationTokens;
  return <main className="min-h-screen bg-[#F7F5FA] p-6"><div className="mx-auto max-w-6xl"><header className="mb-6 rounded-[28px] bg-[#30253A] p-7 text-white"><p className="text-xs tracking-[.18em] text-[#E7C9DD]">TAYEON ADMIN</p><h1 className="mt-2 text-3xl font-semibold">API 사용량 분석</h1><p className="mt-2 text-sm text-[#D6CDDB]">최근 {data.periodDays}일 · 개인정보가 아닌 집계 수치만 표시합니다.</p></header><div className="grid gap-3 sm:grid-cols-3"><section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(55,38,71,.04)]"><p className="text-sm text-[#817789]">API 요청</p><p className="mt-2 text-2xl font-semibold text-[#30253A]">{data.requestCount.toLocaleString("ko-KR")}건</p></section><section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(55,38,71,.04)]"><p className="text-sm text-[#817789]">총 토큰 소비</p><p className="mt-2 text-2xl font-semibold text-[#30253A]">{totalTokens.toLocaleString("ko-KR")}</p></section><section className="rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgba(55,38,71,.04)]"><p className="text-sm text-[#817789]">추정 비용</p><p className="mt-2 text-2xl font-semibold text-[#30253A]">{data.costConfigured ? `${data.estimatedCostWon?.toLocaleString("ko-KR")}원` : "단가 설정 필요"}</p></section></div><div className="mt-6 grid gap-4 md:grid-cols-2"><Breakdown title="소비가 많은 요일" values={data.breakdown.weekday ?? {}} /><Breakdown title="소비가 많은 시간" values={data.breakdown.hour ?? {}} /><Breakdown title="소비가 많은 연령대" values={data.breakdown.age ?? {}} /><Breakdown title="소비가 많은 성별" values={data.breakdown.gender ?? {}} /><div className="md:col-span-2"><Breakdown title="소비가 많은 질문 주제" values={data.breakdown.topic ?? {}} /></div></div></div></main>;
}
