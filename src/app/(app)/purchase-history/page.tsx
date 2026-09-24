"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/util/formatDate";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import { REFUND_PROCESSING_BUSINESS_DAYS } from "@/lib/payment/refundPolicy";
import { CloseIcon } from "@/app/(app)/tarot/icons";
import InfoModal from "@/components/InfoModal";

type PurchaseEntry = {
  paymentId: string;
  productName: string;
  priceWon: number;
  paidAt: string;
  refunded: boolean;
  badge: string;
  refundable: boolean;
  /** 구입한 옵션("타로 전용" 등). 조합 개념이 없던 시절 이용권은 null. */
  combo: string | null;
  /** 환불이 거절된 경우의 사유. 왜 막혔는지 모르면 같은 사유로 다시 넣게 된다. */
  rejectionReason: string | null;
};

/** 피그마 "Screen / PurchaseHistory" — 실제 결제(users/{uid}/payments) 내역을 보여준다.
 * 미사용 이용권만(구매 후 7일 이내) "환불하기" 링크가 뜨고, 누르면 환불 요청 확인 모달
 * (피그마 "PurchaseHistoryRefund")을 거쳐 POST /api/user/refund-requests로 접수된다. */
export default function PurchaseHistoryPage() {
  const [entries, setEntries] = useState<PurchaseEntry[] | null>(null);
  const [selected, setSelected] = useState<PurchaseEntry | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 예전엔 브라우저 alert() 였다 — 앱 안의 다른 안내와 생김새가 전혀 달랐고, 모바일에서는
  // 도메인이 같이 뜬다. 성공·실패 모두 같은 자리에 같은 모양으로 띄운다.
  const [notice, setNotice] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) return;
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/purchase-history", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    });
  }, []);

  async function requestRefund() {
    const user = auth.currentUser;
    if (!user || !selected || !reason.trim()) return;
    setSubmitting(true);
    const response = await fetch("/api/user/refund-requests", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" }, body: JSON.stringify({ paymentId: selected.paymentId, reason }) });
    setSubmitting(false);
    if (!response.ok) {
      setNotice({ message: (await response.json()).error ?? "환불 요청에 실패했어요.", tone: "error" });
      return;
    }
    // 접수되면 이용권이 즉시 잠기므로(refund_pending) 배지도 그 자리에서 바꿔 준다 — 새로
      // 불러오지 않아도 화면이 서버 상태와 맞는다.
    setEntries((items) => items?.map((item) => item.paymentId === selected.paymentId
      ? { ...item, refundable: false, badge: "환불 대기 중" }
      : item) ?? items);
    setSelected(null); setReason("");
    setNotice({
      message: `환불 요청이 접수되었어요.
${REFUND_PROCESSING_BUSINESS_DAYS}영업일 내에 환불됩니다.`,
      tone: "info",
    });
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="결제 내역" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        {entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center pt-8">
            <p className="text-center text-sm text-icon-muted">
              아직 결제 내역이 없어요.
              <br />
              이용권을 구입하면 여기에 표시돼요.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {entries.map((e) => (
              <div key={e.paymentId} className="flex flex-col gap-1.5">
                <p className="px-1 text-sm text-icon-muted">{formatDateTime(e.paidAt)}</p>
                <div className="rounded-[28px] border border-border bg-topbar p-4">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${e.refunded ? "text-urgent" : "text-icon-muted"}`}>
                      {e.refunded ? "[결제 취소]" : "[결제 완료]"}
                    </p>
                    {e.refundable && (
                      <button onClick={() => setSelected(e)} className="text-sm font-semibold text-point-text underline">
                        환불하기
                      </button>
                    )}
                  </div>
                  {/* 목업 실측(sharp, 2026-09-21): 상품명 잉크 높이가 상단바 제목("결제 내역",
                      SubPageTopBar의 text-xl)과 18px로 동일해 text-base가 아니라 text-xl이다. */}
                  <p
                    className={`mt-1 text-xl font-bold text-bold-text ${e.refunded ? "line-through" : ""}`}
                  >
                    {e.productName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-icon-muted">{e.priceWon.toLocaleString("ko-KR")}원</span>
                    {/* 어떤 옵션으로 산 이용권인지 — 특히 횟수제는 이 값이 무엇을 쓸 수 있는지를
                        결정하는데 내역에 전혀 안 나와 있었다(2026-09-24 사용자 지적). 상품명
                        줄(실측으로 크기를 맞춘 text-xl)을 건드리지 않으려고 금액 옆에 둔다. */}
                    {e.combo && (
                      <span className="rounded-full bg-border px-2 py-0.5 text-xs font-semibold text-icon-muted">
                        {e.combo}
                      </span>
                    )}
                    {/* 초록 배지는 "아직 환불할 수 있다"는 신호다 — 라벨이 "미사용"이라도
                        환불 기간(7일)이 지났으면 환불이 불가능하므로 회색으로 내린다.
                        같은 조건으로 위의 "환불하기" 링크도 같이 사라진다. */}
                    {/* 거절 사유는 배지 옆이 아니라 아래 줄에 둔다 — 문장이라 길다. */}
                    {e.badge && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          e.refundable ? "bg-success text-success-text" : "bg-chip-fill text-white"
                        }`}
                      >
                        {e.badge}
                      </span>
                    )}
                  </div>
                  {e.rejectionReason && (
                    <p className="mt-2 text-sm text-urgent">환불 거절 사유: {e.rejectionReason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {notice && (
        <InfoModal title={notice.message} tone={notice.tone} onClose={() => setNotice(null)} />
      )}
      {selected && (
        <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div className="w-5" />
              <p className="flex-1 text-center text-lg font-bold text-bold-text">환불하기</p>
              <button type="button" onClick={() => setSelected(null)} aria-label="닫기" className="text-bold-text">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="whitespace-pre-line text-center text-sm font-semibold text-icon-muted">
              {`해당 이용권을 환불하시겠어요?\n신청한 날짜로부터 ${REFUND_PROCESSING_BUSINESS_DAYS}영업일 내에 환불됩니다.`}
            </p>
            <p className="mb-5 mt-3 text-center text-base font-bold text-bold-text">{selected.productName}</p>
            <label className="mb-7 flex flex-col gap-1">
              <span className="text-sm font-semibold text-icon-muted">환불 사유</span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="환불 사유를 입력해주세요"
                className="h-12 rounded-2xl border border-border bg-bg px-3 text-sm font-semibold text-bold-text outline-none placeholder-placeholder"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="h-12 flex-1 rounded-2xl bg-chip-fill text-base font-semibold text-white"
              >
                취소
              </button>
              <button
                type="button"
                disabled={submitting || !reason.trim()}
                onClick={requestRefund}
                className="h-12 flex-1 rounded-2xl bg-urgent text-base font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "요청 중..." : "환불하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
