"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { refundDue } from "@/lib/refundDue";
import { kstDateTime } from "@/lib/datetime";
import { AdminPageHeader } from "@/components/AdminPageHeader";

/** 승인 건에 대해 서버가 결제·이용권 문서를 직접 읽어 확인한 결과. 요청 문서의 status 만으로는
 *  "승인했다고 기록됐다"까지만 알 수 있어서, 실제로 회수됐는지 따로 본다. */
type Settlement = { paymentStatus: string | null; passStatus: string | null; settled: boolean };
type RefundRequest = { id: string; uid: string; nickname: string | null; productId: string | null; orderName?: string | null; priceWon: number; paidAt: string | null; requestedAt: string; reason: string; status: "pending" | "approved" | "rejected"; paymentMethod: { type?: string; label?: string } | null; rejectionReason?: string; settlement?: Settlement | null };

/** 목록을 상태로 나눠 본다. 대기 건이 처리 끝난 건들 사이에 묻히면 마감을 놓친다. */
const TABS = [
  { key: "pending", label: "환불 요청" },
  { key: "approved", label: "환불 완료" },
  { key: "rejected", label: "거절" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const date = (value: string | null | undefined) => kstDateTime(value);
const statusLabel = { pending: "검토 대기", approved: "환불 완료", rejected: "거절됨" };

// 상태 낱말은 사용자 화면·사용자 상세와 같은 걸 쓴다. 표에 없는 값은 원문을 그대로 보여
// 새 상태가 "알 수 없음"에 묻히지 않게 한다(admin/src/app/users/page.tsx 와 같은 규칙).
const PASS_STATUS_LABEL: Record<string, string> = {
  unused: "미사용", active: "사용중", exhausted: "사용완료", expired: "기간만료",
  refunded: "환불완료", revoked: "회수됨", refund_pending: "환불 대기중", unknown: "상태 없음",
  deleted: "삭제됨",
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
  fulfilled: "지급완료", refunded: "환불완료", duplicate_cancelled: "중복 취소",
  coupon_conflict_cancelled: "쿠폰 충돌 취소",
};
const passStatusLabel = (status: string) => PASS_STATUS_LABEL[status] ?? status;
const paymentStatusLabel = (status: string) => PAYMENT_STATUS_LABEL[status] ?? status;

/** 승인 건이 실제로 정리됐는지 — 결제가 refunded 이고 이용권이 회수됐는지까지 본 결과.
 *  어긋나 있으면(포트원에서만 취소됐거나 이용권이 남아 있거나) 그 자리에서 드러나야 한다. */
function SettlementBadge({ settlement }: { settlement: Settlement | null | undefined }) {
  if (!settlement) return null;
  if (settlement.settled) {
    return <span className="rounded-full bg-[#EAF6EF] px-2.5 py-1 text-xs text-[#23754B]">이용권 회수 확인</span>;
  }
  const detail = [
    settlement.paymentStatus !== "refunded" ? `결제 ${settlement.paymentStatus ? paymentStatusLabel(settlement.paymentStatus) : "확인불가"}` : null,
    settlement.passStatus && settlement.passStatus !== "refunded" && settlement.passStatus !== "deleted"
      ? `이용권 ${passStatusLabel(settlement.passStatus)}`
      : null,
  ].filter(Boolean).join(" · ");
  return (
    <span className="rounded-full bg-[#FDECEC] px-2.5 py-1 text-xs text-[#B42318]" title="승인 기록은 있으나 실제 상태가 다릅니다">
      미정리{detail ? ` — ${detail}` : ""}
    </span>
  );
}

/** 환불 마감 배지 — 전자상거래법 제18조②2호의 "청약철회한 날부터 3영업일". 넘기면 같은 항
 *  후단의 지연배상금 대상이 되므로, 남은 영업일을 눈에 띄게 보여 준다(공휴일 미반영 —
 *  admin/src/lib/refundDue.ts 주석 참고). 처리가 끝난 건에는 띄우지 않는다. */
function DueBadge({ requestedAt }: { requestedAt: string }) {
  const due = refundDue(requestedAt);
  if (!due) return null;
  const label = due.overdue
    ? "환불 마감 지남"
    : due.businessDaysLeft === 0
      ? "환불 마감 오늘"
      : `환불 마감 D-${due.businessDaysLeft}`;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs ${
        due.overdue || due.businessDaysLeft === 0
          ? "bg-[#FDECEC] text-[#B42318]"
          : "bg-[#FFF6E5] text-[#8A5A00]"
      }`}
      title={`${date(due.dueAt.toISOString())}까지 (전자상거래법 제18조②2호, 3영업일)`}
    >
      {label}
    </span>
  );
}

export default function RefundRequestsPage() {
  const router = useRouter(); const [items, setItems] = useState<RefundRequest[]>([]); const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState<string | null>(null); const [tab, setTab] = useState<TabKey>("pending");
  async function fetchRequests(): Promise<RefundRequest[] | null> {
    const user = auth.currentUser;
    if (!user) return null;
    const response = await fetch("/api/admin/refund-requests", { headers: { authorization: `Bearer ${await user.getIdToken()}` } });
    return response.ok ? (await response.json()).requests : null;
  }

  async function reload() {
    const next = await fetchRequests();
    if (next) setItems(next);
  }

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) return router.push("/login");
    const next = await fetchRequests();
    if (next) setItems(next);
    setLoading(false);
  }), [router]);
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
    // settlement(실제 회수 여부)는 서버가 결제·이용권 문서를 읽어야 알 수 있다. 승인 건은
    // 목록을 다시 받아 "이용권 회수 확인"까지 채운다.
    if (action === "approve") await reload();
  }
  const visible = items.filter((item) => item.status === tab);
  return <main className="admin-page pb-12"><AdminPageHeader title="환불" description="결제와 이용권 상태를 확인한 뒤 안전하게 처리합니다." /><div className="mx-auto max-w-[1180px] px-6"><div className="mb-4 flex gap-2">{TABS.map((t) => <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`rounded-full px-4 py-2 text-sm font-medium ${tab === t.key ? "bg-[#30253A] text-white" : "bg-white text-[#665A70]"}`}>{t.label}<span className="ml-1.5 text-xs opacity-70">{items.filter((i) => i.status === t.key).length}</span></button>)}</div><section className="overflow-hidden rounded-[28px] bg-white">{loading ? <p className="p-12 text-center text-[#817789]">불러오는 중...</p> : visible.length === 0 ? <p className="p-12 text-center text-[#817789]">{tab === "pending" ? "처리를 기다리는 환불 요청이 없습니다." : tab === "approved" ? "환불 완료된 건이 없습니다." : "거절한 건이 없습니다."}</p> : visible.map((item) => <article key={item.id} className="border-b border-[#EEEAF0] p-5 last:border-0"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#30253A]">{item.nickname ?? "(닉네임 없음)"}</p><span className={`rounded-full px-2.5 py-1 text-xs ${item.status === "pending" ? "bg-[#FCEEF5] text-[#A31459]" : item.status === "approved" ? "bg-[#EAF6EF] text-[#23754B]" : "bg-[#F2EFF4] text-[#64586B]"}`}>{statusLabel[item.status]}</span>{item.status === "pending" && <DueBadge requestedAt={item.requestedAt} />}{item.status === "approved" && <SettlementBadge settlement={item.settlement} />}</div><p className="mt-1 font-mono text-xs text-[#817789]">UID · {item.uid}</p></div><div className="text-right"><p className="font-semibold text-[#30253A]">{item.priceWon.toLocaleString("ko-KR")}원</p><p className="mt-1 text-xs text-[#817789]">{item.paymentMethod?.label ?? "결제수단 정보 없음"}</p></div></div><dl className="mt-4 grid gap-2 text-sm text-[#51475B] sm:grid-cols-2"><div><dt className="inline text-[#9A8FA0]">이용권 · </dt><dd className="inline">{item.orderName ?? item.productId ?? "-"}</dd></div><div><dt className="inline text-[#9A8FA0]">구매 일시 · </dt><dd className="inline">{date(item.paidAt)}</dd></div><div><dt className="inline text-[#9A8FA0]">요청 일시 · </dt><dd className="inline">{date(item.requestedAt)}</dd></div><div><dt className="inline text-[#9A8FA0]">사유 · </dt><dd className="inline">{item.reason}</dd></div>{item.rejectionReason && <div className="sm:col-span-2"><dt className="inline text-[#9A8FA0]">거절 사유 · </dt><dd className="inline">{item.rejectionReason}</dd></div>}</dl>{item.status === "pending" && <div className="mt-5 flex gap-2"><button disabled={workingId === item.id} onClick={() => act(item, "approve")} className="rounded-full bg-[#0071E3] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{workingId === item.id ? "처리 중..." : "환불 승인"}</button><button disabled={workingId === item.id} onClick={() => act(item, "reject")} className="rounded-full border border-[#D2D2D7] px-4 py-2 text-sm font-medium text-[#424245] disabled:opacity-50">거절</button></div>}</article>)}</section></div></main>;
}
