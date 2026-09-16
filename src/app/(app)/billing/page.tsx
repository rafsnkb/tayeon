"use client";

import { useEffect, useState } from "react";
import PortOne, { BillingKeyMethod } from "@portone/browser-sdk/v2";
import SubPageTopBar from "@/components/SubPageTopBar";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { buildPortoneCustomer } from "@/lib/payment/customer";

type BillingKeyEntry = {
  id: string;
  cardLabel: string | null;
  maskedNumber: string | null;
  issuedAt: string | null;
};

// ⚠️ 자동충전(빌링키) 스켈레톤 페이지 — 잔액이 떨어지면 저장된 카드로 자동 충전하는 기능이며,
// 정기 구독(캘린더 기준 반복 결제)과는 다르다. 구체적인 트리거 조건(임계값 등)은 아직 확정되지
// 않았다. "카드 등록(빌링키 발급) → 저장 → (예시) 즉시 결제 실행"까지의 뼈대만 제공한다. 실제
// 자동충전 트리거가 정해지면 아래 "테스트 결제" 버튼 자리에 자동충전 설정 UI가 들어가야 한다
// (서버 쪽 실행 로직은 src/lib/payment/billing.ts의 chargeBillingKey() 참고).
export default function BillingPage() {
  const { user, email, nickname } = useRooms();
  const [keys, setKeys] = useState<BillingKeyEntry[] | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);

  async function loadKeys(idToken: string) {
    const res = await fetch("/api/billing/issue", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      setKeys(data.billingKeys);
    }
  }

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(loadKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleIssue() {
    if (!user || issuing) return;
    setIssuing(true);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();

      // 1. 결제창을 통해 빌링키 발급 — 카드번호는 우리 서버를 거치지 않고 PG사로 직접 전달된다.
      const issueResponse = await PortOne.requestIssueBillingKey({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY!,
        billingKeyMethod: BillingKeyMethod.CARD,
        customer: {
          // customerId를 uid로 넘겨야 서버가 발급 완료된 빌링키의 소유자를 확인할 수 있다
          // (src/app/api/billing/issue/route.ts). 나머지 필드는 /charge와 공유하는 헬퍼 —
          // KG이니시스는 빌링키 발급 시에도 email/phoneNumber/fullName이 필수(2026-09-15).
          customerId: user.uid,
          ...buildPortoneCustomer({ uid: user.uid, email, nickname }),
        },
      });
      if (!issueResponse) {
        // redirectUrl 지정 시에만 undefined가 반환된다(리디렉션 방식) — 이 페이지는 사용하지 않음.
        setNotice({ type: "error", message: "카드 등록 응답을 받지 못했어요." });
        return;
      }
      if (issueResponse.code !== undefined) {
        setNotice({ type: "error", message: issueResponse.message ?? "카드 등록이 취소됐어요." });
        return;
      }

      // 2. 발급된 빌링키를 서버로 전달해 저장(서버가 재검증 후 저장).
      const saveRes = await fetch("/api/billing/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ billingKey: issueResponse.billingKey }),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setNotice({ type: "error", message: data.error ?? "카드 저장에 실패했어요." });
        return;
      }

      setNotice({ type: "info", message: "카드가 등록됐어요." });
      await loadKeys(idToken);
    } catch (error) {
      console.error("[billing] 카드 등록 실패", error);
      setNotice({ type: "error", message: "카드 등록 중 오류가 발생했어요." });
    } finally {
      setIssuing(false);
    }
  }

  // 저장된 빌링키로 결제를 실행하는 예시 — 실제 구독 상품이 생기기 전까지는 고정 금액(1,000원)
  // 테스트 결제로만 쓴다.
  async function handleTestCharge(billingKeyId: string) {
    if (!user || chargingId) return;
    setChargingId(billingKeyId);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/billing/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ billingKeyId, amountWon: 1000, orderName: "빌링키 테스트 결제" }),
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ type: "info", message: "테스트 결제(1,000원)가 완료됐어요." });
      } else {
        setNotice({ type: "error", message: data.error ?? "결제에 실패했어요." });
      }
    } catch (error) {
      console.error("[billing] 테스트 결제 실패", error);
      setNotice({ type: "error", message: "결제 중 오류가 발생했어요." });
    } finally {
      setChargingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="자동충전 카드 관리" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <p className="rounded-2xl border border-border bg-topbar p-3 text-xs text-icon-muted">
            자동충전 기능은 아직 준비 중이에요. 이 화면은 카드 등록과 빌링키 결제 흐름을
            미리 확인하기 위한 테스트 화면입니다.
          </p>

          {notice && (
            <div
              className={`rounded-2xl border p-3 text-center text-sm ${
                notice.type === "error"
                  ? "border-urgent bg-urgent/10 text-urgent"
                  : "border-point bg-point-bg text-point"
              }`}
            >
              {notice.message}
            </div>
          )}

          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="rounded-full bg-point px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {issuing ? "등록 중..." : "카드 등록하기"}
          </button>

          {keys === null ? (
            <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
          ) : keys.length === 0 ? (
            <p className="pt-8 text-center text-sm text-icon-muted">등록된 카드가 없어요.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-[28px] border border-border bg-topbar p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-bold-text">
                      {k.cardLabel ?? "등록된 카드"}
                    </p>
                    <p className="truncate text-sm text-icon-muted">{k.maskedNumber ?? ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestCharge(k.id)}
                    disabled={chargingId !== null}
                    className="shrink-0 rounded-full bg-point px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {chargingId === k.id ? "결제 중..." : "테스트 결제 1,000원"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
