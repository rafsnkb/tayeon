"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type StatsSummary = {
  totalUsers: number;
  genderCounts: Record<string, number>;
  ageBracketCounts: Record<string, number>;
  totalChargedReadings: number;
  topicCounts: Record<string, number>;
};

const GENDER_LABEL: Record<string, string> = { male: "남성", female: "여성", 미상: "미상" };

type Status = "loading" | "unauthenticated" | "forbidden" | "ok";

function StatsBreakdown({
  title,
  counts,
  labelMap,
  unit = "명",
}: {
  title: string;
  counts: Record<string, number>;
  labelMap?: Record<string, string>;
  unit?: string;
}) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-1">
      <p className="font-medium text-zinc-700">{title}</p>
      {total === 0 ? (
        <p className="text-zinc-400">데이터 없음</p>
      ) : (
        <ul className="space-y-0.5">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between text-zinc-600">
              <span>{labelMap?.[key] ?? key}</span>
              <span>
                {count}
                {unit} ({((count / total) * 100).toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setStatus("unauthenticated");
        router.push("/login");
        return;
      }
      setUser(firebaseUser);

      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/me", {
        headers: { authorization: `Bearer ${token}` },
      });
      setStatus(res.ok ? "ok" : "forbidden");
    });
    return () => unsubscribe();
  }, [router]);

  async function handleLoadStats() {
    if (!user) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/stats/summary", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatsError(body.error ?? "통계를 불러오지 못했습니다.");
        return;
      }
      setStats((await res.json()) as StatsSummary);
    } finally {
      setStatsLoading(false);
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return <main className="p-6 text-sm text-zinc-500">확인 중...</main>;
  }

  if (status === "forbidden") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-600">
          이 계정({user?.email})은 관리자 권한이 없습니다.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          로그아웃
        </button>
      </main>
    );
  }

  return (
    <main className="admin-page"><div className="mx-auto max-w-[920px] space-y-7 px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#D2D2D7] pb-7">
        <div className="min-w-0"><p className="mb-2 text-xs font-semibold tracking-wide text-[#86868B]">TAYEON ADMIN</p><h1 className="text-3xl font-semibold tracking-[-.04em] text-[#1D1D1F] sm:text-4xl">개요</h1><p className="mt-2 text-sm text-[#6E6E73]">오늘 확인할 운영 항목을 빠르게 살펴보세요.</p></div>
        <button
          onClick={() => signOut(auth)}
          className="max-w-full shrink-0 truncate rounded-full bg-[#E8E8ED] px-3.5 py-2 text-xs font-medium text-[#424245]"
        >
          로그아웃 ({user?.email})
        </button>
      </header>

      <nav className="grid gap-px overflow-hidden rounded-[24px] bg-[#D2D2D7] text-sm sm:grid-cols-2" aria-label="빠른 작업">
        <a href="/users" className="bg-white p-5 transition hover:bg-[#F5F5F7]"><b className="block text-[#1D1D1F]">사용자 관리</b><span className="mt-1 block text-xs text-[#6E6E73]">계정, 결제, 이용권</span></a>
        <a href="/moderation" className="bg-white p-5 transition hover:bg-[#F5F5F7]"><b className="block text-[#1D1D1F]">검토</b><span className="mt-1 block text-xs text-[#6E6E73]">무료 처리와 부정 요청</span></a>
        <a href="/refund-requests" className="bg-white p-5 transition hover:bg-[#F5F5F7]"><b className="block text-[#1D1D1F]">환불</b><span className="mt-1 block text-xs text-[#6E6E73]">요청 확인 및 승인</span></a>
        <a href="/analytics" className="bg-white p-5 transition hover:bg-[#F5F5F7]"><b className="block text-[#1D1D1F]">사용량 분석</b><span className="mt-1 block text-xs text-[#6E6E73]">비용과 소비 흐름</span></a>
        <a href="/notices" className="bg-white p-5 transition hover:bg-[#F5F5F7] sm:col-span-2"><b className="block text-[#1D1D1F]">공지</b><span className="mt-1 block text-xs text-[#6E6E73]">사용자에게 보여 줄 안내 작성</span></a>
      </nav>

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700">
            통계 (성별ㆍ연령대ㆍ질문 주제 — 전부 집계 수치이며 개별 유저와 연결해서 보여주지 않음)
          </h2>
          <button
            onClick={handleLoadStats}
            disabled={statsLoading}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {statsLoading ? "불러오는 중..." : stats ? "새로고침" : "통계 불러오기"}
          </button>
        </div>
        {statsError && <p className="text-sm text-red-600">{statsError}</p>}
        {stats && (
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <StatsBreakdown
              title={`성별 (가입자 ${stats.totalUsers}명)`}
              counts={stats.genderCounts}
              labelMap={GENDER_LABEL}
            />
            <StatsBreakdown title="연령대" counts={stats.ageBracketCounts} />
            <StatsBreakdown
              title={`질문 주제 (유료 리딩 ${stats.totalChargedReadings}건)`}
              counts={stats.topicCounts}
              unit="건"
            />
          </div>
        )}
      </section>
    </div></main>
  );
}
