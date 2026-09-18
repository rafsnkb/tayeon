"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AdminPageHeader } from "@/components/AdminPageHeader";

type Data = { periodDays: number; requestCount: number; tokens: Record<string, number>; estimatedCostWon: number | null; costConfigured: boolean; breakdown: Record<string, Record<string, number>> };

function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  const rows = Object.entries(values).sort(([, a], [, b]) => b - a); const total = rows.reduce((sum, [, value]) => sum + value, 0); const maximum = rows[0]?.[1] ?? 0;
  return <section className="rounded-[28px] bg-white p-6"><h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F]">{title}</h2>{rows.length === 0 ? <p className="mt-5 text-sm text-[#86868B]">아직 집계된 데이터가 없습니다.</p> : <ul className="mt-5 space-y-4">{rows.map(([name, value]) => { const percentage = total ? value / total * 100 : 0; return <li key={name}><div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-[#424245]">{name}</span><span className="font-medium text-[#1D1D1F] tabular-nums">{percentage.toFixed(1)}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[#E8E8ED]"><div className="h-full rounded-full bg-[#0071E3]" style={{ width: `${maximum ? value / maximum * 100 : 0}%` }} /></div></li>; })}</ul>}</section>;
}

export default function AnalyticsPage() {
  const router = useRouter(); const [data, setData] = useState<Data | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (user) => { if (!user) return router.push("/login"); const response = await fetch("/api/admin/analytics", { headers: { authorization: `Bearer ${await user.getIdToken()}` } }); if (!response.ok) return setError("분석 데이터를 불러오지 못했습니다."); setData(await response.json()); }), [router]);
  if (error) return <main className="admin-page grid place-items-center p-12 text-[#FF3B30]">{error}</main>;
  if (!data) return <main className="admin-page grid place-items-center p-12 text-sm text-[#86868B]">분석 데이터를 불러오는 중...</main>;
  const totalTokens = data.tokens.inputTokens + data.tokens.outputTokens + data.tokens.cacheReadTokens + data.tokens.cacheCreationTokens;
  return <main className="admin-page pb-12"><AdminPageHeader title="사용량 분석" description={`최근 ${data.periodDays}일의 API 사용 흐름입니다. 개인을 식별할 수 없는 집계만 표시합니다.`} /><div className="mx-auto max-w-[1180px] px-6"><div className="grid gap-px overflow-hidden rounded-[28px] bg-[#D2D2D7] sm:grid-cols-3"><section className="bg-white px-6 py-7"><p className="text-sm text-[#6E6E73]">API 요청</p><p className="mt-2 text-3xl font-semibold tracking-[-.04em]">{data.requestCount.toLocaleString("ko-KR")}</p><span className="mt-1 block text-xs text-[#86868B]">최근 {data.periodDays}일</span></section><section className="bg-white px-6 py-7"><p className="text-sm text-[#6E6E73]">총 토큰</p><p className="mt-2 text-3xl font-semibold tracking-[-.04em]">{totalTokens.toLocaleString("ko-KR")}</p><span className="mt-1 block text-xs text-[#86868B]">입·출력 및 캐시 포함</span></section><section className="bg-white px-6 py-7"><p className="text-sm text-[#6E6E73]">추정 비용</p><p className="mt-2 text-3xl font-semibold tracking-[-.04em]">{data.costConfigured ? `${data.estimatedCostWon?.toLocaleString("ko-KR")}원` : "—"}</p><span className="mt-1 block text-xs text-[#86868B]">{data.costConfigured ? "설정된 모델 단가 기준" : "단가 설정 필요"}</span></section></div><div className="mt-5 grid gap-5 md:grid-cols-2"><Breakdown title="요일별 소비" values={data.breakdown.weekday ?? {}} /><Breakdown title="시간대별 소비" values={data.breakdown.hour ?? {}} /><Breakdown title="연령대" values={data.breakdown.age ?? {}} /><Breakdown title="성별" values={data.breakdown.gender ?? {}} /><div className="md:col-span-2"><Breakdown title="질문 주제" values={data.breakdown.topic ?? {}} /></div></div></div></main>;
}
