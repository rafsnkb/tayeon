"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AdminPageHeader } from "@/components/AdminPageHeader";

type Notice = { id: string; title: string; body: string; createdAt: string };
const dateTime = (value: string) => value.replace("T", " ").slice(0, 19);

export default function NoticesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNotices(firebaseUser: User) {
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/notices", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "공지사항을 불러오지 못했습니다.");
      setNotices(result.notices);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "공지사항을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return router.push("/login");
    setUser(firebaseUser);
    await loadNotices(firebaseUser);
  }), [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "공지사항 게시에 실패했습니다.");
      setNotices((current) => [result, ...current]);
      setTitle("");
      setBody("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "공지사항 게시에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page px-4 pb-12 text-[#1D1D1F] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <AdminPageHeader title="공지" description="사용자에게 보여 줄 안내를 간결하게 작성하고 게시합니다." />

        <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
          <form onSubmit={submit} className="rounded-[24px] border border-[#E9E3EF] bg-white p-5 shadow-[0_12px_30px_rgb(57_39_73/5%)] sm:p-6">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold">새 공지 작성</h2><span className="rounded-full bg-[#F9EEF5] px-2.5 py-1 text-[11px] font-semibold text-[#B81D6E]">즉시 게시</span></div>
            <label className="mt-5 block text-xs font-semibold text-[#665A70]">제목 <span className="font-normal text-[#A299AA]">{title.length}/100</span></label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required placeholder="공지 제목을 입력하세요" className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3.5 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />
            <label className="mt-5 block text-xs font-semibold text-[#665A70]">본문 <span className="font-normal text-[#A299AA]">{body.length.toLocaleString("ko-KR")}/10,000</span></label>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={10_000} required placeholder="공지 내용을 입력하세요" className="mt-2 min-h-56 w-full resize-y rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />
            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={submitting} className="mt-5 w-full rounded-xl bg-[#3B2D47] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgb(59_45_71/18%)] transition hover:bg-[#4B3959] disabled:opacity-50">{submitting ? "게시 중..." : "공지 게시하기"}</button>
          </form>

          <section className="overflow-hidden rounded-[24px] border border-[#E9E3EF] bg-white shadow-[0_12px_30px_rgb(57_39_73/5%)]"><div className="border-b border-[#EEEAF1] px-5 py-5 sm:px-6"><h2 className="text-base font-semibold">최근 게시 공지</h2><p className="mt-1 text-sm text-[#817789]">최근 30건을 표시합니다.</p></div>{loading ? <p className="p-12 text-center text-sm text-[#93899A]">불러오는 중...</p> : notices.length === 0 ? <p className="p-12 text-center text-sm text-[#93899A]">게시된 공지가 없습니다.</p> : <ul className="divide-y divide-[#F0EDF2]">{notices.map((notice) => <li key={notice.id} className="px-5 py-4 sm:px-6"><p className="font-semibold text-[#44374D]">{notice.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#817789]">{notice.body}</p><p className="mt-2 text-xs text-[#A299AA]">게시 {dateTime(notice.createdAt)}</p></li>)}</ul>}</section>
        </div>
      </div>
    </main>
  );
}
