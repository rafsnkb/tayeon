import test from "node:test";
import assert from "node:assert/strict";
import {
  SAJU_PRODUCT_ID_PREFIX,
  SAJU_MODES,
  sajuProductId,
  parseSajuProductId,
  resolveSajuPurchase,
  whyNotPurchasable,
  purchasableSajuProducts,
  openGateReason,
  resolveSajuReportProduct,
  validatePurchaseConsent,
  REFUND_NOTICE_VERSION,
} from "@/lib/saju/purchase";
import { pageGateReason, isSajuReadingExpired } from "@/lib/saju/storage";
import { SAJU_PRODUCTS } from "@/lib/saju/products";
import {
  resolveProduct,
  listCoinProductIds,
  listCountProductIds,
  listTimePassProductIds,
} from "@/lib/payment/products";
import { discountedAmount, MIN_CHARGE_WON } from "@/lib/payment/discountCoupon";
import { TERMS_EFFECTIVE_DATE } from "@/lib/legal/content";

// 2026-09-26 신설. 이 파일의 목적은 하나다 — **타로 이용권이 사주 리포트에 쓰이지 않는다**를
// 주석이 아니라 테스트로 고정하는 것(설계 §11). 주석은 누가 어기면 아무 일도 일어나지 않지만
// 이 테스트는 `npm test` 에서 깨진다.

const birthInfo = {
  calendarType: "solar",
  isLeapMonth: false,
  birthDate: "1996-04-12",
  birthTime: "14:30",
  timeUnknown: false,
  jasiRule: "midnight",
  gender: "female",
  useTrueSolarTime: false,
  birthPlace: null,
};

test("사주 상품의 결제 식별자는 타로 상품표가 하나도 해석하지 못한다 — 겹치면 사주 결제가 타로 이용권을 발급한다", () => {
  for (const product of SAJU_PRODUCTS) {
    for (const mode of SAJU_MODES) {
      const productId = sajuProductId(product.slug, mode);
      assert.equal(
        resolveProduct(productId),
        null,
        `${productId} 가 타로 상품표에 있다 — 이러면 이 결제가 코인·횟수제·시간제 지급 경로로 흘러간다`
      );
    }
  }
});

test("타로 상품 식별자는 사주 쪽에서 해석되지 않는다 — 반대 방향도 막혀 있어야 한다", () => {
  for (const productId of ["coin-2", "count-basic", "timepass-tarot-30", "timepass-saju-30"]) {
    assert.equal(parseSajuProductId(productId), null, `${productId} 를 사주 상품으로 읽었다`);
  }
});

test("식별자는 왕복한다 — slug 에 하이픈이 있어도 모드가 잘려 나가지 않는다", () => {
  for (const product of SAJU_PRODUCTS) {
    for (const mode of SAJU_MODES) {
      assert.deepEqual(parseSajuProductId(sajuProductId(product.slug, mode)), {
        slug: product.slug,
        mode,
      });
    }
  }
  assert.ok(sajuProductId("single-love", "integrated").startsWith(SAJU_PRODUCT_ID_PREFIX));
});

test("없는 상품·없는 모드는 null — 클라이언트가 만든 식별자를 거른다", () => {
  assert.equal(parseSajuProductId("sajureport-없는상품-saju"), null);
  assert.equal(parseSajuProductId("sajureport-single-love-premium"), null);
  assert.equal(parseSajuProductId("sajureport-"), null);
  assert.equal(resolveSajuPurchase("single-love", "premium"), null);
  assert.equal(resolveSajuPurchase("nope", "saju"), null);
});

test("가격은 상품 정의에서만 나온다", () => {
  const purchase = resolveSajuPurchase("single-love", "integrated");
  assert.equal(purchase.priceWon, 19900);
  assert.equal(resolveSajuPurchase("single-love", "saju").priceWon, 9900);
  assert.equal(resolveSajuPurchase("crush-reading", "saju").priceWon, 8900);
});

test("판매 제약이 결제 전에 걸린다 — 성별 미입력, 시간 모름, 상대 정보 누락(§10)", () => {
  const single = SAJU_PRODUCTS.find((p) => p.slug === "single-love");
  const crush = SAJU_PRODUCTS.find((p) => p.slug === "crush-reading");
  const base = { product: single, mode: "integrated", birthInfo, hasPartnerBirthInfo: false };

  assert.equal(whyNotPurchasable(base), null);
  assert.ok(whyNotPurchasable({ ...base, birthInfo: { ...birthInfo, gender: "unspecified" } }));
  // 시간 모름은 자미두수·통합만 막고 사주 모드는 팔 수 있다.
  const timeUnknown = { ...birthInfo, timeUnknown: true, birthTime: null };
  assert.ok(whyNotPurchasable({ ...base, birthInfo: timeUnknown }));
  assert.equal(whyNotPurchasable({ ...base, mode: "saju", birthInfo: timeUnknown }), null);
  // needsPartner 상품은 상대 정보가 없으면 못 판다.
  assert.ok(whyNotPurchasable({ ...base, product: crush }));
  assert.equal(whyNotPurchasable({ ...base, product: crush, hasPartnerBirthInfo: true }), null);
});

test("목록은 상품표 전부를 돌려준다 — 지금 거르는 조건이 없다", () => {
  // `ADULT_PRODUCTS_ON_SALE` 게이트를 걷어냈다(2026-09-26 사용자 결정 — 성인 전용이 아니게 됨).
  // 함수는 남겼다: 품절·기간 한정 같은 이유로 다시 거를 날이 오면 화면마다 조건을 쓰지 않도록
  // 여기가 그 자리여야 한다. 지금 "전부"인 것과 "거를 자리가 여기"인 것은 다른 얘기다.
  assert.equal(purchasableSajuProducts().length, SAJU_PRODUCTS.length);
});

test("친밀감·성향 궁합도 상대 정보만 있으면 팔린다", () => {
  // 성인 표시를 뗀 결과가 실제로 판매 경로에 반영됐는지 본다. 남는 제약은 §10(성별·시간)과
  // 상대 정보뿐이다.
  for (const slug of ["intimacy-compatibility", "skinship-compatibility"]) {
    const product = SAJU_PRODUCTS.find((p) => p.slug === slug);
    assert.ok(product, `${slug} 상품이 없다`);
    assert.ok(purchasableSajuProducts().includes(product), slug);
    assert.equal(
      whyNotPurchasable({ product, mode: "saju", birthInfo, hasPartnerBirthInfo: true }),
      null,
      slug
    );
  }
});

// ── 열기·환불 갈래 (2026-09-26 추가) ─────────────────────────────────────────
// 라이브 결제 파일 4개에 사주 갈래를 넣었는데 그걸 지키는 테스트가 없었다. Firestore 를 실제로
// 부르지 않고 덮을 수 있는 건 판정 함수들이다 — 그래서 `openSajuReading` 의 판정을
// `openGateReason` 으로 빼 두고 여기서 고정한다.

const paidOrder = {
  paymentId: "pay-1",
  productSlug: "single-love",
  mode: "integrated",
  status: "paid",
  birthSnapshot: birthInfo,
  partnerBirthSnapshot: null,
  userInput: "",
  readingId: null,
  createdAt: "2026-09-26T00:00:00.000Z",
  paidAt: "2026-09-26T00:00:01.000Z",
};

test("열기 멱등 — 마커에 readingId 가 있으면 새로 만들지 않고 그걸 돌려준다", () => {
  assert.deepEqual(openGateReason(paidOrder), { ok: true });
  assert.deepEqual(openGateReason({ ...paidOrder, readingId: "r-1" }), {
    ok: false,
    reason: "already",
    readingId: "r-1",
  });
});

test("환불이 열기보다 먼저 온 경우 — 마커가 refunded 면 리포트를 만들지 않는다", () => {
  // 결제 직후 취소하면 잠글 리포트가 아직 없어서 회수 쪽은 주문 마커만 내린다. 그 마커가 paid 로
  // 남아 있으면 그 뒤 열기 요청이 **환불된 결제로 리포트를 만들어 준다** — 그 구멍의 회귀 테스트다.
  const refunded = openGateReason({ ...paidOrder, status: "refunded" });
  assert.equal(refunded.ok, false);
  assert.equal(refunded.reason, "not_paid");
  // 결제 확정 전(pending)과 주문 자체가 없는 경우도 같은 자리에서 막힌다.
  assert.equal(openGateReason({ ...paidOrder, status: "pending" }).ok, false);
  assert.equal(openGateReason(null).ok, false);
});

const FUTURE = "2099-01-01T00:00:00.000Z";

test("환불이 열기 뒤에 온 경우 — 잠긴 리포트는 뒤 페이지 생성이 막힌다", () => {
  const outline = { sections: [{}, {}, {}] };
  // 잠기기 전: 1번은 앞이 골격뿐이라 바로 만들 수 있다.
  assert.deepEqual(pageGateReason({ status: "generating", outline, expiresAt: FUTURE }, [], 1), { ok: true });
  // 잠긴 뒤: 앞 페이지가 다 있어도 막힌다.
  const locked = pageGateReason({ status: "failed", outline, expiresAt: FUTURE }, [1, 2], 3);
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, "reading_failed");
});

test("페이지 게이트 — 범위 밖과 앞 페이지 누락을 구분해서 알려준다", () => {
  const reading = { status: "generating", outline: { sections: [{}, {}, {}] }, expiresAt: FUTURE };
  assert.equal(pageGateReason(reading, [], 0).reason, "out_of_range");
  assert.equal(pageGateReason(reading, [], 4).reason, "out_of_range");
  assert.equal(pageGateReason(reading, [], 1.5).reason, "out_of_range");
  const missing = pageGateReason(reading, [1], 3);
  assert.equal(missing.reason, "missing_previous");
  assert.equal(missing.missing, 2);
  // 실패 자리표도 "존재"로 센다 — 그게 뒤를 풀어 주는 장치다(SajuReadingPage 주석).
  assert.deepEqual(pageGateReason(reading, [1, 2], 3), { ok: true });
});

test("fulfill 의 기존 3갈래는 그대로다 — 타로 상품은 사주 갈래를 타지 않는다", () => {
  // fulfill 의 지급 분기는 product.type 으로만 갈린다. 타로 식별자가 sajuReport 로 해석되는 일이
  // 없다는 것이 "기존 3갈래가 안 바뀐다"의 전부다(Firestore 없이 확인 가능한 지점).
  for (const productId of [...listCountProductIds(), ...listCoinProductIds().map((p) => p.productId),
                           ...listTimePassProductIds().map((p) => p.productId)]) {
    const resolved = resolveProduct(productId);
    assert.ok(resolved, `${productId} 가 타로 상품표에서 사라졌다`);
    assert.notEqual(resolved.type, "sajuReport", `${productId} 가 사주로 해석됐다`);
    assert.equal(resolveSajuReportProduct(productId), null, `${productId} 를 사주가 가로챘다`);
  }
});

test("사주 식별자는 sajuReport 로만 해석되고 가격·모드가 함께 온다", () => {
  const resolved = resolveSajuReportProduct(sajuProductId("single-love", "integrated"));
  assert.equal(resolved.type, "sajuReport");
  assert.equal(resolved.slug, "single-love");
  assert.equal(resolved.mode, "integrated");
  assert.equal(resolved.priceWon, 19900);
  assert.equal(resolveSajuReportProduct("sajureport-없는상품-saju"), null);
});

// ── 청약철회 제한 동의 (2026-09-26 추가) ─────────────────────────────────────
// 제한을 주장할 때 증명책임이 우리 쪽이다(대법원 2018다287034). 체크박스를 그리는 것만으로는
// 증명이 안 되고 "체크한 사실·시점·그때 보여준 문구 버전"이 남아야 한다 — 그 세 가지를 서버가
// 어떻게 확정하는지 고정한다.

const NOW = new Date("2026-09-26T12:00:00.000Z");

test("[필수] 동의 둘 중 하나라도 없으면 결제를 열지 않는다", () => {
  const full = {
    refund: { agreed: true, noticeVersion: REFUND_NOTICE_VERSION },
    terms: { agreed: true, termsVersion: TERMS_EFFECTIVE_DATE },
  };
  assert.equal(validatePurchaseConsent(undefined, NOW).ok, false);
  assert.equal(validatePurchaseConsent({}, NOW).ok, false);
  // 이용약관만 빠진 경우 — 화면은 [필수] 로 받는데 서버가 안 보면 클라이언트가 빼고 통과한다.
  assert.equal(validatePurchaseConsent({ refund: full.refund }, NOW).ok, false);
  // 환불 안내만 빠진 경우.
  assert.equal(validatePurchaseConsent({ terms: full.terms }, NOW).ok, false);
  assert.equal(validatePurchaseConsent(full, NOW).ok, true);
});

// 회귀 테스트 — 화면은 처음부터 `terms.agreed` (중첩)로 보냈는데 서버는 `termsAgreed` (평평한
// 필드)를 읽어서 모든 사주 결제가 409 CONSENT_REQUIRED 로 떨어졌다(2026-09-26 발견·수정).
test("화면이 실제로 보내는 모양 — terms 는 refund 처럼 중첩된 객체다, 평평한 termsAgreed 가 아니다", () => {
  const shapedLikeRefund = {
    refund: { agreed: true, noticeVersion: REFUND_NOTICE_VERSION },
    terms: { agreed: true, termsVersion: TERMS_EFFECTIVE_DATE },
  };
  assert.equal(validatePurchaseConsent(shapedLikeRefund, NOW).ok, true);
  // 옛 평평한 모양을 보내면(다른 코드가 실수로 되돌리면) 통과하지 않는다 — 그게 이 버그였다.
  assert.equal(
    validatePurchaseConsent({ refund: shapedLikeRefund.refund, termsAgreed: true }, NOW).ok,
    false
  );
});

test("문구 버전이 다르면 거절한다 — '그때 본 문구'를 클라이언트가 정하게 두지 않는다", () => {
  const stale = validatePurchaseConsent(
    {
      refund: { agreed: true, noticeVersion: "2026-01-01.1" },
      terms: { agreed: true, termsVersion: TERMS_EFFECTIVE_DATE },
    },
    NOW
  );
  assert.equal(stale.ok, false);
  // 옛 화면이 캐시된 채 결제하는 경우다 — 그 사람은 실제로 다른 문구를 봤다.
  assert.match(stale.reason, /새로고침/);
});

test("이용약관 버전이 다르면 거절한다 — refund.noticeVersion 과 대칭이다", () => {
  const staleTerms = validatePurchaseConsent(
    {
      refund: { agreed: true, noticeVersion: REFUND_NOTICE_VERSION },
      terms: { agreed: true, termsVersion: "2025-01-01" },
    },
    NOW
  );
  assert.equal(staleTerms.ok, false);
  assert.match(staleTerms.reason, /새로고침/);
});

test("동의 시각은 서버가 찍는다 — 클라이언트 시계를 기록에 쓰지 않는다", () => {
  const ok = validatePurchaseConsent(
    {
      refund: { agreed: true, noticeVersion: REFUND_NOTICE_VERSION },
      terms: { agreed: true, termsVersion: TERMS_EFFECTIVE_DATE },
      checkedAt: { terms: "1999-01-01T00:00:00.000Z", refundLimit: "1999-01-01T00:00:00.000Z" },
    },
    NOW
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.record.consentedAt, NOW.toISOString());
  assert.equal(ok.record.refundNoticeVersion, REFUND_NOTICE_VERSION);
  assert.equal(ok.record.termsVersion, TERMS_EFFECTIVE_DATE);
  // 클라이언트가 보낸 시각(checkedAt)은 기록에 섞이지 않는다.
  assert.deepEqual(Object.keys(ok.record).sort(), ["consentedAt", "refundNoticeVersion", "termsVersion"]);
});

// ── 보관 기간 (2026-09-26 추가) ───────────────────────────────────────────────
// 화면이 "30일 간 보관됩니다 / 초과하여 소실된 경우 복구 불가" 를 약속한다. 실제 삭제는 아직
// 없고(§11) 접근 차단까지만 하는 단계라, **차단이 정말 걸리는지**를 여기서 고정한다.

test("만료된 리포트는 새 페이지를 만들지 않는다 — status 가 아니라 expiresAt 을 본다", () => {
  const outline = { sections: [{}, {}, {}] };
  const now = new Date("2026-10-31T00:00:00.000Z");
  // status 는 멀쩡한 complete 다. 만료를 상태로 표현하지 않기 때문에 그게 정상이다 —
  // 아무도 안 건드린 문서의 status 를 바꿔 줄 코드가 없다.
  const expired = { status: "complete", outline, expiresAt: "2026-10-30T23:59:59.000Z" };
  assert.equal(isSajuReadingExpired(expired, now), true);
  const gate = pageGateReason(expired, [1, 2], 3, now);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "expired");

  // 1초 전이면 아직 열린다.
  const alive = { status: "complete", outline, expiresAt: "2026-10-31T00:00:01.000Z" };
  assert.equal(isSajuReadingExpired(alive, now), false);
  assert.deepEqual(pageGateReason(alive, [1, 2], 3, now), { ok: true });
});

test("만료 값이 깨졌으면 만료로 보지 않는다 — 읽던 리포트를 파싱 실패로 잠그지 않는다", () => {
  assert.equal(isSajuReadingExpired({ expiresAt: "" }), false);
  assert.equal(isSajuReadingExpired({ expiresAt: "언제까지" }), false);
});

test("환불 잠금이 만료보다 먼저 판정된다 — 사유가 섞이지 않는다", () => {
  const outline = { sections: [{}] };
  const both = { status: "failed", outline, expiresAt: "2000-01-01T00:00:00.000Z" };
  assert.equal(pageGateReason(both, [], 1).reason, "reading_failed");
});

// ── 할인쿠폰이 사주에도 걸린다 (2026-09-26 확인) ─────────────────────────────
// 쿠폰 경로는 상품 종류를 가리지 않으므로 사주에도 코드 변경 없이 적용된다. 그 사실을 고정해 둔다 —
// 나중에 누가 쿠폰을 타로 전용으로 좁히면 여기가 깨진다.

test("쿠폰은 사주 가격에 정률로 걸리고 최소 결제액 아래로 내려가지 않는다", () => {
  // 정률인 이유가 상품 정의 주석에 있다 — 정액이면 저가 상품에서 금액이 0 이하가 된다.
  assert.deepEqual(discountedAmount(19900, 0.3), { amountWon: 13930, discountWon: 5970 });
  assert.deepEqual(discountedAmount(8900, 0.3), { amountWon: 6230, discountWon: 2670 });
  // 100% 쿠폰이라도 최소 결제액(100원)은 남는다 — 0원 결제는 PG 가 받지 않는다.
  assert.equal(discountedAmount(8900, 1).amountWon, MIN_CHARGE_WON);
});

test("사주 세 모드 전부 쿠폰 적용 뒤에도 정가를 넘지 않는다", () => {
  for (const product of SAJU_PRODUCTS) {
    for (const mode of SAJU_MODES) {
      const listPrice = resolveSajuPurchase(product.slug, mode).priceWon;
      const { amountWon, discountWon } = discountedAmount(listPrice, 0.2);
      assert.ok(amountWon <= listPrice, `${product.slug}/${mode} 이 정가를 넘었다`);
      assert.equal(amountWon + discountWon, listPrice, "할인액과 청구액의 합이 정가와 달라졌다");
    }
  }
});
