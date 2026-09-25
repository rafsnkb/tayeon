"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { kstDateTime } from "@/lib/datetime";
import { AdminPageHeader } from "@/components/AdminPageHeader";

type CouponState = "active" | "scheduled" | "expired" | "soldOut" | "disabled" | "broken";
type Coupon = {
  code: string;
  name: string;
  discountPercent: number;
  startsAt: string;
  endsAt: string;
  maxRegistrations: number | null;
  registeredCount: number;
  remaining: number | null;
  state: CouponState;
  disabled: boolean;
  createdAt: string;
};

const STATE_LABEL: Record<CouponState, string> = {
  active: "진행 중",
  scheduled: "시작 전",
  expired: "기간 만료",
  soldOut: "선착순 마감",
  disabled: "중지됨",
  broken: "기간 오류",
};
const STATE_STYLE: Record<CouponState, string> = {
  active: "bg-[#EAF6EF] text-[#23754B]",
  scheduled: "bg-[#EEF2FB] text-[#3B5B9B]",
  expired: "bg-[#F2EFF4] text-[#64586B]",
  soldOut: "bg-[#FCEEF5] text-[#A31459]",
  disabled: "bg-[#F2EFF4] text-[#64586B]",
  broken: "bg-red-50 text-red-700",
};

/** `datetime-local` 값은 타임존이 없다. 브라우저 기준(운영자의 KST)으로 해석해 ISO 로 바꿔
 *  보낸다 — 서버에서 그대로 Date.parse 하면 서버 타임존(UTC)으로 읽혀 9 시간이 어긋난다. */
function toIso(localValue: string): string {
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export default function DiscountCouponsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [code, setCode] = useState("");
  /** 코드 중복 안내. 발급을 눌러야 알 수 있게 두면 날짜·이름까지 다 채운 뒤에야 걸린다.
   *  최종 판정은 어디까지나 발급 트랜잭션이 한다 — 여기 표시는 미리 알려 주는 것뿐이다. */
  const [codeTaken, setCodeTaken] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [name, setName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("30");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxRegistrations, setMaxRegistrations] = useState("");

  async function load(firebaseUser: User) {
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/admin/discount-coupons", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "쿠폰을 불러오지 못했습니다.");
      setCoupons(result.coupons);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠폰을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) return router.push("/login");
    setUser(firebaseUser);
    await load(firebaseUser);
  }), [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/discount-coupons", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          discountPercent: Number(discountPercent),
          startsAt: toIso(startsAt),
          endsAt: toIso(endsAt),
          maxRegistrations: maxRegistrations.trim() === "" ? null : Number(maxRegistrations),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "쿠폰 발급에 실패했습니다.");
      setNotice(`${result.name}(${result.code}) 발급했습니다.`);
      setCode("");
      setCodeTaken(false);
      setName("");
      setMaxRegistrations("");
      await load(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "쿠폰 발급에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  /** 아직 쓰이지 않은 코드를 서버에서 받아 온다. 화면 목록은 최근 100건뿐이라 여기서 대조하면
   *  더 오래된 코드와 겹치는 것을 놓친다. */
  async function generate() {
    if (!user || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/discount-coupons/generate", { headers: { authorization: `Bearer ${token}` } });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setError(result.error ?? "코드를 만들지 못했습니다.");
      setCode(result.code);
      setCodeTaken(false);
    } finally {
      setGenerating(false);
    }
  }

  /** 직접 입력한 코드가 이미 쓰였는지 확인한다(입력을 마쳤을 때 한 번). */
  async function checkCode(value: string) {
    setCodeTaken(false);
    if (!user || value.trim().length < 4) return;
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/discount-coupons/generate?check=${encodeURIComponent(value)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) setCodeTaken(Boolean(result.taken));
  }

  async function toggleDisabled(coupon: Coupon) {
    if (!user) return;
    const next = !coupon.disabled;
    if (next && !confirm(`"${coupon.name || coupon.code}" 쿠폰을 중지할까요?\n이미 받은 사람은 계속 쓸 수 있고, 새로 등록만 막힙니다.`)) return;
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/discount-coupons", {
        method: "PATCH",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ code: coupon.code, disabled: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "상태를 바꾸지 못했습니다.");
      await load(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "상태를 바꾸지 못했습니다.");
    }
  }

  return (
    <main className="admin-page px-4 pb-12 text-[#1D1D1F] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <AdminPageHeader title="할인쿠폰" description="코드를 발급하고 등록 현황을 확인합니다. 특정 사용자에게 직접 지급하는 것은 사용자 화면에서 합니다." />

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.3fr]">
          <form onSubmit={submit} className="rounded-[24px] border border-[#E9E3EF] bg-white p-5 shadow-[0_12px_30px_rgb(57_39_73/5%)] sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">새 쿠폰 발급</h2>
              <span className="rounded-full bg-[#F9EEF5] px-2.5 py-1 text-[11px] font-semibold text-[#B81D6E]">기간 중복 불가</span>
            </div>

            <label className="mt-5 block text-xs font-semibold text-[#665A70]">쿠폰 이름</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required placeholder="런칭 기념 30% 할인" className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3.5 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />

            <label className="mt-4 block text-xs font-semibold text-[#665A70]">코드 <span className="font-normal text-[#A299AA]">영문 대문자·숫자 4~20자</span></label>
            <div className="mt-2 flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeTaken(false); }}
                onBlur={(e) => checkCode(e.target.value)}
                maxLength={20}
                required
                placeholder="LAUNCH30"
                className={`min-w-0 flex-1 rounded-xl border bg-[#FCFBFD] px-3.5 py-3 font-mono text-sm tracking-wider outline-none transition focus:ring-4 focus:ring-[#FBEAF3] ${codeTaken ? "border-red-400 focus:border-red-400" : "border-[#E6DFEB] focus:border-[#C46799]"}`}
              />
              <button type="button" onClick={generate} disabled={generating} className="shrink-0 rounded-xl border border-[#E4DDE9] bg-white px-3 py-3 text-xs font-semibold text-[#665A70] transition hover:bg-[#FAF8FB] disabled:opacity-50">
                {generating ? "생성 중..." : "랜덤 생성"}
              </button>
            </div>
            {codeTaken && <p className="mt-2 text-xs font-semibold text-red-600">이미 사용된 코드입니다. 다른 코드를 입력하거나 랜덤 생성을 눌러주세요.</p>}

            <label className="mt-4 block text-xs font-semibold text-[#665A70]">할인율 <span className="font-normal text-[#A299AA]">1~99%</span></label>
            <input type="number" min={1} max={99} step={1} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} required className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3.5 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#665A70]">시작</label>
                <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#665A70]">종료</label>
                <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />
              </div>
            </div>

            <label className="mt-4 block text-xs font-semibold text-[#665A70]">선착순 인원 <span className="font-normal text-[#A299AA]">비우면 무제한</span></label>
            <input type="number" min={1} step={1} value={maxRegistrations} onChange={(e) => setMaxRegistrations(e.target.value)} placeholder="예: 100" className="mt-2 w-full rounded-xl border border-[#E6DFEB] bg-[#FCFBFD] px-3.5 py-3 text-sm outline-none transition focus:border-[#C46799] focus:ring-4 focus:ring-[#FBEAF3]" />

            <p className="mt-4 rounded-xl bg-[#FAF8FB] px-3 py-3 text-xs leading-5 text-[#817789]">
              유효기간이 겹치는 쿠폰은 발급되지 않습니다. 한 사용자가 동시에 쓸 수 있는 쿠폰을 한 장으로 유지하기 위한 제한입니다.
              선착순은 <strong className="font-semibold text-[#665A70]">등록</strong> 기준이며, 구매·환불은 이 수를 바꾸지 않습니다.
            </p>

            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {notice && <p className="mt-4 rounded-xl bg-[#EAF6EF] px-3 py-2 text-sm text-[#23754B]">{notice}</p>}
            <button disabled={submitting || codeTaken} className="mt-5 w-full rounded-xl bg-[#3B2D47] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_18px_rgb(59_45_71/18%)] transition hover:bg-[#4B3959] disabled:opacity-50">{submitting ? "발급 중..." : "쿠폰 발급하기"}</button>
          </form>

          <section className="overflow-hidden rounded-[24px] border border-[#E9E3EF] bg-white shadow-[0_12px_30px_rgb(57_39_73/5%)]">
            <div className="border-b border-[#EEEAF1] px-5 py-5 sm:px-6">
              <h2 className="text-base font-semibold">발급 현황</h2>
              <p className="mt-1 text-sm text-[#817789]">최근 100건. 소진된 뒤에도 &ldquo;선착순&rdquo; 문구를 노출하면 안 되므로 잔여 수량을 함께 표시합니다.</p>
            </div>
            {loading ? (
              <p className="p-12 text-center text-sm text-[#93899A]">불러오는 중...</p>
            ) : coupons.length === 0 ? (
              <p className="p-12 text-center text-sm text-[#93899A]">발급한 쿠폰이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-[#F0EDF2]">
                {coupons.map((coupon) => (
                  <li key={coupon.code} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#44374D]">{coupon.name || "(이름 없음)"}</p>
                          <span className={`rounded-full px-2.5 py-1 text-xs ${STATE_STYLE[coupon.state]}`}>{STATE_LABEL[coupon.state]}</span>
                        </div>
                        <p className="mt-1 font-mono text-xs tracking-wider text-[#817789]">{coupon.code}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-[#B81D6E]">{coupon.discountPercent}%</p>
                        <p className="mt-0.5 text-xs text-[#817789]">
                          등록 {coupon.registeredCount.toLocaleString("ko-KR")}
                          {coupon.maxRegistrations !== null && ` / ${coupon.maxRegistrations.toLocaleString("ko-KR")}명`}
                          {coupon.remaining !== null && <span className="ml-1 text-[#A31459]">잔여 {coupon.remaining.toLocaleString("ko-KR")}</span>}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-1.5 text-sm text-[#51475B] sm:grid-cols-2">
                      <div><dt className="inline text-[#9A8FA0]">시작 · </dt><dd className="inline">{kstDateTime(coupon.startsAt)}</dd></div>
                      <div><dt className="inline text-[#9A8FA0]">종료 · </dt><dd className="inline">{kstDateTime(coupon.endsAt)}</dd></div>
                    </dl>
                    <button type="button" onClick={() => toggleDisabled(coupon)} className="mt-3 rounded-full border border-[#D2D2D7] px-3 py-1.5 text-xs font-medium text-[#424245] transition hover:bg-[#FAF8FB]">
                      {coupon.disabled ? "다시 사용 가능하게" : "새 등록 중지"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
