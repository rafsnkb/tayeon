// 사주 리포트를 **파는 쪽**. 가격 산출, 결제 전 판매 제약(§10), 그리고 타로 이용권이 이 상품에
// 쓰이지 않도록 막는 장치다.
//
// ⚠️ **이 파일은 순수 계산만 한다. Firestore·Anthropic 을 import 하지 않는다.**
//
// 결제 검증 경로(`validatePayment.ts` → `fulfill.ts` → `prepare/route.ts`)가 여기를 import 한다.
// 그 경로가 import 하는 건 순수 계산뿐이어야 한다 — 이유가 스타일이 아니다:
//
// - `@/lib/anthropic` 은 모듈 로드 시점에 `export const anthropic = new Anthropic()` 을 실행하고,
//   그 생성자는 API 키가 없으면 **던진다.** 계산·골격 생성(`open.ts`)이 그걸 타고 들어오면 키
//   하나 빠진 환경에서 **라이브 결제 검증이 import 단계에서 죽는다** — 런타임 에러가 아니라
//   import 에러라 어느 결제도 통과하지 못한다.
// - `@/lib/firebase/admin` 은 import 시 `initializeApp` 을 즉시 실행한다. 문서 읽기·쓰기
//   (`storage.ts`)를 여기 합치면 같은 종류의 문제가 된다.
//
// 그래서 셋으로 갈라 둔다: **여기**(순수 계산) / `storage.ts`(문서) / `open.ts`(계산 + 골격).
//
// ⚠️ **`storage.ts`·`open.ts` 를 이 파일에서 재export 하지 말 것.** 편의상 한 줄 넣는 순간 위
// 방어가 통째로 사라지고, 사라진 것이 눈에 보이지 않는다(타입체크도 린트도 통과한다).
//
// ── 타로와 갈라야 하는 이유 ──────────────────────────────────────────────────
// 타로 이용권(횟수제·시간제)은 이 상품에 쓸 수 없다(설계 §11 "타로 이용권 사용 불가를 코드로
// 강제"). 주석으로 금지하는 건 강제가 아니라서, 실제로 막는 장치를 셋 둔다:
//
// 1. **식별자를 겹치지 않게 한다.** 사주 상품의 결제 식별자는 `sajureport-` 로 시작하고, 타로
//    상품표(`resolveProduct`)는 이 값을 모른다 — 즉 사주 결제가 타로 지급 경로(코인·횟수제·
//    시간제 발급)로 흘러 들어갈 입구가 없다. `assertNotTarotProduct` 가 그걸 런타임에 확인한다.
// 2. **타입이 막는다.** 이용권 차감 입구인 `chargeActiveCountPass` 는 `SpreadKey`
//    ("one"|"three"|"dual"|"celtic")를 요구한다. 사주 상품 slug 는 `SpreadKey` 가 아니므로
//    타입체커가 먼저 거부한다. 그래서 이 파일은 `SpreadKey`·`ComboKey` 를 **만들지 않는다** —
//    사주 상품에서 그 두 타입으로 가는 변환 함수를 만들면 그 순간 이 방어가 무너진다.
// 3. **테스트가 지킨다.** `purchase.test.mjs` 가 19개 상품의 결제 식별자를 전부 `resolveProduct`
//    에 넣어 보고 하나라도 해석되면 실패한다. 나중에 누가 사주 상품을 타로 상품표에 추가하면
//    `npm test` 가 깨진다.
import { getSajuProduct, SAJU_PRODUCTS, type SajuProduct } from "@/lib/saju/products";
import { whyUnsellable } from "@/lib/saju/generate/chart";
import type { SajuMode } from "@/lib/saju/generate/chart";
import { resolveProduct, type ResolvedProduct } from "@/lib/payment/products";
import type { BirthInfo } from "@/lib/tarot/birthInfo";
// 타입만 가져온다 — 컴파일 후 사라지므로 위 경계("Firestore 를 import 하지 않는다")는 유지된다.
import type { SajuOrder } from "@/lib/saju/storage";
// 상수만 있는 의존성 없는 모듈이다 — 화면(클라이언트 컴포넌트)도 같은 값을 읽어야 해서
// 따로 떼어 뒀다(noticeVersion.ts 머리말).
import { REFUND_NOTICE_VERSION } from "@/lib/saju/noticeVersion";
// 약관 시행일이 곧 약관의 버전이다(같은 파일 `부칙: 이 약관은 …부터 시행합니다`).
import { TERMS_EFFECTIVE_DATE } from "@/lib/legal/content";

/** 사주 리포트 결제 식별자의 접두어.
 *
 *  `saju-` 로 하지 않았다: 타로 시간제 이용권에 이미 `timepass-saju-30`(타로+사주 첨부) 이 있어서
 *  사람이 읽을 때 헷갈린다. 이 둘은 완전히 다른 상품이고, 헷갈리면 "사주 이용권으로 사주 리포트를
 *  볼 수 있나"라는 잘못된 기대가 생긴다. */
export const SAJU_PRODUCT_ID_PREFIX = "sajureport-";

export const SAJU_MODES = ["saju", "ziwei", "integrated"] as const satisfies readonly SajuMode[];

export function isSajuMode(value: unknown): value is SajuMode {
  return typeof value === "string" && (SAJU_MODES as readonly string[]).includes(value);
}

const MODE_LABEL: Record<SajuMode, string> = {
  saju: "사주",
  ziwei: "자미두수",
  integrated: "사주×자미두수 통합",
};

/** 결제 식별자를 만든다. 모드가 뒤에 오는 이유는 아래 `parseSajuProductId` 주석 참고. */
export function sajuProductId(slug: string, mode: SajuMode): string {
  return `${SAJU_PRODUCT_ID_PREFIX}${slug}-${mode}`;
}

/**
 * 결제 식별자를 상품 slug 와 모드로 되돌린다. 알 수 없는 값이면 null — 클라이언트가 임의로
 * 만들어 낸 식별자를 거른다(타로 `resolveProduct` 와 같은 원칙).
 *
 * slug 에 `-` 가 들어가므로(`single-love`) **모드를 마지막 조각으로 두고 뒤에서 자른다.** 모드를
 * 앞에 두면 접두어와 붙어 경계가 모호해진다.
 */
export function parseSajuProductId(productId: unknown): { slug: string; mode: SajuMode } | null {
  if (typeof productId !== "string" || !productId.startsWith(SAJU_PRODUCT_ID_PREFIX)) return null;
  const rest = productId.slice(SAJU_PRODUCT_ID_PREFIX.length);
  const cut = rest.lastIndexOf("-");
  if (cut <= 0) return null;
  const slug = rest.slice(0, cut);
  const mode = rest.slice(cut + 1);
  if (!isSajuMode(mode) || !getSajuProduct(slug)) return null;
  return { slug, mode };
}

/**
 * 이 식별자가 타로 상품표에 있으면 **던진다.**
 *
 * 지금은 겹치지 않는다. 그런데 나중에 누가 사주 상품을 타로 상품표에 올리면, 그 결제는 조용히
 * 타로 지급 경로로 들어가 **횟수제·시간제 이용권을 발급한다** — 사주 리포트는 안 만들어지고
 * 타로 이용권만 생기는, 사용자와 장부 양쪽이 어긋나는 상태다. 그 조합을 조용히 두지 않는다.
 */
export function assertNotTarotProduct(productId: string): void {
  if (resolveProduct(productId) !== null) {
    throw new Error(
      `사주 상품 식별자가 타로 상품표와 겹친다: ${productId} — 겹치면 사주 결제가 타로 이용권 지급 경로로 흘러간다.`
    );
  }
}

export type SajuPurchase = {
  product: SajuProduct;
  mode: SajuMode;
  productId: string;
  priceWon: number;
  orderName: string;
};

/**
 * 상품 slug + 모드로 팔 내용을 확정한다. 가격은 **상품 정의에서만** 온다 — 클라이언트가 보낸
 * 금액은 쓰지 않는다(기존 결제 경로와 같은 규칙, src/lib/payment/products.ts 머리말).
 */
export function resolveSajuPurchase(slug: unknown, mode: unknown): SajuPurchase | null {
  if (typeof slug !== "string" || !isSajuMode(mode)) return null;
  const product = getSajuProduct(slug);
  if (!product) return null;
  const productId = sajuProductId(slug, mode);
  assertNotTarotProduct(productId);
  return {
    product,
    mode,
    productId,
    priceWon: product.pricesWon[mode],
    orderName: `타연 ${product.tag} 리포트 (${MODE_LABEL[mode]})`,
  };
}

/**
 * 결제 식별자를 결제 계층이 쓰는 모양(`ResolvedProduct`)으로 되돌린다.
 *
 * `validatePayment` 가 **타로 해석이 실패한 뒤에** 부른다. 순서가 중요하다 — 기존 타로 분기 안으로
 * 들어가지 않고 그 뒤에 서는 갈래여야 타로 결제의 동작이 한 줄도 바뀌지 않는다. 둘 다 실패하면
 * 지금까지와 똑같이 "알 수 없는 상품 → 자동 취소"로 떨어진다(오타 난 상품 코드가 통과하면 안 된다).
 *
 * 가격은 상품 정의에서만 온다. 실제 대조는 주문 내역(`paymentIntents.amountWon`)과 하므로 여기
 * 값이 기준이 되는 건 주문 내역이 없는 예외 경로뿐이다.
 */
export function resolveSajuReportProduct(productId: unknown): ResolvedProduct | null {
  const parsed = parseSajuProductId(productId);
  if (!parsed) return null;
  const purchase = resolveSajuPurchase(parsed.slug, parsed.mode);
  if (!purchase) return null;
  return {
    type: "sajuReport",
    productId: purchase.productId,
    priceWon: purchase.priceWon,
    slug: parsed.slug,
    mode: parsed.mode,
    orderName: purchase.orderName,
  };
}

/**
 * 결제 **전에** 막아야 할 것들. 팔 수 있으면 null, 못 팔면 사용자에게 보여줄 이유를 돌려준다.
 *
 * 화면에서 먼저 막더라도 결제 직전에 서버가 다시 불러야 한다 — API 를 직접 두드리면 화면 검사는
 * 우회되고, 그렇게 팔린 건은 환불 요구가 들어오면 지는 싸움이 된다(§10).
 */
export function whyNotPurchasable(args: {
  product: SajuProduct;
  mode: SajuMode;
  birthInfo: BirthInfo;
  /** 상대방 생년월일시가 입력돼 있는지. `needsPartner` 상품은 이게 없으면 팔 수 없다. */
  hasPartnerBirthInfo: boolean;
}): string | null {
  // 성별 필수 · "시간 모름"은 자미두수·통합 판매 금지(§10). 계산 계층과 **같은 함수**를 쓴다 —
  // 판매 제약이 두 곳에 복사되면 한쪽만 고쳐져서 "결제는 됐는데 계산이 안 되는" 건이 생긴다.
  const unsellable = whyUnsellable(args.birthInfo, args.mode);
  if (unsellable) return unsellable;
  if (args.product.needsPartner && !args.hasPartnerBirthInfo) {
    return "상대방의 생년월일시를 입력해야 하는 상품이에요.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 청약철회 제한 동의 — 기록해야 하는 이유와 어디에 남는지
// ─────────────────────────────────────────────────────────────────────────────

// 서버 쪽 사용처가 여기라 다시 내보낸다. **원본은 `@/lib/saju/noticeVersion`** 이고, 화면
// (클라이언트 컴포넌트)은 그쪽에서 직접 가져가는 게 낫다 — 이 파일은 상품표·판매 제약까지 끌고
// 오므로 상수 하나를 위해 import 하기엔 무겁다.
export { REFUND_NOTICE_VERSION } from "@/lib/saju/noticeVersion";

/** 화면이 결제 요청에 실어 보내는 동의 상태. 클라이언트가 만든 값이라 그대로 믿지 않는다.
 *
 *  `checkedAt` 은 화면이 체크한 시각인데 **기록에 쓰지 않는다** — 클라이언트 시계는 틀릴 수도,
 *  고쳐질 수도 있다. "체크됐다"는 신호로만 읽고 시각은 서버가 다시 찍는다. */
export type PurchaseConsentInput = {
  /** 청약철회 제한 안내 동의 [필수]. */
  refund?: { agreed?: unknown; noticeVersion?: unknown };
  /** 이용약관 동의 [필수]. `refund` 와 같은 모양이다(2026-09-26) — 화면
   *  (`purchaseRequest.ts` 의 `PurchaseConsent.terms`)이 보내는 필드명·구조 그대로다. 예전엔
   *  이 자리가 `termsAgreed: unknown` 이었는데 화면은 처음부터 `terms.agreed` 를 보내고
   *  있었다 — 모든 사주 결제가 409 CONSENT_REQUIRED 로 떨어지던 원인. */
  terms?: { agreed?: unknown; termsVersion?: unknown };
  /** 참고값이고 증거가 아니다 — 위 주석 참고. */
  checkedAt?: unknown;
};

/** 결제 문서에 영구 보존되는 동의 기록. `consentedAt` 은 **서버 시각**이다. */
export type PurchaseConsentRecord = {
  consentedAt: string;
  /** 그때 보여준 환불 안내 문구의 버전. */
  refundNoticeVersion: string;
  /** 그때 시행 중이던 이용약관의 버전(시행일).
   *
   *  `refundNoticeVersion` 과 대칭이다(2026-09-26) — 화면이 보여준 버전(`terms.termsVersion`)을
   *  서버 상수(`TERMS_EFFECTIVE_DATE`)와 대조하고, 통과한 값만 여기 남는다. 전엔 화면이 이 값을
   *  보내지 않아 서버가 무조건 "지금 시행 중인 버전"을 찍었는데, 그러면 캐시된 옛 약관을 보고
   *  결제한 사람의 기록만 최신으로 남는 문제가 있었다. */
  termsVersion: string;
};

/**
 * 동의를 검증해서 **보존할 기록**으로 바꾼다. 통과하지 못하면 결제를 열지 않는다.
 *
 * 왜 기록이 필요한가 — 청약철회 제한을 주장하려면 **증명책임이 우리 쪽**이다(대법원 2018다287034,
 * 2023.6.15: 제한사유의 존재와 "그 제한사유 해당 사실에 대한 표시의무를 다하였는지"를 **모두**
 * 사업자가 증명해야 한다). 체크박스를 그리는 것만으로는 증명이 안 되고, **체크한 사실·시점·그때
 * 보여준 문구 버전**이 남아야 한다.
 *
 * 두 가지를 클라이언트에게 맡기지 않는다:
 * - **버전은 서버 상수와 대조한다**(`refund.noticeVersion` ↔ `REFUND_NOTICE_VERSION`,
 *   `terms.termsVersion` ↔ `TERMS_EFFECTIVE_DATE`, 2026-09-26 부터 둘 다). 클라이언트 말대로
 *   받아 적으면 "그때 본 문구"를 클라이언트가 정하는 셈이고, 그러면 증명하려던 것이 증명되지
 *   않는다. 옛 화면이 캐시된 채로 결제를 시도하는 경우도 여기서 걸러진다 — 그건 실제로 다른
 *   문구를 본 사람이다.
 * - **`consentedAt` 은 서버가 찍는다.** 클라이언트 시계는 틀릴 수도, 고쳐질 수도 있다.
 */
export function validatePurchaseConsent(
  input: PurchaseConsentInput | undefined,
  now: Date
): { ok: true; record: PurchaseConsentRecord } | { ok: false; reason: string } {
  // 화면이 [필수] 로 받는 두 개를 **둘 다** 본다. 하나만 검사하면 클라이언트가 나머지 체크를 빼고도
  // 결제를 통과시킬 수 있고, 그건 화면이 약속한 걸 서버가 안 지키는 자리다.
  if (input?.terms?.agreed !== true) {
    return { ok: false, reason: "이용약관에 동의해야 결제를 진행할 수 있어요." };
  }
  if (input.refund?.agreed !== true) {
    return { ok: false, reason: "환불 안내에 동의해야 결제를 진행할 수 있어요." };
  }
  if (input.refund.noticeVersion !== REFUND_NOTICE_VERSION) {
    // 화면이 옛 문구를 들고 있다 — 그 사람은 **실제로 다른 문구를 봤다.** 통과시키면 기록이
    // 거짓이 된다. 새로고침하면 지금 문구를 보고 다시 동의하게 된다.
    return { ok: false, reason: "환불 안내가 변경됐어요. 화면을 새로고침한 뒤 다시 시도해주세요." };
  }
  if (input.terms.termsVersion !== TERMS_EFFECTIVE_DATE) {
    // refund.noticeVersion 과 같은 이유 — 화면이 캐시된 옛 약관을 보여준 채로 결제를 시도했다.
    return { ok: false, reason: "이용약관이 변경됐어요. 화면을 새로고침한 뒤 다시 시도해주세요." };
  }
  return {
    ok: true,
    record: {
      consentedAt: now.toISOString(),
      refundNoticeVersion: REFUND_NOTICE_VERSION,
      termsVersion: TERMS_EFFECTIVE_DATE,
    },
  };
}

export type OpenGate =
  /** 열어도 된다. */
  | { ok: true }
  /** 이미 열려 있다 — 그 리포트를 그대로 준다. 새로 만들지 않는다. */
  | { ok: false; reason: "already"; readingId: string }
  /** 결제가 확정되지 않았거나(`pending`) 환불로 내려갔다(`refunded`). 열지 않는다. */
  | { ok: false; reason: "not_paid" };

/**
 * 이 주문을 지금 리포트로 열어도 되는가. **순수 함수다** — `open.ts` 가 시작할 때 한 번,
 * 트랜잭션 안에서 다시 한 번 같은 판정을 쓴다(`pageGateReason` 과 같은 구조).
 *
 * `status !== "paid"` 하나로 두 경우를 함께 막는 게 핵심이다:
 * - `pending` — 결제창을 열었을 뿐 결제가 확정되지 않은 주문.
 * - `refunded` — **환불이 열기보다 먼저 온 경우.** 결제 직후 취소하면 잠글 리포트가 아직
 *   없어서 회수 쪽은 주문 마커만 내리는데, 그 마커가 `paid` 로 남아 있으면 그 뒤에 들어온
 *   열기 요청이 **환불된 결제로 리포트를 만들어 준다.** 여기가 그걸 막는 자리다.
 *
 * `SajuOrder` 는 타입으로만 가져온다(컴파일 후 사라진다) — 이 파일의 "Firestore 를 import 하지
 * 않는다"는 경계는 그대로다.
 */
export function openGateReason(order: Pick<SajuOrder, "status" | "readingId"> | null): OpenGate {
  if (!order || order.status !== "paid") return { ok: false, reason: "not_paid" };
  if (order.readingId) return { ok: false, reason: "already", readingId: order.readingId };
  return { ok: true };
}

/** 목록 화면이 쓰는, 지금 실제로 살 수 있는 상품들.
 *
 *  지금은 19개 전부다. 한동안 성인 상품 2종을 거르는 `ADULT_PRODUCTS_ON_SALE` 게이트가 있었는데
 *  **걷어냈다**(2026-09-26) — 그 두 상품이 성인 전용이 아니라는 결정이 났고, 거를 대상이 없어진
 *  상수와 분기를 남겨 두면 "이게 왜 아무것도 안 막지"가 된다(`products/index.ts` 머리말 참고).
 *
 *  **함수는 남긴다.** 판매 가능 여부가 상품표와 갈라지는 날(품절·기간 한정·지역 제한)은 다시
 *  오고, 그때 화면마다 조건을 쓰지 않으려면 이 한 곳이 있어야 한다. 지금 전부를 돌려주는 것과
 *  "거를 자리가 여기"인 것은 다른 얘기다. */
export function purchasableSajuProducts(): SajuProduct[] {
  return [...SAJU_PRODUCTS];
}

// ── 결제 확정 경로는 어디 있나 ───────────────────────────────────────────────
//
// 기존 타로 결제 경로를 **재사용한다**(2026-09-26 결정). 사주 전용 prepare/complete/webhook 을
// 따로 두면 금액 대조와 멱등성이 두 벌이 되는데, 그건 결제에서 가장 위험한 종류의 중복이다 —
// 갈라진 뒤 한쪽만 고치는 날이 오고 그때 증상은 이중 지급이나 미지급이다.
//
// 흐름:
//   prepare        `resolveSajuReportProduct` → `whyNotPurchasable` → 주문 마커(pending) 기록
//   complete/웹훅  `validatePayment` 가 타로 해석 **실패 뒤** 여기를 한 번 더 시도 →
//                  `fulfill` 의 네 번째 갈래가 마커를 paid 로 올린다(이용권 지급 없음)
//   결과 화면      `openSajuReading`(open.ts) 이 계산 + 골격을 돌려 리포트를 만든다
//
// 골격이 `fulfill` 밖에 있는 이유는 29초다 — 결제 확정 웹훅을 그만큼 잡으면 타임아웃·재시도가
// 겹쳐 같은 결제가 두 번 이행될 수 있다(open.ts 머리말).
