"use client";

// 운세 리포트 한 편을 실제로 **사는** 경로. 화면(`FortuneDetailScreen`)은 값만 모으고, 돈이
// 움직이는 일은 전부 여기 있다.
//
// ## 네 걸음이고, 마지막 하나가 다르다
//
//   1. `POST /api/payment/prepare`   금액·주문명을 **서버가** 정한다(클라이언트가 못 정한다)
//   2. `PortOne.requestPayment`      결제창
//   3. `POST /api/payment/complete`  서버가 포트원에 다시 물어 검증하고 주문을 `paid` 로 올린다
//   4. `POST /api/saju/orders/{id}/open`  계산 + 골격(약 29초) → 리포트가 생긴다
//
// 앞의 셋은 이용권 구입(`charge/page.tsx`)과 **같은 경로를 그대로 쓴다.** 사주 전용 결제
// 엔드포인트를 따로 두지 않기로 한 이유가 `purchase.ts` 끝에 적혀 있다 — 금액 대조와 멱등성이
// 두 벌이 되면 갈라진 뒤 한쪽만 고쳐지는 날이 오고, 그때 증상은 이중 지급이나 미지급이다.
//
// **4번이 이 흐름에만 있다.** 이용권은 결제가 끝나면 지급까지 끝이지만, 리포트는 거기서
// 29초짜리 계산·골격이 더 돌아야 읽을 것이 생긴다. 그걸 결제 웹훅에 붙이지 않은 이유(타임아웃
// 재시도 → 이중 이행)는 `api/saju/orders/[paymentId]/open/route.ts` 머리말에 있다.
//
// ## 3번이 끝난 뒤에는 되돌릴 수 없다
//
// **결제는 이미 됐다.** 그래서 4번이 실패해도 "결제 실패"라고 말하면 안 된다 — 사용자는 돈이
// 안 나갔다고 읽고 다시 결제한다. 4번은 멱등하므로(같은 주문은 리포트 하나) 다시 눌러도
// 안전하고, 화면은 **다시 시도할 수 있는 상태**로 남아야 한다. 그래서 실패 메시지에 주문
// 번호를 들고 다닌다(`retryOpen`).
import { useState } from "react";
import { useRouter } from "next/navigation";
import PortOne, { PaymentPayMethod } from "@portone/browser-sdk/v2";
import { buildPortoneCustomer } from "@/lib/payment/customer";
import { useRooms } from "@/lib/tarot/RoomsContext";
import { sajuProductId } from "@/lib/saju/purchase";
import { parseSuspensionError, type SuspensionInfo } from "@/components/SuspensionModal";
import type { FortunePurchaseRequest } from "./purchaseRequest";

/** 화면에 보여줄 진행 단계. `null` 이면 아무것도 안 하고 있다.
 *
 *  단계를 나눈 이유는 문구가 아니라 **대기 시간**이다. `paying` 은 사용자가 결제창을 보는
 *  동안이고, `opening` 은 29초짜리 계산이다 — 같은 "처리 중"으로 뭉뚱그리면 29초 동안
 *  멈춘 것처럼 보인다. */
export type PurchasePhase = "preparing" | "paying" | "completing" | "opening";

export type PurchaseError = {
  message: string;
  /** 4번에서 실패했다 — **결제는 끝났다.** 화면은 "결제 실패"가 아니라 "다시 열기"를 줘야 한다. */
  retryOpenPaymentId?: string;
};

export function useFortunePurchase() {
  const router = useRouter();
  const { user, email, nickname, refreshMe } = useRooms();
  const [phase, setPhase] = useState<PurchasePhase | null>(null);
  const [error, setError] = useState<PurchaseError | null>(null);
  const [suspension, setSuspension] = useState<SuspensionInfo | null>(null);

  /**
   * 4번만 따로. 결제가 끝난 뒤 실패했을 때 다시 부르는 자리이고, 첫 시도도 이걸 쓴다 —
   * 경로가 하나여야 "다시 시도"가 처음과 정말 같은 일을 한다.
   */
  async function open(paymentId: string, idToken: string): Promise<boolean> {
    setPhase("opening");
    const res = await fetch(`/api/saju/orders/${paymentId}/open`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const body = (await res.json().catch(() => ({}))) as { readingId?: string; error?: string };

    if (res.ok && body.readingId) {
      await refreshMe();
      // `replace` 다. 뒤로 가기가 구매 화면으로 돌아가면 **이미 산 것을 다시 사는 화면**이다.
      router.replace(`/fortune/readings/${body.readingId}`);
      return true;
    }

    // 열 수 없어서 **서버가 환불했다**(§9 — 계산 실패·골격 실패, 사용자는 아직 아무것도 읽지
    // 않았다). 다시 시도할 일이 아니다.
    if (body.error === "refunded") {
      setError({ message: "리포트를 만들지 못해 결제를 취소했어요. 잠시 후 다시 시도해주세요." });
      return false;
    }
    if (body.error === "refund_pending") {
      setError({ message: "리포트를 만들지 못했어요. 환불이 지연되고 있어 확인 중입니다 — 고객센터로 문의해주세요." });
      return false;
    }

    setError({
      message: "결제는 완료됐는데 리포트를 여는 중에 문제가 생겼어요. 다시 시도해주세요.",
      retryOpenPaymentId: paymentId,
    });
    return false;
  }

  async function retryOpen(paymentId: string) {
    if (!user || phase) return;
    setError(null);
    try {
      await open(paymentId, await user.getIdToken());
    } catch {
      setError({ message: "잠시 후 다시 시도해주세요.", retryOpenPaymentId: paymentId });
    } finally {
      setPhase(null);
    }
  }

  async function purchase(request: FortunePurchaseRequest) {
    if (!user || phase) return;
    setError(null);
    setPhase("preparing");
    try {
      const idToken = await user.getIdToken();

      const prepareRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          // 결제 식별자는 **서버 규칙(`sajuProductId`)을 그대로 쓴다.** 문자열을 여기서 손으로
          // 조립하면 서버의 `parseSajuProductId` 와 어긋나는 날이 오고, 증상은 "존재하지 않는
          // 상품이에요"다.
          productId: sajuProductId(request.slug, request.mode),
          userInput: request.userInput,
          consent: request.consent,
          // 상대 정보는 이 화면에서 고칠 수 있어서(목업의 「변경 가능」) 몸체로 보낸다. 안 보내면
          // 서버가 저장된 프로필로 떨어지고, 그러면 **사용자가 본 것과 다른 사람**으로 나간다.
          ...(request.partner ? { partner: request.partner } : {}),
          // 쿠폰은 아직 이 화면에 선택 UI 가 없다 — 보내지 않으면 서버가 가장 유리한 것을
          // 자동으로 고른다(`pickBestCoupon`). 선택 UI 가 붙으면 `couponCode` 를 여기 얹는다.
          useCoupon: true,
        }),
      });

      if (!prepareRes.ok) {
        const failed = (await prepareRes.json().catch(() => ({}))) as { error?: string };
        const suspended = parseSuspensionError(failed);
        if (suspended) return setSuspension(suspended);
        return setError({ message: failed.error ?? "결제 준비에 실패했어요. 잠시 후 다시 시도해주세요." });
      }
      const prepared = await prepareRes.json();

      setPhase("paying");
      const payment = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.totalAmount,
        currency: prepared.currency,
        payMethod: PaymentPayMethod.CARD,
        customData: prepared.customData,
        customer: buildPortoneCustomer({ uid: user.uid, email, nickname }),
      });
      if (!payment) return setError({ message: "결제 응답을 받지 못했어요." });
      if (payment.code !== undefined) {
        // 결제창을 닫았거나 PG 에서 실패했다 — 아직 아무것도 지급되지 않았다.
        return setError({ message: payment.message ?? "결제가 취소됐어요." });
      }

      setPhase("completing");
      const completeRes = await fetch("/api/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ paymentId: payment.paymentId }),
      });
      const completed = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok || completed.status !== "PAID") {
        return setError({ message: completed.error ?? "결제 확인에 실패했어요. 고객센터로 문의해주세요." });
      }

      await open(payment.paymentId, idToken);
    } catch (error) {
      console.error("[fortune] 구매 실패", error);
      setError({ message: "결제 중 오류가 발생했어요." });
    } finally {
      setPhase(null);
    }
  }

  return {
    phase,
    error,
    suspension,
    purchase,
    retryOpen,
    dismissError: () => setError(null),
    dismissSuspension: () => setSuspension(null),
  };
}
