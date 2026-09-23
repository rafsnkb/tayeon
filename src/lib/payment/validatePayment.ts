// 결제 지급 전에 "이 결제를 믿어도 되는가"를 판정하는 부분만 떼어낸 것.
//
// 원래 fulfillPayment 한 함수(200줄) 안에 포트원 조회·Firestore 트랜잭션과 뒤섞여 있어서,
// 관문 하나하나가 실제로 막고 있는지 확인할 방법이 없었다. 여기 있는 것은 전부 **순수 함수**라
// 네트워크도 DB도 없이 테스트할 수 있다(validatePayment.test.mjs).
//
// 관문의 **순서와 거부 문구는 원본 그대로**다. 순서가 바뀌면 사용자가 보는 실패 사유가
// 달라지므로(예: 금액이 틀리면서 상품도 모르는 경우) 손대지 않았다.
import { resolvePaidProduct, type ResolvedProduct } from "@/lib/payment/products";
import { isComboKey, type ComboKey } from "@/lib/tarot/pricing";

/** fulfillPayment 가 실제로 읽는 필드만 추린 구조 타입. 포트원 SDK 응답이 이 모양을 만족하고,
 *  테스트는 평범한 객체 리터럴을 넘기면 된다 — SDK 타입 전체를 흉내 낼 필요가 없다. */
export type PaymentRecord = {
  status?: unknown;
  channel?: { type?: unknown } | null;
  customData?: string | null;
  amount?: { total?: number | null } | null;
  currency?: unknown;
  paidAt?: string | null;
};

export type PaymentRejection =
  | { kind: "not_paid"; status: string }
  | { kind: "rejected"; reason: string };

/** 거부 사유를 운영 로그에 남기기 위한 부속 정보. 순수하게 유지하려고 여기서 직접 찍지 않고
 *  호출부(fulfillPayment)가 paymentId 와 함께 출력한다. */
export type ValidationLog = { message: string; detail?: Record<string, unknown> };

export type PaymentValidation =
  | { ok: true; uid: string; product: ResolvedProduct; combo: ComboKey | null }
  | { ok: false; outcome: PaymentRejection; log?: ValidationLog };

export type ValidateOptions = {
  /** 지정하면 customData.uid 가 이 값과 다를 때 거부한다(본인 결제 확인용). */
  expectedUid?: string;
  /** 실제 배포 여부. 원본의 `process.env.NODE_ENV === "production"` 을 주입으로 바꾼 것 — 이게
   *  참이면 TEST 채널 결제를 거부한다. */
  isProduction: boolean;
  /** 코인 상품 판매 종료 시각(ISO). 원본의 `process.env.LEGACY_COIN_PAID_BEFORE`. */
  legacyCoinPaidBefore?: string;
};

export function validatePaidPayment(payment: PaymentRecord, opts: ValidateOptions): PaymentValidation {
  if (payment.status !== "PAID") {
    return { ok: false, outcome: { kind: "not_paid", status: String(payment.status) } };
  }

  // 프로덕션에서는 TEST 채널 결제(실제 카드 승인 없이 항상 성공하는 테스트 카드)로 지급되는 걸
  // 막는다 — 실채널이 없는 동안 로컬/개발에서는 통과시키고, 실제 배포에서만 거부한다.
  // (2026-09-15, 프로덕션 채널키가 실수로 TEST로 남아 있어도 무료 지급되는 사고 방지.)
  if (opts.isProduction && payment.channel?.type !== "LIVE") {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "테스트 채널 결제는 프로덕션에서 지급되지 않아요." },
      log: { message: "프로덕션에서 LIVE 채널이 아닌 결제", detail: { channelType: payment.channel?.type } },
    };
  }

  let customData: { uid?: unknown; productId?: unknown; combo?: unknown } = {};
  try {
    customData = payment.customData ? JSON.parse(payment.customData) : {};
  } catch {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "customData를 해석하지 못했어요." },
      log: { message: "customData 파싱 실패" },
    };
  }

  const uid = customData.uid;
  if (typeof uid !== "string" || !uid) {
    return { ok: false, outcome: { kind: "rejected", reason: "customData에 uid가 없어요." } };
  }
  if (opts.expectedUid && uid !== opts.expectedUid) {
    // 다른 사람의 결제 건을 자신의 것인 양 완료 처리시키려는 시도 — 절대 지급하지 않는다.
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "본인의 결제 건이 아니에요." },
      log: { message: "uid 불일치", detail: { expectedUid: opts.expectedUid, actual: uid } },
    };
  }

  // 금액은 상품 해석에도 쓰이고(코인 7번 예외), 아래에서 다시 대조된다.
  const paidTotal = typeof payment.amount?.total === "number" ? payment.amount.total : NaN;

  const product = resolvePaidProduct(customData.productId, paidTotal);
  if (!product) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "알 수 없는 상품이에요." },
      log: { message: "알 수 없는 productId", detail: { productId: customData.productId } },
    };
  }

  // 횟수제 이용권은 구매 시점에 고른 조합으로 완전히 고정된다(2026-09-18) — prepare 단계에서
  // 이미 검증했지만, customData 는 결국 클라이언트가 왕복시키는 값이라 여기서도 다시 검증한다.
  if (product.type === "countPass" && !isComboKey(customData.combo)) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "이용권 옵션 정보가 없어요." },
      log: { message: "countPass 결제에 유효한 combo가 없음", detail: { combo: customData.combo } },
    };
  }
  const combo = isComboKey(customData.combo) ? customData.combo : null;

  if (product.type === "coin") {
    const cutoff = Date.parse(opts.legacyCoinPaidBefore ?? "");
    const paidAt = Date.parse(payment.paidAt ?? "");
    if (!Number.isFinite(cutoff) || !Number.isFinite(paidAt) || paidAt >= cutoff) {
      return {
        ok: false,
        outcome: {
          kind: "rejected",
          reason: "코인 상품은 판매가 종료됐어요. 결제 내역을 고객센터로 문의해주세요.",
        },
      };
    }
  }

  if (paidTotal !== product.priceWon || payment.currency !== "KRW") {
    // 실제 승인 금액이 상품 가격표와 다르면 위/변조 시도로 간주하고 지급하지 않는다.
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "결제 금액이 상품 가격과 일치하지 않아요." },
      log: {
        message: "금액 불일치",
        detail: { paid: payment.amount?.total, currency: payment.currency, expected: product.priceWon },
      },
    };
  }

  return { ok: true, uid, product, combo };
}
