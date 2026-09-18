"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type RefundRequest = { id: string; uid: string; nickname: string | null; productId: string | null; orderName?: string | null; priceWon: number; paidAt: string | null; requestedAt: string; reason: string; status: "pending" | "approved" | "rejected"; paymentMethod: { type?: string; label?: string } | null; rejectionReason?: string };
const date = (value: string | null | undefined) => {
  if (!value || Number.isNaN(Date.parse(value))) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
};
const statusLabel = { pending: "검토 대기", approved: "환불 완료", rejected: "거절됨" };

export default function RefundRequestsPage() {
  const router = useRouter(); const [items, setItems] = useState<RefundRequest[]>([]); const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState<string | null>(null);
  useEffect(() => onAuthStateChanged(auth, async (user) => { if (!user) return router.push("/login"); const response = await fetch("/api/admin/refund-requests", { headers: { authorization: `Bearer ${await user.getIdToken()}` } }); if (response.ok) setItems((await response.json()).requests); setLoading(false); }), [router]);
  async function act(item: RefundRequest, action: "approve" | "reject") {
    const user = auth.currentUser; if (!user) return;
    const reason = action === "reject" ? prompt("환불 거절 사유를 입력하세요.") : item.reason;
    if (!reason?.trim() || (action === "approve" && !confirm("결제 취소를 실행하고 환불을 승인할까요?"))) return;
    setWorkingId(item.id);
    const headers = { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" };
    const response = action === "approve"
      ? await fetch(`/api/admin/users/${encodeURIComponent(item.uid)}/refund-payment`, { method: "POST", headers, body: JSON.stringify({ paymentId: item.id, reason }) })
      : await fetch(`/api/admin/refund-requests/${item.id}/reject`, { method: "POST", headers, body: JSON.stringify({ reason }) });
    setWorkingId(null);
    if (!response.ok) return alert((await response.json()).error ?? "요청을 처리하지 못했습니다.");
    setItems((current) => current.map((value) => value.id === item.id ? { ...value, status: action === "approve" ? "approved" : "rejected", rejectionReason: action === "reject" ? reason : undefined } : value));
  }
  return <main className="min-h-screen bg-[#F7F5FA] p-6"><div className="mx-auto max-w-6xl"><header className="mb-6 rounded-[28px] bg-[#30253A] p-7 text-white"><p className="text-xs tracking-[.18em] text-[#E7C9DD]">TAYEON ADMIN</p><h1 className="mt-2 text-3xl font-semibold">환불 요청</h1><p className="mt-2 text-sm text-[#D6CDDB]">7일 이내 · 횟수제 미사용 또는 시간제 미활성화 건만 승인할 수 있습니다.</p></header><section className="overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_rgba(55,38,71,.04)]">{loading ? <p className="p-12 text-center text-[#817789]">불러오는 중...</p> : items.length === 0 ? <p className="p-12 text-center text-[#817789]">접수된 환불 요청이 없습니다.</p> : items.map((item) => <article key={item.id} className="border-b border-[#EEEAF0] p-5 last:border-0"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#30253A]">{item.nickname ?? "(닉네임 없음)"}</p><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === "pending" ? "bg-[#FCEEF5] text-[#A31459]" : item.status === "approved" ? "bg-[#EAF6EF] text-[#23754B]" : "bg-[#F2EFF4] text-[#64586B]"}`}>{statusLabel[item.status]}</span></div><p className="mt-1 font-mono text-xs text-[#817789]">UID · {item.uid}</p></div><div className="text-right"><p className="font-semibold text-[#30253A]">{item.priceWon.toLocaleString("ko-KR")}원</p><p className="mt-1 text-xs text-[#817789]">{item.paymentMethod?.label ?? "결제수단 정보 없음"}</p></div></div><dl className="mt-4 grid gap-2 text-sm text-[#51475B] sm:grid-cols-2"><div><dt className="inline text-[#9A8FA0]">이용권 · </dt><dd className="inline">{item.orderName ?? item.productId ?? "-"}</dd></div><div><dt className="inline text-[#9A8FA0]">구매 일시 · </dt><dd className="inline">{date(item.paidAt)}</dd></div><div><dt className="inline text-[#9A8FA0]">요청 일시 · </dt><dd className="inline">{date(item.requestedAt)}</dd></div><div><dt className="inline text-[#9A8FA0]">사유 · </dt><dd className="inline">{item.reason}</dd></div>{item.rejectionReason && <div className="sm:col-span-2"><dt className="inline text-[#9A8FA0]">거절 사유 · </dt><dd className="inline">{item.rejectionReason}</dd></div>}</dl>{item.status === "pending" && <div className="mt-5 flex gap-2"><button disabled={workingId === item.id} onClick={() => act(item, "approve")} className="rounded-xl bg-[#3B2D47] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{workingId === item.id ? "처리 중..." : "환불 승인"}</button><button disabled={workingId === item.id} onClick={() => act(item, "reject")} className="rounded-xl border border-[#E6C4D5] px-4 py-2 text-sm font-medium text-[#9D285F] disabled:opacity-50">거절</button></div>}</article>)}</section></div></main>;
}
