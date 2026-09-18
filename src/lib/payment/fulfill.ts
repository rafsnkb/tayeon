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
import { resolvePaidProduct } from "@/lib/payment/products";
import { addMonthsClamped } from "@/lib/util/dateMath";
import {
  COUNT_PASS_VALIDITY_MONTHS,
  TIME_PASS_VALIDITY_MONTHS,
  COMBOS,
  countAllowancesForCombo,
  type ComboKey,
} from "@/lib/tarot/pricing";

function isComboKey(value: unknown): value is ComboKey {
  return typeof value === "string" && value in COMBOS;
}

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

  if (payment.status !== "PAID") {
    return { kind: "not_paid", status: String(payment.status) };
  }

  // 프로덕션에서는 TEST 채널 결제(실제 카드 승인 없이 항상 성공하는 테스트 카드)로 지급되는 걸
  // 막는다 — 지금은 KG이니시스 실채널이 없어서 TEST 채널만 존재하니 로컬/개발 환경에서는 그대로
  // 통과시키고, 실제 배포(NODE_ENV=production)에서만 LIVE 채널이 아니면 거부한다. 실계약 승인 후
  // NEXT_PUBLIC_PORTONE_CHANNEL_KEY를 LIVE 채널로 교체하면 이 체크가 자연히 정상 통과된다
  // (2026-09-15, 검증 에이전트 지적 — 프로덕션 채널키가 실수로 TEST로 남아있어도 무료로 코인이
  // 지급되는 사고를 막기 위한 안전장치).
  if (process.env.NODE_ENV === "production" && payment.channel?.type !== "LIVE") {
    console.error("[payment] 프로덕션에서 LIVE 채널이 아닌 결제", {
      paymentId,
      channelType: payment.channel?.type,
    });
    return { kind: "rejected", reason: "테스트 채널 결제는 프로덕션에서 지급되지 않아요." };
  }

  let customData: { uid?: unknown; productId?: unknown; combo?: unknown } = {};
  try {
    customData = payment.customData ? JSON.parse(payment.customData) : {};
  } catch (error) {
    console.error("[payment] customData 파싱 실패", paymentId, error);
    return { kind: "rejected", reason: "customData를 해석하지 못했어요." };
  }

  const uid = customData.uid;
  if (typeof uid !== "string" || !uid) {
    return { kind: "rejected", reason: "customData에 uid가 없어요." };
  }
  if (expectedUid && uid !== expectedUid) {
    // 다른 사람의 결제 건을 자신의 것인 양 완료 처리시키려는 시도 — 절대 지급하지 않는다.
    console.error("[payment] uid 불일치", { paymentId, expectedUid, actual: uid });
    return { kind: "rejected", reason: "본인의 결제 건이 아니에요." };
  }

  const product = resolvePaidProduct(customData.productId, payment.amount.total);
  if (!product) {
    console.error("[payment] 알 수 없는 productId", paymentId, customData.productId);
    return { kind: "rejected", reason: "알 수 없는 상품이에요." };
  }

  // 횟수제 이용권은 구매 시점에 고른 조합(타로전용/+사주/+자미두수/+사주자미두수)으로 완전히
  // 고정된다(2026-09-18) — prepare 단계에서 이미 검증했지만, customData는 결국 클라이언트가
  // 왕복시키는 값이라 여기서도 다시 검증한다.
  if (product.type === "countPass" && !isComboKey(customData.combo)) {
    console.error("[payment] countPass 결제에 유효한 combo가 없음", paymentId, customData.combo);
    return { kind: "rejected", reason: "이용권 옵션 정보가 없어요." };
  }
  const combo = isComboKey(customData.combo) ? customData.combo : null;

  if (product.type === "coin") {
    const cutoff = Date.parse(process.env.LEGACY_COIN_PAID_BEFORE ?? "");
    const paidAt = Date.parse(payment.paidAt ?? "");
    if (!Number.isFinite(cutoff) || !Number.isFinite(paidAt) || paidAt >= cutoff) {
      return { kind: "rejected", reason: "코인 상품은 판매가 종료됐어요. 결제 내역을 고객센터로 문의해주세요." };
    }
  }

  if (payment.amount.total !== product.priceWon || payment.currency !== "KRW") {
    // 실제 승인 금액이 상품 가격표와 다르면 위/변조 시도로 간주하고 지급하지 않는다.
    console.error("[payment] 금액 불일치", {
      paymentId,
      paid: payment.amount.total,
      currency: payment.currency,
      expected: product.priceWon,
    });
    return { kind: "rejected", reason: "결제 금액이 상품 가격과 일치하지 않아요." };
  }

  const userRef = adminDb.collection("users").doc(uid);
  const paymentRef = userRef.collection("payments").doc(paymentId);

  const alreadyFulfilled = await adminDb.runTransaction(async (tx) => {
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists) {
      // 멱등성: 콜백/웹훅 중 먼저 도착한 쪽이 이미 처리했다면 스킵.
      return true;
    }

    const timePassRef = product.type === "timePass" ? userRef.collection("timePasses").doc() : null;
    const countPassRef = product.type === "countPass" ? userRef.collection("countPasses").doc() : null;
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

    return false;
  });

  return { kind: "fulfilled", alreadyFulfilled, uid, productType: product.type };
}
