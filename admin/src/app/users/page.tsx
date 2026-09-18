"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type UserItem = {
  uid: string;
  nickname: string | null;
  status: "normal" | "suspended";
  suspendedAt: string | null;
  suspendedUntil: string | null;
  paymentTotalWon: number;
  refundTotalWon: number;
  countPasses: { held: number; active: number };
  timePasses: { held: number; active: number };
  bonusRewardPasses: number;
  friendInvitePasses: number;
};

type PageData = { users: UserItem[]; nextCursor: string | null };

type PassItem = {
  id: string;
  source: string;
  status: string;
  combo: string | null;
  minutes: number | null;
  remaining: number | null;
  createdAt: string;
  expiresAt: string | null;
  usableUntil: string | null;
};

type UserOverview = {
  recentReadings: Array<{
    id: string;
    roomId: string;
    roomTitle: string;
    question: string;
    createdAt: string;
    charged: boolean;
    flaggedForAbuse: boolean;
    topic: string | null;
  }>;
  recentFreeReadings: number;
  purchasedPasses: PassItem[];
  rewardPasses: PassItem[];
  livePayments: Array<{ id: string; orderName: string | null; priceWon: number; status: string; paidAt: string | null }>;
  suspensionLog: Array<{ id: string; action: string; reason: string | null; durationDays: number | null; suspendedUntil: string | null; createdAt: string | null }>;
};

const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

const SOURCE_LABEL: Record<string, string> = {
  purchase: "구매",
  "admin-grant": "운영자 지급",
  "bonus-reward": "결제 리워드",
  "referral-signup": "친구초대 가입 리워드",
  "referral-payout": "친구 결제 리워드",
  "signup-free": "최초 가입 이용권",
  birthday: "생일 쿠폰",
};

const COMBO_LABEL: Record<string, string> = {
  tarot: "타로",
  "tarot-saju": "타로+사주",
  "tarot-ziwei": "타로+자미두수",
  "tarot-saju-ziwei": "타로+사주+자미두수",
};

function shortDate(value: string | null) {
  return value ? value.replace("T", " ").slice(0, 19) : "-";
}

function PassList({ title, passes, emptyText }: { title: string; passes: PassItem[]; emptyText: string }) {
  return (
    <section className="rounded-2xl border border-[#EEE8F1] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#45394F]">{title}</h3>
        <span className="rounded-full bg-[#F4F0F6] px-2 py-1 text-[11px] font-medium text-[#786D82]">{passes.length}건</span>
      </div>
      {passes.length === 0 ? (
        <p className="mt-3 text-xs text-[#A299AA]">{emptyText}</p>
      ) : (
        <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
          {passes.map((pass) => (
            <li key={pass.id} className="rounded-xl bg-[#FAF8FB] px-3 py-2 text-xs text-[#665A70]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#4B3D56]">{SOURCE_LABEL[pass.source] ?? pass.source}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#8D8296]">{pass.status}</span>
              </div>
              <p className="mt-1">{pass.minutes ? `${pass.minutes}분 시간제` : pass.combo ? COMBO_LABEL[pass.combo] ?? pass.combo : "횟수제"}{pass.remaining !== null ? ` · 잔여 슬롯 ${pass.remaining}` : ""}</p>
              <p className="mt-1 text-[11px] text-[#9A90A2]">발급 {shortDate(pass.createdAt)} · 만료 {shortDate(pass.expiresAt ?? pass.usableUntil)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SuspensionControls({ uid, suspended }: { uid: string; suspended: boolean }) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function update(nextSuspended: boolean) {
    const admin = auth.currentUser;
    if (!admin) return;
    if (nextSuspended && !reason.trim()) return setMessage("정지 사유를 입력해주세요.");
    setBusy(true);
    setMessage(null);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/suspend`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ suspended: nextSuspended, reason, durationDays: days ? Number(days) : null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.error ?? "처리에 실패했습니다.");
      window.location.reload();
    } finally { setBusy(false); }
  }

  if (suspended) return <button disabled={busy} onClick={() => update(false)} className="rounded-xl border border-[#D5CBDC] bg-white px-3 py-2 text-xs font-semibold text-[#584D61] disabled:opacity-50">{busy ? "처리 중..." : "정지 해제"}</button>;
  return <div className="flex flex-wrap items-center gap-2"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="정지 사유" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><input value={days} onChange={(e) => setDays(e.target.value)} type="number" min="1" max="3650" placeholder="일수 (비우면 영구)" className="w-36 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><button disabled={busy} onClick={() => update(true)} className="rounded-xl bg-[#B82958] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "처리 중..." : "정지 적용"}</button>{message && <p className="text-xs text-red-600">{message}</p>}</div>;
}

function CountPassGrantControls({ uid }: { uid: string }) {
  const [count, setCount] = useState("");
  const [combo, setCombo] = useState("tarot");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function grant() {
    const admin = auth.currentUser;
    if (!admin) return;
    setBusy(true); setMessage(null);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/grant-count-pass`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ count: Number(count), combo, reason }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.error ?? "이용권 지급에 실패했습니다.");
      setMessage("횟수제 이용권을 지급했습니다."); setCount(""); setReason("");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2"><input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="1" max="10000" placeholder="횟수" className="w-20 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><select value={combo} onChange={(e) => setCombo(e.target.value)} className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]"><option value="tarot">타로</option><option value="tarot-saju">타로+사주</option><option value="tarot-ziwei">타로+자미두수</option><option value="tarot-saju-ziwei">타로+사주+자미두수</option></select><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="지급 사유" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><button disabled={busy} onClick={grant} className="rounded-xl bg-[#3B2D47] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "지급 중..." : "횟수제 지급"}</button>{message && <p className="text-xs text-[#B81D6E]">{message}</p>}</div>;
}

const TIME_GRANT_PRODUCTS = [
  ["timepass-tarot-15", "타로 15분 · 8,900원"], ["timepass-tarot-30", "타로 30분 · 12,900원"], ["timepass-tarot-60", "타로 60분 · 19,900원"],
  ["timepass-saju-15", "타로+사주 15분 · 12,900원"], ["timepass-saju-30", "타로+사주 30분 · 19,900원"], ["timepass-saju-60", "타로+사주 60분 · 24,900원"],
  ["timepass-ziwei-15", "타로+자미두수 15분 · 19,900원"], ["timepass-ziwei-30", "타로+자미두수 30분 · 24,900원"], ["timepass-ziwei-60", "타로+자미두수 60분 · 39,900원"],
  ["timepass-all-15", "타로+사주+자미두수 15분 · 24,900원"], ["timepass-all-30", "타로+사주+자미두수 30분 · 39,900원"], ["timepass-all-60", "타로+사주+자미두수 60분 · 65,900원"],
] as const;

function TimePassGrantControls({ uid }: { uid: string }) {
  const [productId, setProductId] = useState<string>(TIME_GRANT_PRODUCTS[0][0]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function grant() {
    const admin = auth.currentUser; if (!admin) return;
    setBusy(true); setMessage(null);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/grant-time-pass`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ productId, reason }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.error ?? "시간제 이용권 지급에 실패했습니다.");
      setMessage("시간제 이용권을 지급했습니다."); setReason("");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2"><select value={productId} onChange={(e) => setProductId(e.target.value)} className="max-w-64 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]">{TIME_GRANT_PRODUCTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="지급 사유 (선택)" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><button disabled={busy} onClick={grant} className="rounded-xl bg-[#3B2D47] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "지급 중..." : "시간제 지급"}</button>{message && <p className="text-xs text-[#B81D6E]">{message}</p>}</div>;
}

function UserOverviewPanel({ overview, uid, suspended }: { overview: UserOverview; uid: string; suspended: boolean }) {
  return (
    <div className="rounded-[20px] border border-[#E7DFEC] bg-[#F8F5F9] p-4 shadow-inner shadow-[#E7DFEC]/30">
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-[#EEE8F1] bg-white p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#45394F]">최근 리딩 20건</h3>
              <p className="mt-1 text-xs text-[#8D8296]">무료 처리 {overview.recentFreeReadings}건 · 부정 요청 추정은 분홍 배지로 표시</p>
            </div>
            <span className="rounded-full bg-[#F9EEF5] px-2.5 py-1 text-[11px] font-semibold text-[#B81D6E]">무료 {overview.recentFreeReadings}건</span>
          </div>
          {overview.recentReadings.length === 0 ? (
            <p className="mt-4 text-xs text-[#A299AA]">리딩 기록이 없습니다.</p>
          ) : (
            <ul className="mt-3 max-h-64 divide-y divide-[#F0ECF2] overflow-y-auto">
              {overview.recentReadings.map((reading) => (
                <li key={`${reading.roomId}:${reading.id}`} className="py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs font-medium text-[#52435E]">{reading.question || "(질문 없음)"}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!reading.charged && <span className="rounded-full bg-[#FCEBF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#C02772]">무료</span>}
                      {reading.flaggedForAbuse && <span className="rounded-full bg-[#FFF2E7] px-1.5 py-0.5 text-[10px] font-semibold text-[#A55A19]">검토</span>}
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9A90A2]">{reading.roomTitle} · {shortDate(reading.createdAt)}{reading.topic ? ` · ${reading.topic}` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <PassList title="구매 이용권" passes={overview.purchasedPasses} emptyText="구매 이용권이 없습니다." />
          <PassList title="리워드·쿠폰 이용권" passes={overview.rewardPasses} emptyText="받은 리워드나 쿠폰이 없습니다." />
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#EEE8F1] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#45394F]">LIVE 결제 내역</h3>
          {overview.livePayments.length === 0 ? <p className="mt-3 text-xs text-[#A299AA]">LIVE 결제가 없습니다.</p> : (
            <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto text-xs">
              {overview.livePayments.map((payment) => <li key={payment.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF8FB] px-3 py-2"><span className="truncate text-[#665A70]">{payment.orderName ?? payment.id}</span><span className="shrink-0 font-medium text-[#4B3D56]">{won(payment.priceWon)} · {payment.status}</span></li>)}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-[#EEE8F1] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#45394F]">정지 이력</h3>
          {overview.suspensionLog.length === 0 ? <p className="mt-3 text-xs text-[#A299AA]">정지 이력이 없습니다.</p> : (
            <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto text-xs">
              {overview.suspensionLog.map((log) => <li key={log.id} className="rounded-lg bg-[#FAF8FB] px-3 py-2 text-[#665A70]"><span className="font-semibold">{log.action === "suspended" ? "정지" : "정지 해제"}</span>{log.reason ? ` · ${log.reason}` : ""}<p className="mt-1 text-[11px] text-[#9A90A2]">{shortDate(log.createdAt)}{log.action === "suspended" ? ` · ${log.durationDays ? `${log.durationDays}일 (해제 ${shortDate(log.suspendedUntil)})` : "영구"}` : ""}</p></li>)}
            </ul>
          )}
        </section>
      </div>
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">계정 정지</h3><p className="mt-1 text-xs text-[#8D8296]">로그인·기록 열람은 유지되며, 리딩·결제·보상 수령만 제한됩니다.</p></div><SuspensionControls uid={uid} suspended={suspended} /></section>
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">횟수제 이용권 지급</h3><p className="mt-1 text-xs text-[#8D8296]">자미두수 포함 조합은 태어난 시간이 등록된 사용자에게만 지급할 수 있습니다.</p></div><CountPassGrantControls uid={uid} /></section>
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">시간제 이용권 지급</h3><p className="mt-1 text-xs text-[#8D8296]">12종 상품 중 선택해 지급합니다. 자미두수 포함 상품은 태어난 시간이 필요합니다.</p></div><TimePassGrantControls uid={uid} /></section>
    </div>
  );
}

export default function UserDirectoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<UserItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [overview, setOverview] = useState<Record<string, UserOverview>>({});
  const [overviewLoading, setOverviewLoading] = useState<string | null>(null);

  const loadPage = useCallback(async (firebaseUser: User, cursor: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await fetch(`/api/admin/users${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as PageData & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "사용자 목록을 불러오지 못했습니다.");
        return;
      }
      setEntries(body.users);
      setNextCursor(body.nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/login");
        return;
      }
      setUser(firebaseUser);
      await loadPage(firebaseUser, null);
    });
  }, [loadPage, router]);

  async function moveTo(cursor: string | null, direction: "next" | "previous") {
    if (!user) return;
    await loadPage(user, cursor);
    setCursorStack((stack) =>
      direction === "next" ? [...stack, cursor] : stack.length > 1 ? stack.slice(0, -1) : stack
    );
  }

  async function toggleOverview(uid: string) {
    if (openUid === uid) {
      setOpenUid(null);
      return;
    }
    setOpenUid(uid);
    if (!user || overview[uid]) return;

    setOverviewLoading(uid);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/overview`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as UserOverview & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "사용자 상세 정보를 불러오지 못했습니다.");
        return;
      }
      setOverview((current) => ({ ...current, [uid]: body }));
    } finally {
      setOverviewLoading(null);
    }
  }

  const liveSalesTotal = entries.reduce((total, entry) => total + entry.paymentTotalWon, 0);
  const refundedTotal = entries.reduce((total, entry) => total + entry.refundTotalWon, 0);
  const suspendedTotal = entries.filter((entry) => entry.status === "suspended").length;

  return (
    <main className="min-h-screen bg-[#F7F5FA] px-4 py-5 text-[#302B38] sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <header className="relative overflow-hidden rounded-[28px] bg-[#30253A] px-6 py-7 text-white shadow-[0_18px_45px_rgb(53_35_67/16%)] sm:px-8">
          <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-[#FF007F]/20 blur-3xl" />
          <div className="absolute bottom-0 right-28 h-24 w-24 rounded-full border border-white/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-[#E7C9DD]">TAYEON ADMIN</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">사용자 관리</h1>
              <p className="mt-2 text-sm text-[#D6CDDB]">사용자 현황과 이용권 상태를 한 곳에서 관리하세요.</p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              대시보드로 돌아가기
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["현재 페이지 사용자", `${entries.length}명`, "한 페이지 최대 100명"],
            ["LIVE 누적 결제", won(liveSalesTotal), "환불 건 포함 결제 총액"],
            ["누적 환불", won(refundedTotal), "LIVE 결제 환불액"],
            ["정지 사용자", `${suspendedTotal}명`, "현재 페이지 기준"],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-[#E9E3EF] bg-white px-5 py-4 shadow-[0_8px_24px_rgb(57_39_73/4%)]">
              <p className="text-xs font-medium text-[#817789]">{label}</p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-[#342B3D]">{value}</p>
              <p className="mt-1 text-xs text-[#AAA1B0]">{hint}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-[24px] border border-[#E9E3EF] bg-white shadow-[0_12px_30px_rgb(57_39_73/5%)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EEEAF1] px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-[#342B3D]">전체 사용자</h2>
              <p className="mt-1 text-sm text-[#817789]">한 페이지에 100명씩 표시하며, 결제·환불 금액은 LIVE 결제만 집계합니다.</p>
            </div>
            <span className="rounded-full bg-[#F9EEF5] px-3 py-1.5 text-xs font-semibold text-[#B81D6E]">UID 순 정렬</span>
          </div>

          {error && <p className="m-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto">
            <table className="min-w-[1300px] w-full text-left text-sm">
          <thead className="border-b border-[#EEEAF1] bg-[#FCFBFD] text-[11px] font-semibold tracking-wide text-[#817789]">
            <tr>
              <th className="px-6 py-3.5 font-semibold">사용자</th>
              <th className="px-4 py-3.5 font-semibold">상태</th>
              <th className="px-4 py-3.5 text-right font-semibold">누적 결제</th>
              <th className="px-4 py-3.5 text-right font-semibold">환불</th>
              <th className="px-4 py-3.5 font-semibold">횟수제 이용권</th>
              <th className="px-4 py-3.5 font-semibold">시간제 이용권</th>
              <th className="px-4 py-3.5 font-semibold">보너스 리워드</th>
              <th className="px-6 py-3.5 font-semibold">친구초대 리워드</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EDF2]">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-[#AAA1B0]">사용자 정보를 불러오는 중...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-[#AAA1B0]">표시할 사용자가 없습니다.</td></tr>
            ) : (
              entries.map((entry) => (
                <Fragment key={entry.uid}>
                <tr className="transition-colors hover:bg-[#FCF9FC]">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-[#342B3D]">{entry.nickname ?? "(닉네임 없음)"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="font-mono text-[11px] text-[#93899A]">{entry.uid}</p>
                      <button onClick={() => toggleOverview(entry.uid)} className="text-[11px] font-semibold text-[#B81D6E] underline underline-offset-2">
                        {openUid === entry.uid ? "상세 닫기" : "상세 보기"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={entry.status === "suspended" ? "rounded-full bg-[#FFF0F3] px-2.5 py-1 text-xs font-semibold text-[#C5304B]" : "rounded-full bg-[#EEF8F2] px-2.5 py-1 text-xs font-semibold text-[#27754C]"}>
                      {entry.status === "suspended" ? "정지" : "정상"}
                    </span>
                    {entry.suspendedAt && <p className="mt-1.5 text-[11px] text-[#93899A]">정지 {entry.suspendedAt.replace("T", " ").slice(0, 19)}{entry.suspendedUntil ? ` · 해제 ${shortDate(entry.suspendedUntil)}` : " · 영구"}</p>}
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums text-[#342B3D]">{won(entry.paymentTotalWon)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-[#817789]">{won(entry.refundTotalWon)}</td>
                  <td className="px-4 py-4 text-[#584D61]">보유 {entry.countPasses.held}개{entry.countPasses.active ? <span className="ml-1.5 text-xs text-[#B81D6E]">사용 중 {entry.countPasses.active}</span> : null}</td>
                  <td className="px-4 py-4 text-[#584D61]">보유 {entry.timePasses.held}개{entry.timePasses.active ? <span className="ml-1.5 text-xs text-[#B81D6E]">사용 중 {entry.timePasses.active}</span> : null}</td>
                  <td className="px-4 py-4 text-[#584D61]">{entry.bonusRewardPasses}개</td>
                  <td className="px-6 py-4 text-[#584D61]">{entry.friendInvitePasses}개</td>
                </tr>
                {openUid === entry.uid && (
                  <tr className="bg-[#FCF9FC]">
                    <td colSpan={8} className="px-6 pb-6 pt-1">
                      {overviewLoading === entry.uid ? (
                        <div className="rounded-2xl border border-[#ECE4F0] bg-white px-4 py-8 text-center text-sm text-[#93899A]">상세 정보를 불러오는 중...</div>
                      ) : overview[entry.uid] ? (
                        <UserOverviewPanel overview={overview[entry.uid]} uid={entry.uid} suspended={entry.status === "suspended"} />
                      ) : null}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
          </div>
        </section>

        <nav className="flex items-center justify-between px-1" aria-label="사용자 목록 페이지">
        <button
          disabled={loading || cursorStack.length === 1}
          onClick={() => moveTo(cursorStack.at(-2) ?? null, "previous")}
          className="rounded-xl border border-[#DED7E4] bg-white px-4 py-2.5 text-sm font-medium text-[#584D61] shadow-[0_4px_12px_rgb(57_39_73/4%)] transition hover:border-[#BCAFC6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전 100명
        </button>
        <button
          disabled={loading || !nextCursor}
          onClick={() => nextCursor && moveTo(nextCursor, "next")}
          className="rounded-xl bg-[#3B2D47] px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_18px_rgb(59_45_71/18%)] transition hover:bg-[#4B3959] disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 100명
        </button>
        </nav>
      </div>
    </main>
  );
}
