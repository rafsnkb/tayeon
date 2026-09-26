"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { kstDateTime } from "@/lib/datetime";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { COUNT_PACKAGES } from "@/lib/countPassPackages";
import { TIME_PASS_PACKAGES } from "@/lib/timePassPackages";

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
  type: "countPass" | "timePass" | "pendingReward";
  source: string;
  status: string;
  revokedForced?: boolean;
  combo: string | null;
  minutes: number | null;
  remainingCount: number | null;
  createdAt: string;
  expiresAt: string | null;
  usableUntil: string | null;
  paymentId: string | null;
};

/** 이용권·결제 상태를 운영자가 읽는 말로 바꾼다. 사용자 화면(purchase-history 의 badgeLabel)과

 *  같은 낱말을 쓴다 — 운영자와 사용자가 다른 이름으로 같은 상태를 부르면 문의 응대가 어긋난다.

 *

 *  표에 없는 값은 **원문 그대로** 보여준다. 새 상태가 생겼을 때 "알 수 없음"으로 뭉뚱그리면

 *  화면에서는 멀쩡해 보이고 원인만 숨는다. */

const PASS_STATUS_LABEL: Record<string, string> = {

  unused: "미사용",

  active: "사용중",

  exhausted: "사용완료",

  expired: "기간만료",

  refunded: "환불완료",

  revoked: "회수됨",

  refund_pending: "환불 대기중",

  unknown: "상태 없음",

};

const PAYMENT_STATUS_LABEL: Record<string, string> = {

  fulfilled: "지급완료",

  refunded: "환불완료",

  duplicate_cancelled: "중복 취소",

  coupon_conflict_cancelled: "쿠폰 충돌 취소",

};

const passStatusLabel = (status: string, forced?: boolean) =>
  status === "revoked" && forced ? "강제 회수됨" : PASS_STATUS_LABEL[status] ?? status;

const paymentStatusLabel = (status: string) => PAYMENT_STATUS_LABEL[status] ?? status;



type ReviewReading = {
  roomId: string;
  readingId: string;
  roomTitle: string | null;
  question: string;
  interpretation: string;
  createdAt: string;
  spread: string | null;
  flaggedForAbuse: boolean;
};

type UserOverview = {
  reviewReadings: ReviewReading[];
  reviewReadingsTotal: number;
  purchasedPasses: PassItem[];
  rewardPasses: PassItem[];
  livePayments: Array<{
    id: string;
    productId: string | null;
    productType: string | null;
    orderName: string | null;
    priceWon: number;
    status: string;
    paidAt: string | null;
    refundedAt: string | null;
  }>;
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
  birthday: "생일 기념 무료 이용권",
};

const COMBO_LABEL: Record<string, string> = {
  tarot: "타로",
  "tarot-saju": "타로+사주",
  "tarot-ziwei": "타로+자미두수",
  "tarot-saju-ziwei": "타로+사주+자미두수",
};

const shortDate = (value: string | null) => kstDateTime(value);

type PassCategory = "all" | "purchase" | "reward" | "admin-grant";

const PASS_CATEGORY_LABEL: Record<PassCategory, string> = {
  all: "모두",
  purchase: "구매",
  reward: "리워드",
  "admin-grant": "운영자 지급",
};

function matchesPassCategory(pass: PassItem, category: PassCategory) {
  if (category === "all") return true;
  if (category === "admin-grant") return pass.source === "admin-grant";
  if (category === "purchase") return pass.source === "purchase";
  return pass.source !== "purchase" && pass.source !== "admin-grant";
}

function HeldPassesPanel({
  uid,
  purchasedPasses,
  rewardPasses,
  onUpdate,
}: {
  uid: string;
  purchasedPasses: PassItem[];
  rewardPasses: PassItem[];
  onUpdate: (uid: string, updater: (prev: UserOverview) => UserOverview) => void;
}) {
  const [category, setCategory] = useState<PassCategory>("all");
  const [refundBusy, setRefundBusy] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState<string | null>(null);
  const passes = [...purchasedPasses, ...rewardPasses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = passes.filter((pass) => matchesPassCategory(pass, category));

  /** 구매분 환불 — 포트원 결제 취소까지 실제로 실행된다(executeRefund).
   *
   *  환불 요청 목록에는 status 가 pending 인 건만 나온다. 메일로 접수된 요청(약관 제9조9항)
   *  이나 한 번 거절됐다가 다시 처리해야 하는 건은 그 목록에 안 잡혀서, 여기가 유일한
   *  경로다(2026-09-24). 결제 후 7일 이내 · 미사용 조건은 서버가 다시 강제한다. */
  async function refund(pass: PassItem) {
    const admin = auth.currentUser;
    if (!admin || !pass.paymentId) return;
    const reason = prompt("환불 사유를 입력하세요. (사용자에게 노출되지 않지만 기록에 남습니다)");
    if (!reason?.trim()) return;
    if (!confirm("결제를 실제로 취소하고 이용권을 회수합니다. 진행할까요?")) return;
    setRefundBusy(pass.id);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/refund-payment`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ paymentId: pass.paymentId, reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(body.error ?? "환불에 실패했습니다.");
        return;
      }
      if (body.alreadyCancelled) {
        alert("포트원에서 이미 취소된 결제였습니다. 앱 기록만 맞췄습니다(추가 환불은 일어나지 않았습니다).");
      }
      onUpdate(uid, (prev) => ({
        ...prev,
        purchasedPasses: prev.purchasedPasses.map((p) => (p.id === pass.id ? { ...p, status: "refunded" } : p)),
      }));
    } finally {
      setRefundBusy(null);
    }
  }

  /** 운영자 지급분 회수. force 면 사용자가 이미 쓰기 시작한 것까지 거둬들인다 — 남은 횟수를
   *  통째로 뺏는 일이라 무엇을 뺏는지 보여주고 한 번 더 확인받는다. */
  async function revoke(pass: PassItem, force = false) {
    const admin = auth.currentUser;
    if (!admin || (pass.type !== "countPass" && pass.type !== "timePass")) return;
    const reason = prompt(force ? "강제 회수 사유를 입력하세요. (기록에 남습니다)" : "회수 사유를 입력하세요.");
    if (!reason?.trim()) return;
    const held =
      pass.remainingCount !== null
        ? `잔여 ${pass.remainingCount}회(원카드 기준)`
        : pass.minutes
          ? `${pass.minutes}분 시간제`
          : "";
    const question = force
      ? `사용 중인 이용권을 강제로 회수합니다${held ? ` — ${held}` : ""}. 사용자는 즉시 쓸 수 없게 됩니다. 되돌릴 수 없습니다. 진행할까요?`
      : "이 이용권을 회수할까요? 되돌릴 수 없습니다.";
    if (!confirm(question)) return;
    setRevokeBusy(pass.id);
    try {
      const token = await admin.getIdToken();
      const segment = pass.type === "countPass" ? "count-passes" : "time-passes";
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(uid)}/${segment}/${encodeURIComponent(pass.id)}/revoke`,
        { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ reason: reason.trim(), force }) }
      );
      if (!response.ok) { alert((await response.json().catch(() => ({}))).error ?? "회수에 실패했습니다."); return; }
      // 회수한 이용권을 목록에서 지우면 방금 무엇을 거둬들였는지 확인할 방법이 사라진다.
      // 서버는 회수분도 그대로 내려주는데 지운 건 화면뿐이었다(2026-09-24). 환불과 같이
      // 상태만 바꿔서 자리에 남긴다.
      const markRevoked = (list: PassItem[]) =>
        list.map((p) => (p.id === pass.id ? { ...p, status: "revoked", revokedForced: force } : p));
      onUpdate(uid, (prev) => ({
        ...prev,
        purchasedPasses: markRevoked(prev.purchasedPasses),
        rewardPasses: markRevoked(prev.rewardPasses),
      }));
    } finally {
      setRevokeBusy(null);
    }
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-[#EEE8F1] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#45394F]">보유 이용권 목록</h3>
        <span className="rounded-full bg-[#F4F0F6] px-2 py-1 text-[11px] font-medium text-[#786D82]">{passes.length}건</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(PASS_CATEGORY_LABEL) as PassCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={
              category === c
                ? "rounded-full bg-[#3B2D47] px-2.5 py-1 text-[11px] font-semibold text-white"
                : "rounded-full border border-[#E4DDE9] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#584D61]"
            }
          >
            {PASS_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-3 text-xs text-[#A299AA]">해당하는 이용권이 없습니다.</p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((pass) => {
            const granted = pass.source === "admin-grant" && (pass.type === "countPass" || pass.type === "timePass");
            const revocable = granted && pass.status === "unused";
            // 사용을 시작한 지급분은 평소 경로로 거둬들일 수 없었다 — 잘못 지급한 이용권을
            // 사용자가 쓰기 시작하면 남은 횟수를 다 쓸 때까지 지켜보는 것 말고 할 수 있는 게
            // 없었다(2026-09-24). 라이브에서 쓸 일은 드물지만 실수 지급·테스트 계정 정리에
            // 필요하다. 구매분은 여전히 대상이 아니다(돈이 걸린 건은 환불로만).
            const forceRevocable = granted && pass.status === "active";
            // 구매분은 회수가 아니라 환불이다 — 사용자가 돈을 낸 이용권을 돌려주지 않고 뺏을 수
            // 없다. refund_pending 도 포함한다: 환불을 신청했다가 거절돼 멈춰 있는 건을 풀 수
            // 있는 경로가 여기뿐이다(요청 목록은 pending 만 보여준다).
            const refundable =
              pass.source === "purchase" &&
              !!pass.paymentId &&
              (pass.status === "unused" || pass.status === "refund_pending") &&
              (pass.type === "countPass" || pass.type === "timePass");
            return (
              <li key={pass.id} className="rounded-xl bg-[#FAF8FB] px-3 py-2 text-xs text-[#665A70]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#4B3D56]">{SOURCE_LABEL[pass.source] ?? pass.source}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#8D8296]">{passStatusLabel(pass.status, pass.revokedForced)}</span>
                    {refundable && (
                      <button
                        onClick={() => refund(pass)}
                        disabled={refundBusy === pass.id}
                        className="rounded-full border border-[#E4DDE9] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#B81D6E] disabled:opacity-50"
                      >
                        {refundBusy === pass.id ? "처리 중..." : "환불"}
                      </button>
                    )}
                    {revocable && (
                      <button
                        onClick={() => revoke(pass)}
                        disabled={revokeBusy === pass.id}
                        className="rounded-full border border-[#E4DDE9] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#B81D6E] disabled:opacity-50"
                      >
                        {revokeBusy === pass.id ? "처리 중..." : "회수"}
                      </button>
                    )}
                    {forceRevocable && (
                      <button
                        onClick={() => revoke(pass, true)}
                        disabled={revokeBusy === pass.id}
                        className="rounded-full border border-[#E7B7CD] bg-[#FDF2F7] px-2 py-0.5 text-[11px] font-semibold text-[#B81D6E] disabled:opacity-50"
                      >
                        {revokeBusy === pass.id ? "처리 중..." : "강제 회수"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1">{pass.minutes ? `${pass.minutes}분 시간제` : pass.combo ? COMBO_LABEL[pass.combo] ?? pass.combo : "횟수제"}{pass.remainingCount !== null ? ` · 잔여 ${pass.remainingCount}회 (원카드 기준)` : ""}</p>
                <p className="mt-1 text-[11px] text-[#9A90A2]">발급 {shortDate(pass.createdAt)} · 만료 {shortDate(pass.expiresAt ?? pass.usableUntil)}</p>
              </li>
            );
          })}
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

const CUSTOM_COUNT_VALUE = "custom";

function CountPassGrantControls({ uid }: { uid: string }) {
  const [productId, setProductId] = useState<string>(COUNT_PACKAGES[0].id);
  const [count, setCount] = useState("");
  const [combo, setCombo] = useState("tarot");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isCustom = productId === CUSTOM_COUNT_VALUE;
  async function grant() {
    const admin = auth.currentUser;
    if (!admin) return;
    setBusy(true); setMessage(null);
    try {
      const token = await admin.getIdToken();
      const body = isCustom ? { count: Number(count), combo, reason } : { productId, combo, reason };
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/grant-count-pass`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(responseBody.error ?? "이용권 지급에 실패했습니다.");
      setMessage("횟수제 이용권을 지급했습니다."); setCount(""); setReason("");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    <select value={productId} onChange={(e) => setProductId(e.target.value)} className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]">
      {COUNT_PACKAGES.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.priceWon.toLocaleString("ko-KR")}원</option>)}
      <option value={CUSTOM_COUNT_VALUE}>직접 입력(커스텀)</option>
    </select>
    {isCustom && <input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="1" max="10000" placeholder="횟수" className="w-20 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" />}
    <select value={combo} onChange={(e) => setCombo(e.target.value)} className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]"><option value="tarot">타로</option><option value="tarot-saju">타로+사주</option><option value="tarot-ziwei">타로+자미두수</option><option value="tarot-saju-ziwei">타로+사주+자미두수</option></select>
    <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="지급 사유" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" />
    <button disabled={busy} onClick={grant} className="rounded-xl bg-[#3B2D47] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "지급 중..." : "횟수제 지급"}</button>
    {message && <p className="text-xs text-[#B81D6E]">{message}</p>}
  </div>;
}

function TimePassGrantControls({ uid }: { uid: string }) {
  const [productId, setProductId] = useState<string>(TIME_PASS_PACKAGES[0].id);
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
  return <div className="flex flex-wrap items-center gap-2"><select value={productId} onChange={(e) => setProductId(e.target.value)} className="max-w-64 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]">{TIME_PASS_PACKAGES.map((pkg) => <option key={pkg.id} value={pkg.id}>{COMBO_LABEL[pkg.combo]} {pkg.minutes}분 · {pkg.priceWon.toLocaleString("ko-KR")}원</option>)}</select><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="지급 사유 (선택)" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><button disabled={busy} onClick={grant} className="rounded-xl bg-[#3B2D47] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "지급 중..." : "시간제 지급"}</button>{message && <p className="text-xs text-[#B81D6E]">{message}</p>}</div>;
}

/** 할인쿠폰 직접 지급. 이미 발급된 코드를 그 사람 쿠폰함에 넣어 주는 것이라, 이용권 지급이
 *  상품표에서 고르는 것과 같은 모양이다 — 여기서 새 쿠폰을 만들지는 않는다(기간이 겹치면
 *  "쓸 수 있는 쿠폰은 한 장" 전제가 깨진다. 쿠폰 발급은 /discount-coupons 에서 한다). */
function DiscountCouponGrantControls({ uid }: { uid: string }) {
  const [coupons, setCoupons] = useState<Array<{ code: string; name: string; discountPercent: number; state: string }>>([]);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const admin = auth.currentUser; if (!admin) return;
      const token = await admin.getIdToken();
      const response = await fetch("/api/admin/discount-coupons", { headers: { authorization: `Bearer ${token}` } });
      const body = await response.json().catch(() => ({}));
      if (cancelled || !response.ok) return;
      // 이미 끝났거나 중지된 쿠폰은 지급해 봐야 쓸 수 없다 — 고를 수 없게 한다.
      const usable = (body.coupons ?? []).filter((c: { state: string }) => c.state === "active" || c.state === "scheduled" || c.state === "soldOut");
      setCoupons(usable);
      if (usable.length > 0) setCode(usable[0].code);
    })();
    return () => { cancelled = true; };
  }, []);

  async function grant() {
    const admin = auth.currentUser; if (!admin || !code) return;
    setBusy(true); setMessage(null);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/grant-discount-coupon`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ code, reason }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(body.error ?? "쿠폰 지급에 실패했습니다.");
      setMessage(`${body.name || body.code} 쿠폰을 지급했습니다.`); setReason("");
    } finally { setBusy(false); }
  }

  if (coupons.length === 0) return <p className="text-xs text-[#8D8296]">지급할 수 있는 쿠폰이 없습니다. 쿠폰 화면에서 먼저 발급하세요.</p>;
  return <div className="flex flex-wrap items-center gap-2"><select value={code} onChange={(e) => setCode(e.target.value)} className="max-w-72 rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]">{coupons.map((c) => <option key={c.code} value={c.code}>{c.name || c.code} · {c.discountPercent}%{c.state === "soldOut" ? " (마감)" : c.state === "scheduled" ? " (시작 전)" : ""}</option>)}</select><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="지급 사유 (필수)" className="rounded-xl border border-[#E4DDE9] bg-white px-3 py-2 text-xs outline-none focus:border-[#C46799]" /><button disabled={busy} onClick={grant} className="rounded-xl bg-[#3B2D47] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "지급 중..." : "쿠폰 지급"}</button>{message && <p className="text-xs text-[#B81D6E]">{message}</p>}</div>;
}

type ContextReading = {
  readingId: string;
  question: string;
  interpretation: string;
  createdAt: string;
  charged: boolean;
  flaggedForAbuse: boolean;
  spread: string | null;
};

function ReadingReviewModal({
  uid,
  reading,
  busy,
  onClose,
  onReview,
}: {
  uid: string;
  reading: ReviewReading;
  busy: boolean;
  onClose: () => void;
  onReview: () => void;
}) {
  const [context, setContext] = useState<ContextReading[] | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setContextLoading(true);
      setContext(null);
      const admin = auth.currentUser;
      if (!admin) { setContextLoading(false); return; }
      try {
        const token = await admin.getIdToken();
        const response = await fetch(
          `/api/admin/users/${encodeURIComponent(uid)}/rooms/${encodeURIComponent(reading.roomId)}/readings?before=${encodeURIComponent(reading.createdAt)}`,
          { headers: { authorization: `Bearer ${token}` } }
        );
        if (!response.ok || cancelled) return;
        const body = await response.json();
        if (!cancelled) setContext(body.readings);
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [uid, reading.roomId, reading.createdAt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#9A90A2]">{reading.roomTitle ?? "-"} · 이전 대화 맥락 포함(최대 20건)</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-sm text-[#9A90A2]">닫기</button>
        </div>

        <div className="mt-4 space-y-3">
          {contextLoading && <p className="text-xs text-[#A299AA]">불러오는 중...</p>}
          {context && context.map((r) => {
            const isTarget = r.readingId === reading.readingId;
            return (
              <div
                key={r.readingId}
                className={
                  isTarget
                    ? "rounded-xl border-2 border-[#C46799] bg-[#FCEBF3] p-3"
                    : "rounded-xl bg-[#FAF8FB] p-3"
                }
              >
                <p className="text-[11px] text-[#9A90A2]">
                  {shortDate(r.createdAt)}{r.spread ? ` · ${r.spread}` : ""}
                  {!r.charged && <span className="ml-1.5 rounded-full bg-[#FCEBF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#C02772]">무료</span>}
                  {r.flaggedForAbuse && <span className="ml-1.5 rounded-full bg-[#FFF2E7] px-1.5 py-0.5 text-[10px] font-semibold text-[#A55A19]">검토</span>}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#3A2F42]"><span className="font-semibold">Q.</span> {r.question || "(질문 없음)"}</p>
                {r.interpretation && (
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#665A70]"><span className="font-semibold">A.</span> {r.interpretation}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onReview} disabled={busy} className="rounded-full bg-[#3B2D47] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {busy ? "처리 중..." : "확인 처리"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserOverviewPanel({
  overview,
  uid,
  suspended,
  onUpdate,
}: {
  overview: UserOverview;
  uid: string;
  suspended: boolean;
  onUpdate: (uid: string, updater: (prev: UserOverview) => UserOverview) => void;
}) {
  const [modalReading, setModalReading] = useState<ReviewReading | null>(null);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewAllBusy, setReviewAllBusy] = useState(false);
  const [sajuRefundBusy, setSajuRefundBusy] = useState<string | null>(null);

  /** 사주 리포트 결제 환불 — 백엔드(`executeRefund` → `refundSajuReport`)는 이미 있고 여기가
   *  그 유일한 UI 다(2026-09-26). 사주는 이용권 문서가 없어 `HeldPassesPanel` 의 `refund(pass)`
   *  가 물려 있는 이용권 목록에 안 나타나므로, 같은 API 를 여기 "LIVE 결제 내역" 행에서 부른다.
   *
   *  확인 절차는 이용권 환불과 같은 무게로 맞춘다 — 사유를 `prompt` 로 받고 `confirm` 으로
   *  한 번 더 막는다. 실제로 돈이 나가는 동작이라 버튼 하나로 바로 실행되면 안 된다.
   *
   *  ⚠️ 7일 창(`executeRefund` 의 `isWithinRefundWindow`)이 사주에도 그대로 걸린다 — §9 의
   *  "아무것도 안 읽었는가" 경계가 아직 코드에 없어서다(2026-09-26 결정, 그대로 둔다). 7일이
   *  지난 건은 서버가 그 사유로 거절하고, 아래는 그 사유 문자열을 그대로 보여준다. */
  async function refundSajuPayment(payment: UserOverview["livePayments"][number]) {
    const admin = auth.currentUser;
    if (!admin) return;
    const reason = prompt("환불 사유를 입력하세요. (사용자에게 노출되지 않지만 기록에 남습니다)");
    if (!reason?.trim()) return;
    if (!confirm("결제를 실제로 취소하고 리포트를 잠급니다. 진행할까요?")) return;
    setSajuRefundBusy(payment.id);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/refund-payment`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ paymentId: payment.id, reason: reason.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(body.error ?? "환불에 실패했습니다.");
        return;
      }
      if (body.alreadyCancelled) {
        alert("포트원에서 이미 취소된 결제였습니다. 앱 기록만 맞췄습니다(추가 환불은 일어나지 않았습니다).");
      }
      onUpdate(uid, (prev) => ({
        ...prev,
        livePayments: prev.livePayments.map((p) => (p.id === payment.id ? { ...p, status: "refunded" } : p)),
      }));
    } finally {
      setSajuRefundBusy(null);
    }
  }

  async function reviewOne(reading: ReviewReading) {
    const admin = auth.currentUser;
    if (!admin) return;
    const key = `${reading.roomId}:${reading.readingId}`;
    setReviewBusy(key);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(uid)}/rooms/${encodeURIComponent(reading.roomId)}/readings/${encodeURIComponent(reading.readingId)}/review`,
        { method: "POST", headers: { authorization: `Bearer ${token}` } }
      );
      if (!response.ok) { alert((await response.json().catch(() => ({}))).error ?? "확인 처리에 실패했습니다."); return; }
      onUpdate(uid, (prev) => ({
        ...prev,
        reviewReadings: prev.reviewReadings.filter((r) => !(r.roomId === reading.roomId && r.readingId === reading.readingId)),
        reviewReadingsTotal: Math.max(0, prev.reviewReadingsTotal - 1),
      }));
      setModalReading(null);
    } finally {
      setReviewBusy(null);
    }
  }

  async function reviewAll() {
    const admin = auth.currentUser;
    if (!admin) return;
    if (!confirm("이 유저의 검토 필요 리딩을 전부 확인 처리할까요?")) return;
    setReviewAllBusy(true);
    try {
      const token = await admin.getIdToken();
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/flagged-readings/review-all`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) { alert((await response.json().catch(() => ({}))).error ?? "일괄 확인 처리에 실패했습니다."); return; }
      onUpdate(uid, (prev) => ({ ...prev, reviewReadings: [], reviewReadingsTotal: 0 }));
    } finally {
      setReviewAllBusy(false);
    }
  }

  return (
    <div className="rounded-[20px] border border-[#E7DFEC] bg-[#F8F5F9] p-4 shadow-inner shadow-[#E7DFEC]/30">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="flex h-full flex-col rounded-2xl border border-[#EEE8F1] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#45394F]">검토 필요 리딩</h3>
            <span className="rounded-full bg-[#F9EEF5] px-2.5 py-1 text-[11px] font-semibold text-[#B81D6E]">미확인 {overview.reviewReadingsTotal}건</span>
          </div>
          <p className="mt-1 text-xs text-[#8D8296]">무료 처리·프롬프트 해킹·부정/무관 요청만 표시 · 클릭하면 전문이 열립니다</p>
          {overview.reviewReadings.length > 0 && (
            <button onClick={reviewAll} disabled={reviewAllBusy} className="mt-2 self-start rounded-full border border-[#E4DDE9] bg-white px-3 py-1 text-[11px] font-semibold text-[#584D61] disabled:opacity-50">
              {reviewAllBusy ? "처리 중..." : "전부 확인 처리"}
            </button>
          )}
          {overview.reviewReadings.length === 0 ? (
            <p className="mt-4 text-xs text-[#A299AA]">검토가 필요한 리딩이 없습니다.</p>
          ) : (
            <ul className="mt-3 min-h-0 flex-1 divide-y divide-[#F0ECF2] overflow-y-auto">
              {overview.reviewReadings.map((reading) => (
                <li key={`${reading.roomId}:${reading.readingId}`}>
                  <button
                    type="button"
                    onClick={() => setModalReading(reading)}
                    className="w-full py-2.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-xs font-medium text-[#52435E]">{reading.question || "(질문 없음)"}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-[#FCEBF3] px-1.5 py-0.5 text-[10px] font-semibold text-[#C02772]">무료</span>
                        {reading.flaggedForAbuse && <span className="rounded-full bg-[#FFF2E7] px-1.5 py-0.5 text-[10px] font-semibold text-[#A55A19]">검토</span>}
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-[#9A90A2]">{reading.roomTitle ?? "-"} · {shortDate(reading.createdAt)}{reading.spread ? ` · ${reading.spread}` : ""}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex h-full flex-col rounded-2xl border border-[#EEE8F1] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#45394F]">LIVE 결제 내역</h3>
          {overview.livePayments.length === 0 ? <p className="mt-3 text-xs text-[#A299AA]">LIVE 결제가 없습니다.</p> : (
            <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto text-xs">
              {overview.livePayments.map((payment) => {
                // 사주 리포트는 이용권이 없어 HeldPassesPanel 의 환불 버튼이 안 닿는다 —
                // 여기가 유일한 실행 창구다(위 refundSajuPayment 주석 참고).
                const sajuRefundable = payment.productType === "sajuReport" && payment.status === "fulfilled";
                return (
                  <li key={payment.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF8FB] px-3 py-2">
                    <span className="truncate text-[#665A70]">{payment.orderName ?? payment.id}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-medium text-[#4B3D56]">{won(payment.priceWon)} · {paymentStatusLabel(payment.status)}</span>
                      {sajuRefundable && (
                        <button
                          type="button"
                          onClick={() => refundSajuPayment(payment)}
                          disabled={sajuRefundBusy === payment.id}
                          className="rounded-full border border-[#E4DDE9] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#B81D6E] disabled:opacity-50"
                        >
                          {sajuRefundBusy === payment.id ? "처리 중..." : "환불"}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <HeldPassesPanel uid={uid} purchasedPasses={overview.purchasedPasses} rewardPasses={overview.rewardPasses} onUpdate={onUpdate} />

        <section className="flex h-full flex-col rounded-2xl border border-[#EEE8F1] bg-white p-4">
          <h3 className="text-sm font-semibold text-[#45394F]">정지 이력</h3>
          {overview.suspensionLog.length === 0 ? <p className="mt-3 text-xs text-[#A299AA]">정지 이력이 없습니다.</p> : (
            <ul className="mt-3 min-h-0 flex-1 space-y-1.5 overflow-y-auto text-xs">
              {overview.suspensionLog.map((log) => <li key={log.id} className="rounded-lg bg-[#FAF8FB] px-3 py-2 text-[#665A70]"><span className="font-semibold">{log.action === "suspended" ? "정지" : "정지 해제"}</span>{log.reason ? ` · ${log.reason}` : ""}<p className="mt-1 text-[11px] text-[#9A90A2]">{shortDate(log.createdAt)}{log.action === "suspended" ? ` · ${log.durationDays ? `${log.durationDays}일 (해제 ${shortDate(log.suspendedUntil)})` : "영구"}` : ""}</p></li>)}
            </ul>
          )}
        </section>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">횟수제 이용권 지급</h3><p className="mt-1 text-xs text-[#8D8296]">자미두수 포함 조합은 태어난 시간이 등록된 사용자에게만 지급할 수 있습니다.</p></div><CountPassGrantControls uid={uid} /></section>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">시간제 이용권 지급</h3><p className="mt-1 text-xs text-[#8D8296]">12종 상품 중 선택해 지급합니다. 자미두수 포함 상품은 태어난 시간이 필요합니다.</p></div><TimePassGrantControls uid={uid} /></section>
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">할인쿠폰 지급</h3><p className="mt-1 text-xs text-[#8D8296]">발급된 쿠폰을 이 사용자 쿠폰함에 직접 넣습니다. 선착순이 마감됐어도 지급됩니다.</p></div><DiscountCouponGrantControls uid={uid} /></section>
      </div>
      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE8F1] bg-white p-4"><div><h3 className="text-sm font-semibold text-[#45394F]">계정 정지</h3><p className="mt-1 text-xs text-[#8D8296]">로그인·기록 열람은 유지되며, 리딩·결제·보상 수령만 제한됩니다.</p></div><SuspensionControls uid={uid} suspended={suspended} /></section>
      {modalReading && (
        <ReadingReviewModal
          uid={uid}
          reading={modalReading}
          busy={reviewBusy === `${modalReading.roomId}:${modalReading.readingId}`}
          onClose={() => setModalReading(null)}
          onReview={() => reviewOne(modalReading)}
        />
      )}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

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

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    if (!user || !searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const body = (await response.json().catch(() => ({}))) as PageData & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "검색에 실패했습니다.");
        return;
      }
      setEntries(body.users);
      setNextCursor(null);
      setSearchActive(true);
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchActive(false);
    setOpenUid(null);
    if (user) {
      setCursorStack([null]);
      loadPage(user, null);
    }
  }

  async function toggleOverview(uid: string) {
    if (openUid === uid) {
      setOpenUid(null);
      return;
    }
    setOpenUid(uid);
    if (!user) return;

    // 한 번 읽은 상세를 캐시에서 다시 꺼내 보여주면, 그 사이 사용자가 한 일이 화면에 없다.
    // 운영자가 리딩 전에 열어둔 목록에는 이용권이 "미사용"으로 남아 있는데 실제로는 사용중
    // (unused→active)이라, 회수를 눌러도 서버가 409 를 돌려줬다(2026-09-24). 열 때마다 다시
    // 읽는다. 이미 들고 있는 값이 있으면 스피너로 비우지 않고 그 값을 보여주면서 바꾼다.
    if (!overview[uid]) setOverviewLoading(uid);
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

  function updateOverview(uid: string, updater: (prev: UserOverview) => UserOverview) {
    setOverview((current) => {
      const prev = current[uid];
      if (!prev) return current;
      return { ...current, [uid]: updater(prev) };
    });
  }

  const liveSalesTotal = entries.reduce((total, entry) => total + entry.paymentTotalWon, 0);
  const refundedTotal = entries.reduce((total, entry) => total + entry.refundTotalWon, 0);
  const suspendedTotal = entries.filter((entry) => entry.status === "suspended").length;

  return (
    <main className="admin-page px-4 pb-10 text-[#1D1D1F] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <AdminPageHeader title="사용자" description="계정 상태, 결제와 보유 이용권을 한 흐름에서 확인합니다." />

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
              <p className="mt-1 text-sm text-[#817789]">
                {searchActive ? "검색 결과입니다." : "한 페이지에 100명씩 표시하며, 결제·환불 금액은 LIVE 결제만 집계합니다."}
              </p>
            </div>
            {!searchActive && <span className="rounded-full bg-[#F9EEF5] px-3 py-1.5 text-xs font-semibold text-[#B81D6E]">UID 순 정렬</span>}
          </div>

          <form onSubmit={runSearch} className="flex flex-wrap gap-2 border-b border-[#EEEAF1] px-5 py-4 sm:px-6">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="kakao:1234567 또는 닉네임 (정확히 일치해야 합니다)"
              className="min-w-[240px] flex-1 rounded-xl border border-[#DED7E4] px-3 py-2 text-sm outline-none focus:border-[#B291BE]"
            />
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="rounded-xl bg-[#3B2D47] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {searching ? "검색 중..." : "검색"}
            </button>
            {searchActive && (
              <button
                type="button"
                onClick={clearSearch}
                className="rounded-xl border border-[#DED7E4] bg-white px-4 py-2 text-sm font-medium text-[#584D61]"
              >
                검색 초기화
              </button>
            )}
          </form>

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
                <tr key={entry.uid} className={`transition-colors hover:bg-[#FCF9FC] ${openUid === entry.uid ? "bg-[#FCF9FC]" : ""}`}>
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
                    {entry.suspendedAt && <p className="mt-1.5 text-[11px] text-[#93899A]">정지 {shortDate(entry.suspendedAt)}{entry.suspendedUntil ? ` · 해제 ${shortDate(entry.suspendedUntil)}` : " · 영구"}</p>}
                  </td>
                  <td className="px-4 py-4 text-right font-medium tabular-nums text-[#342B3D]">{won(entry.paymentTotalWon)}</td>
                  <td className="px-4 py-4 text-right tabular-nums text-[#817789]">{won(entry.refundTotalWon)}</td>
                  <td className="px-4 py-4 text-[#584D61]">보유 {entry.countPasses.held}개{entry.countPasses.active ? <span className="ml-1.5 text-xs text-[#B81D6E]">사용 중 {entry.countPasses.active}</span> : null}</td>
                  <td className="px-4 py-4 text-[#584D61]">보유 {entry.timePasses.held}개{entry.timePasses.active ? <span className="ml-1.5 text-xs text-[#B81D6E]">사용 중 {entry.timePasses.active}</span> : null}</td>
                  <td className="px-4 py-4 text-[#584D61]">{entry.bonusRewardPasses}개</td>
                  <td className="px-6 py-4 text-[#584D61]">{entry.friendInvitePasses}개</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
          </div>
          {/* 상세 패널은 가로 스크롤 테이블 밖(폭 제약 없는 영역)에 둔다 — 테이블 셀 안에 두면
              min-w-[1300px] 제약을 그대로 물려받아 모바일에서 패널 내부 반응형 그리드가 못 펼쳐짐. */}
          {openUid && (() => {
            const entry = entries.find((e) => e.uid === openUid);
            if (!entry) return null;
            return (
              <div className="border-t border-[#EEEAF1] bg-[#FCF9FC] px-4 pb-6 pt-4 sm:px-6">
                {overviewLoading === openUid ? (
                  <div className="rounded-2xl border border-[#ECE4F0] bg-white px-4 py-8 text-center text-sm text-[#93899A]">상세 정보를 불러오는 중...</div>
                ) : overview[openUid] ? (
                  <UserOverviewPanel overview={overview[openUid]} uid={openUid} suspended={entry.status === "suspended"} onUpdate={updateOverview} />
                ) : null}
              </div>
            );
          })()}
        </section>

        {!searchActive && <nav className="flex items-center justify-between px-1" aria-label="사용자 목록 페이지">
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
        </nav>}
      </div>
    </main>
  );
}
