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
  | {
      kind: "rejected";
      reason: string;
      /** 이 결제는 **누가 다시 시도해도** 지급되지 않는다는 뜻. 승인된 돈이 우리 쪽에 남아
       *  있으면 안 되므로 호출부(fulfill.ts)가 자동으로 취소한다.
       *
       *  유일한 예외가 uid 불일치다. 그건 "이 결제가 잘못됐다"가 아니라 "네 결제가 아니다"라서,
       *  결제 자체는 진짜 주인에게 정상 지급돼야 한다. 여기서 취소해 버리면 아무나 남의
       *  paymentId 로 /complete 를 때려서 그 사람 결제를 취소시킬 수 있다. */
      autoCancel: boolean;
    };

/** 거부 사유를 운영 로그에 남기기 위한 부속 정보. 순수하게 유지하려고 여기서 직접 찍지 않고
 *  호출부(fulfillPayment)가 paymentId 와 함께 출력한다. */
export type ValidationLog = { message: string; detail?: Record<string, unknown> };

export type PaymentValidation =
  /** paidWon 은 **실제로 승인된 금액**이다(정가가 아니라). 할인 결제를 정가로 기록하면
   *  환불 자동승인이 포트원 실결제액과 대조해 전부 막고, 리워드도 실제 받은 돈보다 많이
   *  나간다 — 호출부는 이 값을 결제 문서에 남긴다. */
  | { ok: true; uid: string; product: ResolvedProduct; combo: ComboKey | null; paidWon: number }
  | { ok: false; outcome: PaymentRejection; log?: ValidationLog };

/** prepare 가 결제창을 열기 직전에 적어 둔 주문 내역(paymentIntents/{paymentId}).
 *  fulfill 이 읽어서 넘긴다 — 이 함수는 순수하게 유지하려고 직접 조회하지 않는다. */
export type PaymentIntent = {
  uid: string;
  productId: string;
  /** 실제로 청구하기로 한 금액. 할인쿠폰이 붙으면 정가보다 작다. */
  amountWon: number;
};

export type ValidateOptions = {
  /** 지정하면 customData.uid 가 이 값과 다를 때 거부한다(본인 결제 확인용). */
  expectedUid?: string;
  /** 실제 배포 여부. 원본의 `process.env.NODE_ENV === "production"` 을 주입으로 바꾼 것 — 이게
   *  참이면 TEST 채널 결제를 거부한다. */
  isProduction: boolean;
  /** 코인 상품 판매 종료 시각(ISO). 원본의 `process.env.LEGACY_COIN_PAID_BEFORE`. */
  legacyCoinPaidBefore?: string;
  /** prepare 가 남긴 주문 내역. **있으면 금액 대조의 기준이 상품표 정가가 아니라 이 기록이 된다.**
   *
   *  없으면 옛 방식(정가 대조)으로 내려간다 — 이 기능이 배포되기 전에 시작된 결제와 코인 같은
   *  옛 상품 때문이다. 할인 결제는 반드시 기록이 있으므로(prepare 가 await 로 먼저 쓴다),
   *  기록이 없는 건은 정가여야 맞다. 즉 폴백이 할인 구멍이 되지는 않는다. */
  intent?: PaymentIntent | null;
};

export function validatePaidPayment(payment: PaymentRecord, opts: ValidateOptions): PaymentValidation {
  if (payment.status !== "PAID") {
    return { ok: false, outcome: { kind: "not_paid", status: String(payment.status) } };
  }

  // 프로덕션에서는 TEST 채널 결제로 이용권이 지급되는 걸 막는다 — 실채널 계약 전이라
  // 로컬/개발에서는 통과시키고, 실제 배포에서만 거부한다(2026-09-15, 프로덕션 채널키가
  // 실수로 TEST 로 남아 있어도 무료 지급되는 사고 방지).
  //
  // ⚠️ TEST 채널이라고 카드에 아무 일도 안 일어나는 게 아니다 — 실제로 카드사 사용 알림이
  // 온다(2026-09-24 사용자 확인). 포트원 기록은 channelType=TEST / isTest=true 로 남지만,
  // 테스트로 만든 결제는 반드시 취소해서 정리할 것.
  if (opts.isProduction && payment.channel?.type !== "LIVE") {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "테스트 채널 결제는 프로덕션에서 지급되지 않아요.", autoCancel: true },
      log: { message: "프로덕션에서 LIVE 채널이 아닌 결제", detail: { channelType: payment.channel?.type } },
    };
  }

  let customData: { uid?: unknown; productId?: unknown; combo?: unknown } = {};
  try {
    customData = payment.customData ? JSON.parse(payment.customData) : {};
  } catch {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "customData를 해석하지 못했어요.", autoCancel: true },
      log: { message: "customData 파싱 실패" },
    };
  }

  const uid = customData.uid;
  if (typeof uid !== "string" || !uid) {
    return { ok: false, outcome: { kind: "rejected", reason: "customData에 uid가 없어요.", autoCancel: true } };
  }
  if (opts.expectedUid && uid !== opts.expectedUid) {
    // 다른 사람의 결제 건을 자신의 것인 양 완료 처리시키려는 시도 — 절대 지급하지 않는다.
    return {
      ok: false,
      // autoCancel:false — 위 타입 주석 참고. 남의 결제를 취소시키는 통로가 되면 안 된다.
      outcome: { kind: "rejected", reason: "본인의 결제 건이 아니에요.", autoCancel: false },
      log: { message: "uid 불일치", detail: { expectedUid: opts.expectedUid, actual: uid } },
    };
  }

  // 금액은 상품 해석에도 쓰이고(코인 7번 예외), 아래에서 다시 대조된다.
  const paidTotal = typeof payment.amount?.total === "number" ? payment.amount.total : NaN;

  const product = resolvePaidProduct(customData.productId, paidTotal);
  if (!product) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "알 수 없는 상품이에요.", autoCancel: true },
      log: { message: "알 수 없는 productId", detail: { productId: customData.productId } },
    };
  }

  // 횟수제 이용권은 구매 시점에 고른 조합으로 완전히 고정된다(2026-09-18) — prepare 단계에서
  // 이미 검증했지만, customData 는 결국 클라이언트가 왕복시키는 값이라 여기서도 다시 검증한다.
  if (product.type === "countPass" && !isComboKey(customData.combo)) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "이용권 옵션 정보가 없어요.", autoCancel: true },
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
          autoCancel: true,
        },
      };
    }
  }

  // 주문 내역이 있으면 customData 와 어긋나지 않는지 먼저 본다. customData 는 결국 클라이언트가
  // 왕복시키는 값이고, 주문 내역은 서버가 결제창을 열기 전에 적어 둔 값이라 이쪽이 진실이다.
  //
  // uid 가 어긋날 때 autoCancel 을 켜지 않는 이유는 위 uid 불일치 관문과 같다 — 그 결제의 진짜
  // 주인은 주문 내역 쪽 uid 이고, 여기서 취소해 버리면 남의 결제를 취소시키는 통로가 된다.
  if (opts.intent && opts.intent.uid !== uid) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "본인의 결제 건이 아니에요.", autoCancel: false },
      log: { message: "주문 내역과 uid 불일치", detail: { intentUid: opts.intent.uid, actual: uid } },
    };
  }
  if (opts.intent && opts.intent.productId !== product.productId) {
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "주문 정보가 일치하지 않아요.", autoCancel: true },
      log: {
        message: "주문 내역과 상품 불일치",
        detail: { intentProductId: opts.intent.productId, actual: product.productId },
      },
    };
  }

  // 기대 금액은 **주문 내역이 있으면 그쪽**이다. 상품표 정가로 대조하면 할인쿠폰이 붙은 정상
  // 결제가 전부 위조로 보인다. 그렇다고 대조를 푸는 건 100 원 결제로 11 만원 상품을 받는
  // 구멍이라, 기준을 "서버가 미리 적어 둔 금액"으로 옮기는 것이다.
  const expectedWon = opts.intent ? opts.intent.amountWon : product.priceWon;
  if (paidTotal !== expectedWon || payment.currency !== "KRW") {
    // 실제 승인 금액이 기대 금액과 다르면 위/변조 시도로 간주하고 지급하지 않는다.
    return {
      ok: false,
      outcome: { kind: "rejected", reason: "결제 금액이 상품 가격과 일치하지 않아요.", autoCancel: true },
      log: {
        message: "금액 불일치",
        detail: {
          paid: payment.amount?.total,
          currency: payment.currency,
          expected: expectedWon,
          fromIntent: Boolean(opts.intent),
        },
      },
    };
  }

  return { ok: true, uid, product, combo, paidWon: paidTotal };
}
