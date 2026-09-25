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
  HELD_PASS_STATUSES,
  isHeldPass,
} from "@/lib/tarot/pricing";
import { USERS, PAYMENTS, TIME_PASSES, COUNT_PASSES, PAYMENT_INTENTS, USER_DISCOUNT_COUPONS } from "@/lib/firestore/collections";
import { notifyOwner } from "@/lib/notify/owner";

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

/** 포트원이 "이미 취소된 결제"라고 답했는지. 웹훅 재시도로 같은 건을 두 번 취소하려 할 때
 *  실패로 보지 않기 위한 판정 — admin/src/lib/refundExecute.ts 의 같은 이름 함수와 쌍이다. */
function isAlreadyCancelled(error: unknown): boolean {
  const data = (error as { data?: { type?: unknown } })?.data;
  if (data?.type === "PAYMENT_ALREADY_CANCELLED") return true;
  return /already cancelled/i.test(error instanceof Error ? error.message : String(error));
}

/**
 * 지급할 수 없다고 판정된 결제의 돈을 돌려준다.
 *
 * 예전에는 검증에 걸린 결제를 그냥 거부만 하고 끝냈다 — 승인된 돈은 그대로 우리 쪽에 남고,
 * users/{uid}/payments 문서도 안 생기고, 알림도 없었다. 그래서 "돈은 빠져나갔는데 아무것도
 * 못 받았고 어디에도 기록이 없는" 상태가 만들어질 수 있었다(2026-09-24).
 *
 * 가장 현실적인 방아쇠는 공격이 아니라 **결제창을 열어둔 사이의 가격 변경**이다. 사용자가
 * 옛 가격으로 결제를 마치면 금액 대조에서 걸린다. 보유 제한(duplicate) 경로가 이미 같은 일을
 * 하고 있었으므로, 같은 원칙을 나머지 거부 사유에도 적용한다.
 *
 * uid 불일치는 여기 오지 않는다(validatePayment.ts 의 autoCancel:false) — 그 결제는 진짜
 * 주인에게 지급돼야 하고, 취소해 버리면 남의 결제를 취소시키는 통로가 된다.
 */
async function cancelUnfulfillable(
  paymentId: string,
  payment: { orderName?: string; amount?: { total?: number } | null },
  reason: string,
  via: "complete" | "webhook"
): Promise<void> {
  let cancelled = true;
  await portone.cancelPayment({ paymentId, reason: `지급 불가(${reason}) — 자동 취소` }).catch((error) => {
    if (isAlreadyCancelled(error)) return;
    cancelled = false;
    console.error("[payment] 지급 불가 건 자동 취소 실패 — 수동 환불 필요", paymentId, error);
  });
  await notifyOwner({
    key: `payment-unfulfillable/${paymentId}`,
    level: cancelled ? "warn" : "urgent",
    title: cancelled ? `지급 불가 결제 자동 취소 · ${wonLabel(payment)}` : `🚨 지급 불가 결제 취소 실패 · ${wonLabel(payment)}`,
    fields: [
      ["결제", paymentId],
      ["상품", String(payment.orderName ?? "-")],
      ["사유", reason],
      ["경로", via],
    ],
    note: cancelled
      ? "지급 조건을 통과하지 못해 결제를 자동 취소했습니다. 정상 구매를 막은 것이라면 원인을 확인해 주세요."
      : "**결제 취소에 실패했습니다. 돈은 받았는데 아무것도 지급되지 않은 상태입니다 — 포트원 콘솔에서 직접 취소해 주세요.**",
  }).catch((error) => console.error("[payment] 지급 불가 알림 실패", paymentId, error));
}

function wonLabel(payment: { amount?: { total?: number } | null }): string {
  const total = payment.amount?.total;
  return typeof total === "number" ? `${total.toLocaleString("ko-KR")}원` : "금액 불명";
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

  // prepare 가 적어 둔 주문 내역 — "이 결제는 얼마여야 하는가"의 근거다. 없을 수도 있다
  // (이 기능 배포 전에 시작된 결제, 옛 코인 상품). 그 경우 검증이 옛 방식인 정가 대조로
  // 내려간다. 조회 실패와 "원래 없음"을 구분하지 않는 이유는, 구분해 봐야 할 수 있는 일이
  // 같기 때문이다 — 어느 쪽이든 정가 대조가 유일하게 남은 안전한 기준이다.
  const intentSnap = await adminDb
    .collection(PAYMENT_INTENTS)
    .doc(paymentId)
    .get()
    .catch((error) => {
      console.error("[payment] 주문 내역 조회 실패 — 정가 대조로 내려간다", paymentId, error);
      return null;
    });
  const intentData = intentSnap?.exists ? intentSnap.data() : null;
  const intent =
    intentData && typeof intentData.uid === "string" && typeof intentData.productId === "string" && typeof intentData.amountWon === "number"
      ? { uid: intentData.uid, productId: intentData.productId, amountWon: intentData.amountWon }
      : null;
  // 이 결제에 쓰인 할인쿠폰. 지급이 확정될 때 같은 트랜잭션에서 소진한다.
  const couponCode = typeof intentData?.couponCode === "string" && intentData.couponCode ? intentData.couponCode : null;

  const checked = validatePaidPayment(payment, {
    expectedUid,
    isProduction: process.env.NODE_ENV === "production",
    legacyCoinPaidBefore: process.env.LEGACY_COIN_PAID_BEFORE,
    intent,
  });
  if (!checked.ok) {
    // 로그는 순수 함수 밖에서 찍는다 — 판정 자체는 validatePayment.ts 가, 관측은 여기가 맡는다.
    if (checked.log) console.error(`[payment] ${checked.log.message}`, paymentId, checked.log.detail ?? "");
    if (checked.outcome.kind === "rejected" && checked.outcome.autoCancel) {
      await cancelUnfulfillable(paymentId, payment, checked.outcome.reason, via);
    }
    return checked.outcome;
  }
  const { uid, product, combo, paidWon } = checked;

  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentRef = userRef.collection(PAYMENTS).doc(paymentId);

  const couponRef = couponCode ? userRef.collection(USER_DISCOUNT_COUPONS).doc(couponCode) : null;

  const outcome = await adminDb.runTransaction(async (tx): Promise<"already" | "duplicate" | "coupon_conflict" | "granted"> => {
    const paymentSnap = await tx.get(paymentRef);
    if (paymentSnap.exists) {
      // 멱등성: 콜백/웹훅 중 먼저 도착한 쪽이 이미 처리했다면 스킵. 쿠폰 소진도 여기서 함께
      // 막힌다 — 웹훅 재시도가 같은 쿠폰을 두 번 소진하는 일이 없다.
      return "already";
    }

    // 쿠폰 소진은 지급과 **한 트랜잭션**이어야 한다. 결제창을 두 개 띄워 같은 쿠폰으로 둘 다
    // 결제하면 prepare 는 양쪽 모두에 할인을 적어 주는데(그 시점엔 아직 안 쓴 쿠폰이다),
    // 먼저 도착한 쪽이 소진하고 나면 나머지는 받을 자격이 없던 할인이 된다. 그 건은 지급하지
    // 않고 돈을 돌려준다 — 보유 제한(duplicate)과 같은 처리다.
    const couponSnap = couponRef ? await tx.get(couponRef) : null;
    if (couponRef && couponSnap) {
      const couponData = couponSnap.data();
      if (!couponSnap.exists) {
        console.error("[coupon] 주문에 적힌 쿠폰이 없다 — 지급하지 않는다", paymentId, couponCode);
        return "coupon_conflict";
      }
      if (couponData?.status === "used" && couponData?.usedPaymentId !== paymentId) {
        console.error("[coupon] 이미 소진된 쿠폰으로 들어온 결제", paymentId, couponCode, couponData?.usedPaymentId);
        return "coupon_conflict";
      }
    }

    // 약관상 구매한 횟수제ㆍ시간제 이용권은 각각 1개까지만 보유할 수 있다. prepare에서 한 번
    // 막지만 그건 결제창을 열기 "전"의 검사라, 결제창을 두 개 띄워두면 둘 다 통과한다. 지급
    // 직전에 트랜잭션 안에서 다시 확인해야 실제로 1개가 보장된다.
    // (이 결제로 만들어질 이용권은 아직 없으므로 paymentId로 자기 자신을 걸러낼 필요는 없지만,
    //  웹훅 재시도로 이 지점에 다시 오는 경우는 위 멱등성 검사에서 이미 걸러진다.)
    const heldCollection =
      product.type === "countPass" ? COUNT_PASSES : product.type === "timePass" ? TIME_PASSES : null;
    if (heldCollection) {
      // 상태로 1차 추린 뒤 유효기간은 코드에서 본다 — Firestore 쿼리로는 "status 는 unused
      // 인데 expiresAt 은 지났다"를 표현할 수 없고, 만료된 이용권에 status:"expired" 를 써 주는
      // 코드가 없어서 상태만 보면 만료분이 영구히 재구매를 막는다(prepare 쪽 isHeldPass 주석 참고).
      const heldSnap = await tx.get(
        userRef.collection(heldCollection).where("status", "in", HELD_PASS_STATUSES)
      );
      const conflict = heldSnap.docs.some((doc) => {
        const data = doc.data();
        if (!isHeldPass(data)) return false;
        // 리워드로 받은 횟수제 이용권은 여러 개 보유가 정상이라 구매분만 본다(시간제는 구매분뿐).
        return product.type === "countPass" ? data.source === "purchase" : true;
      });
      if (conflict) {
        console.error("[payment] 보유 제한 위반 — 지급하지 않고 결제를 취소한다", paymentId, product.type);
        tx.set(paymentRef, {
          status: "duplicate_cancelled",
          productId: product.productId,
          productType: product.type,
          // priceWon 은 **실제로 승인된 금액**이다 — 정가가 아니다(2026-09-25). 환불 자동승인이
          // 포트원 실결제액과 이 값을 대조하고, 리워드 합산도 이 값을 쓴다. 정가는 listPriceWon.
          priceWon: paidWon,
          listPriceWon: product.priceWon,
          // 서버가 정한 주문명을 쓴다. payment.orderName 은 결제창을 띄울 때 브라우저가 넘긴
          // 값이라 사용자가 바꿀 수 있고, 그게 어드민 화면과 알림에 "상품"으로 그대로 표시된다
          // (2026-09-24). 금액·상품은 이미 productId 로 검증했으므로 이름도 그쪽을 따른다.
          orderName: product.orderName,
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
      // 실결제액(할인 적용 후). 정가는 listPriceWon — 위 duplicate 분기 주석 참고.
      priceWon: paidWon,
      listPriceWon: product.priceWon,
      orderName: product.orderName,
      // 환불 시 쿠폰을 되돌리려면 "이 결제가 어떤 쿠폰을 썼는지"가 결제 문서에 있어야 한다.
      // 환불 경로가 둘(어드민 refundExecute / 취소 웹훅 revoke)인데 둘 다 결제 문서는 읽으므로,
      // 주문 내역(paymentIntents)까지 따라가지 않아도 되도록 여기 복사해 둔다.
      couponCode,
      // 쿠폰함이 "이 쿠폰을 어디에 썼는지"를 보여주려면 조합까지 필요하다. 이용권 문서에도
      // 있지만, 그걸 읽으려면 결제 → 이용권으로 한 번 더 타고 가야 한다(2026-09-25).
      combo,
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
        priceWon: paidWon,
        listPriceWon: product.priceWon,
        paymentId,
        createdAt: issuedAt.toISOString(),
        expiresAt: countPassExpiresAt,
      });
    } else if (product.type === "timePass" && timePassRef) {
      tx.set(timePassRef, {
        productId: product.productId,
        minutes: product.minutes,
        combo: product.combo,
        priceWon: paidWon,
        listPriceWon: product.priceWon,
        status: "unused",
        startedAt: null,
        expiresAt: null,
        usableUntil: timePassUsableUntil,
        paymentId,
        createdAt: new Date().toISOString(),
      });
    }

    if (couponRef) {
      tx.update(couponRef, { status: "used", usedPaymentId: paymentId, usedAt: new Date().toISOString() });
    }

    return "granted";
  });

  if (outcome === "duplicate") {
    // 돈은 이미 승인된 상태라 거절만 하면 "결제했는데 아무것도 못 받는" 상태가 된다. 자동으로
    // 취소해서 환불까지 끝낸다.
    const cancelled = await portone
      .cancelPayment({ paymentId, reason: "이용권 보유 제한(1개)으로 지급 불가 — 자동 취소" })
      .then(() => true)
      .catch((error) => {
        if (isAlreadyCancelled(error)) return true;
        console.error("[payment] 보유 제한 자동 취소 실패 — 수동 환불 필요", paymentId, error);
        return false;
      });
    // 취소 실패는 돈이 묶인 상태다. 예전엔 console.error 한 줄이 전부라 아무도 몰랐고, 결제
    // 내역에도 안 떴다(정렬 필드가 없어서 — purchase-history 주석 참고). 결과를 문서에 남겨
    // 사용자 화면이 구분해서 보여줄 수 있게 하고, 실패면 운영자를 부른다(2026-09-24).
    await paymentRef.update({ cancelFailed: !cancelled, cancelledAt: new Date().toISOString() })
      .catch((error) => console.error("[payment] 취소 결과 기록 실패", paymentId, error));
    if (!cancelled) {
      await notifyOwner({
        key: `duplicate-cancel-failed/${paymentId}`,
        level: "urgent",
        title: `🚨 중복 이용권 자동 취소 실패 · ${wonLabel(payment)}`,
        fields: [
          ["결제", paymentId],
          ["사용자", uid],
          ["상품", String(payment.orderName ?? "-")],
          ["경로", via],
        ],
        note: "**돈은 받았는데 이용권은 지급되지 않은 상태입니다.** 포트원 콘솔에서 직접 취소해 주세요.",
      }).catch((error) => console.error("[payment] 중복 취소 실패 알림 실패", paymentId, error));
    }
    return { kind: "duplicate_cancelled", uid, cancelled };
  }

  return { kind: "fulfilled", alreadyFulfilled: outcome === "already", uid, productType: product.type };
}
