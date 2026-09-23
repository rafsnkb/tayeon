// 결제 지급(코인 증가 / 시간제 이용권 발급)의 유일한 진입점.
//
// /api/payment/complete(결제창 콜백)과 /api/payment/webhook(포트원 웹훅) 양쪽이 이 함수를
// 그대로 재사용한다 — 콜백이 브라우저 종료 등으로 유실돼도 웹훅이 같은 로직으로 다시 시도하고,
// 반대로 웹훅이 먼저 도착해도 콜백이 중복 지급하지 않도록 users/{uid}/payments/{paymentId}
// 문서를 멱등성 키로 쓴다(트랜잭션 안에서 문서가 이미 있으면 스킵).
//
// 절대 클라이언트가 보낸 금액/상품 정보를 신뢰하지 않는다 — paymentId로 포트원 결제내역을
// 직접 조회해서 실제 상태·금액·customData(uid, productId)만 근거로 지급한다.
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { portone } from "@/lib/payment/portone";
import { validatePaidPayment } from "@/lib/payment/validatePayment";
import { addMonthsClamped } from "@/lib/util/dateMath";
import {
  COUNT_PASS_VALIDITY_MONTHS,
  TIME_PASS_VALIDITY_MONTHS,
  countAllowancesForCombo,
} from "@/lib/tarot/pricing";
import { USERS, PAYMENTS, TIME_PASSES, COUNT_PASSES } from "@/lib/firestore/collections";

/** 운영자가 환불을 검토할 때 필요한 결제수단만 보관한다. 카드 전체 번호·계좌번호는 저장하지 않는다. */
function paymentMethodSummary(method: unknown): { type: string; label: string } | null {
  if (!method || typeof method !== "object") return null;
  const value = method as { type?: unknown; provider?: unknown; card?: { name?: unknown; number?: unknown; issuer?: unknown } };
  const type = typeof value.type === "string" ? value.type : "unknown";
  if (type === "PaymentMethodCard") {
    const cardName = typeof value.card?.name === "string" ? value.card.name : typeof value.card?.issuer === "string" ? value.card.issuer : "신용/체크카드";
    const number = typeof value.card?.number === "string" ? ` ${value.card.number}` : "";
    return { type, label: `${cardName}${number}` };
  }
  if (type === "PaymentMethodEasyPay") return { type, label: typeof value.provider === "string" ? value.provider : "간편결제" };
  const labels: Record<string, string> = { PaymentMethodTransfer: "계좌이체", PaymentMethodVirtualAccount: "가상계좌", PaymentMethodMobile: "휴대폰 결제", PaymentMethodGiftCertificate: "상품권", PaymentMethodConvenienceStore: "편의점 결제" };
  return { type, label: labels[type] ?? "기타 결제수단" };
}

export type FulfillOutcome =
  | { kind: "fulfilled"; alreadyFulfilled: boolean; uid: string; productType: "coin" | "countPass" | "timePass" }
  | { kind: "not_paid"; status: string }
  /** 이미 같은 종류의 이용권을 보유 중이라 지급하지 않고 결제를 자동 취소한 경우. */
  | { kind: "duplicate_cancelled"; uid: string; cancelled: boolean }
  | { kind: "rejected"; reason: string };

/**
 * @param paymentId 포트원 결제 건 아이디(고객사 채번)
 * @param expectedUid 지정하면 customData.uid가 이 값과 다를 때 거부한다(로그인한 유저 본인의
 *   결제인지 확인하는 용도 — /api/payment/complete에서 사용). 웹훅에는 요청자 uid가 없으므로
 *   생략한다.
 * @param via 로그/감사용으로만 기록하는 호출 경로 구분자.
 */
export async function fulfillPayment(
  paymentId: string,
  expectedUid?: string,
  via: "complete" | "webhook" = "complete"
): Promise<FulfillOutcome> {
  const payment = await portone.getPayment({ paymentId }).catch((error) => {
    console.error("[payment] getPayment 실패", paymentId, error);
    return null;
  });
  if (!payment) {
    return { kind: "rejected", reason: "결제 정보를 조회하지 못했어요." };
  }

  // 이 검사는 validatePaidPayment 안에도 같은 내용으로 들어 있다. 중복이지만 지우면 안 된다 —
  // 포트원 SDK 의 Payment 는 status 로 갈리는 유니온이라, 여기서 한 번 좁혀 주지 않으면
  // 아래에서 payment.orderName / channel / method / paidAt 에 접근할 수 없다. 두 곳이 같은
  // 결과를 내는 것은 타입으로 보장된다(둘 다 not_paid).
  if (payment.status !== "PAID") {
    return { kind: "not_paid", status: String(payment.status) };
  }

  const checked = validatePaidPayment(payment, {
    expectedUid,
    isProduction: process.env.NODE_ENV === "production",
    legacyCoinPaidBefore: process.env.LEGACY_COIN_PAID_BEFORE,
  });
  if (!checked.ok) {
    // 로그는 순수 함수 밖에서 찍는다 — 판정 자체는 validatePayment.ts 가, 관측은 여기가 맡는다.
    if (checked.log) console.error(`[payment] ${checked.log.message}`, paymentId, checked.log.detail ?? "");
    return checked.outcome;
  }
  const { uid, product, combo } = checked;

  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentRef = userRef.collection(PAYMENTS).doc(paymentId);

  const outcome = await adminDb.runTransaction(async (tx): Promise<"already" | "duplicate" | "granted"> => {
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists) {
      // 멱등성: 콜백/웹훅 중 먼저 도착한 쪽이 이미 처리했다면 스킵.
      return "already";
    }

    // 약관상 구매한 횟수제ㆍ시간제 이용권은 각각 1개까지만 보유할 수 있다. prepare에서 한 번
    // 막지만 그건 결제창을 열기 "전"의 검사라, 결제창을 두 개 띄워두면 둘 다 통과한다. 지급
    // 직전에 트랜잭션 안에서 다시 확인해야 실제로 1개가 보장된다.
    // (이 결제로 만들어질 이용권은 아직 없으므로 paymentId로 자기 자신을 걸러낼 필요는 없지만,
    //  웹훅 재시도로 이 지점에 다시 오는 경우는 위 멱등성 검사에서 이미 걸러진다.)
    const heldCollection =
      product.type === "countPass" ? COUNT_PASSES : product.type === "timePass" ? TIME_PASSES : null;
    if (heldCollection) {
      const heldSnap = await tx.get(
        userRef.collection(heldCollection).where("status", "in", ["unused", "active", "refund_pending"])
      );
      const conflict = heldSnap.docs.some((doc) => {
        const data = doc.data();
        // 리워드로 받은 횟수제 이용권은 여러 개 보유가 정상이라 구매분만 본다(시간제는 구매분뿐).
        return product.type === "countPass" ? data.source === "purchase" : true;
      });
      if (conflict) {
        console.error("[payment] 보유 제한 위반 — 지급하지 않고 결제를 취소한다", paymentId, product.type);
        tx.set(paymentRef, {
          status: "duplicate_cancelled",
          productId: product.productId,
          productType: product.type,
          priceWon: product.priceWon,
          orderName: payment.orderName,
          channelType: payment.channel?.type ?? null,
          isTest: payment.channel?.type === "TEST",
          paymentMethod: paymentMethodSummary(payment.method),
          paidAt: payment.paidAt,
          blockedAt: new Date().toISOString(),
          blockedReason: "이미 같은 종류의 이용권을 보유 중이어서 지급하지 않음",
          blockedVia: via,
        });
        return "duplicate";
      }
    }

    const timePassRef = product.type === "timePass" ? userRef.collection(TIME_PASSES).doc() : null;
    const countPassRef = product.type === "countPass" ? userRef.collection(COUNT_PASSES).doc() : null;
    const issuedAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    const countPassExpiresAt = addMonthsClamped(issuedAt.toISOString(), COUNT_PASS_VALIDITY_MONTHS);
    const timePassUsableUntil = addMonthsClamped(issuedAt.toISOString(), TIME_PASS_VALIDITY_MONTHS);

    tx.set(paymentRef, {
      status: "fulfilled",
      productId: product.productId,
      productType: product.type,
      priceWon: product.priceWon,
      orderName: payment.orderName,
      coins: product.type === "coin" ? product.coins : null,
      countPassId: countPassRef?.id ?? null,
      countBasis: product.type === "countPass" ? product.basis : null,
      timePassId: timePassRef?.id ?? null,
      channelType: payment.channel?.type ?? null,
      isTest: payment.channel?.type === "TEST",
      paymentMethod: paymentMethodSummary(payment.method),
      paidAt: payment.paidAt,
      fulfilledAt: new Date().toISOString(),
      fulfilledVia: via,
    });

    if (product.type === "coin") {
      tx.set(userRef, { coins: FieldValue.increment(product.coins) }, { merge: true });
    } else if (product.type === "countPass" && countPassRef && combo) {
      tx.set(countPassRef, {
        productId: product.productId,
        source: "purchase",
        basis: product.basis,
        remaining: 1,
        usedCount: 0,
        combo,
        allowances: countAllowancesForCombo(product.basis, combo),
        status: "unused",
        priceWon: product.priceWon,
        paymentId,
        createdAt: issuedAt.toISOString(),
        expiresAt: countPassExpiresAt,
      });
    } else if (product.type === "timePass" && timePassRef) {
      tx.set(timePassRef, {
        productId: product.productId,
        minutes: product.minutes,
        combo: product.combo,
        priceWon: product.priceWon,
        status: "unused",
        startedAt: null,
        expiresAt: null,
        usableUntil: timePassUsableUntil,
        paymentId,
        createdAt: new Date().toISOString(),
      });
    }

    return "granted";
  });

  if (outcome === "duplicate") {
    // 돈은 이미 승인된 상태라 거절만 하면 "결제했는데 아무것도 못 받는" 상태가 된다. 자동으로
    // 취소해서 환불까지 끝낸다. 취소가 실패하면 로그만 남기고 운영자가 수동 환불하도록 둔다.
    const cancelled = await portone
      .cancelPayment({ paymentId, reason: "이용권 보유 제한(1개)으로 지급 불가 — 자동 취소" })
      .then(() => true)
      .catch((error) => {
        console.error("[payment] 보유 제한 자동 취소 실패 — 수동 환불 필요", paymentId, error);
        return false;
      });
    return { kind: "duplicate_cancelled", uid, cancelled };
  }

  return { kind: "fulfilled", alreadyFulfilled: outcome === "already", uid, productType: product.type };
}
