import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { resolveProduct } from "@/lib/payment/products";
import {
  resolveSajuReportProduct,
  whyNotPurchasable,
  validatePurchaseConsent,
  type PurchaseConsentInput,
  type PurchaseConsentRecord,
} from "@/lib/saju/purchase";
import { recordSajuOrderIntent } from "@/lib/saju/storage";
import { getSajuProduct } from "@/lib/saju/products";
import { isValidPartner, partnerToBirthInfo } from "@/lib/tarot/partner";
import { adminDb } from "@/lib/firebase/admin";
import { COMBOS, isComboKey, isHeldPass } from "@/lib/tarot/pricing";
import { isValidBirthInfo } from "@/lib/tarot/birthInfo";
import { USERS, COUNT_PASSES, TIME_PASSES, PAYMENT_INTENTS, USER_DISCOUNT_COUPONS } from "@/lib/firestore/collections";
import {
  pickBestCoupon,
  resolveCouponSelection,
  discountedAmount,
  normalizeCouponCode,
  type HeldDiscountCoupon,
} from "@/lib/payment/discountCoupon";
import { blockIfSuspended } from "@/lib/auth/suspension";

// 결제창(PortOne.requestPayment)을 열기 직전에 프론트가 호출하는 엔드포인트.
//
// 결제 금액/주문명을 클라이언트가 마음대로 정해서 결제창에 넘기게 두지 않고, 서버가
// pricing.ts 기준으로 검증된 값을 내려준다. (그래도 최종 지급 여부는 여기서 내려준 값이
// 아니라, 결제 완료 후 /api/payment/complete가 포트원 결제내역 조회로 다시 검증한 값만 근거로
// 판단한다 — 이 엔드포인트는 위조 방지의 1차 방어선일 뿐, 신뢰의 근원이 아니다.)
//
// customData에 서버가 Firebase ID 토큰으로 검증한 uid를 실어 보낸다 — 결제창 호출 시 이
// customData를 그대로 포트원에 전달해야 이후 지급 단계에서 "누구의 결제인지"를 신뢰할 수 있다.
/**
 * 보유 이용권 때문에 구매를 막을 때의 안내.
 *
 * 환불 신청 중인 이용권은 "소진"할 수 있는 게 아니다 — 이미 쓸 수 없는 상태라, 소진하라는
 * 안내를 받은 사용자는 할 수 있는 일이 하나도 없다(2026-09-24). 기다려야 한다는 걸 그대로
 * 말해준다. isHeldPass 가 보유로 세는 상태(unused/active/refund_pending) 중 갈라야 하는 건
 * 이 하나뿐이다.
 */
function blockedByHeldPass(status: unknown, kind: "" | "시간제 ") {
  const error =
    status === "refund_pending"
      ? "환불 진행중인 이용권이 있어 구입할 수 없습니다."
      : `보유 ${kind}이용권을 소진한 후 새 이용권을 구매해주세요.`;
  return NextResponse.json({ error, code: status === "refund_pending" ? "REFUND_PENDING" : "PASS_HELD" }, { status: 409 });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();
  const suspended = await blockIfSuspended(userRef, userData, "정지 중에는 결제할 수 없어요.");
  if (suspended) return suspended;

  // useCoupon:false 는 "이번 결제에는 쿠폰을 쓰지 않겠다"는 뜻이다. 쿠폰은 1 회용이라 자동으로
  // 적용해 버리면 3,000 원 상품에 30% 쿠폰이 소진되고(900 원 할인) 11 만원 상품에 쓸 기회가
  // 사라진다 — 사용자가 스스로 막을 수 있어야 한다(2026-09-25 사용자 결정).
  //
  // 클라이언트가 보내는 것은 **쓸지 말지, 그리고(2장 이상 보유 시) 어느 것을 쓸지**뿐이다.
  // 얼마를 깎을지는 서버가 정한다 — 그쪽을 믿으면 금액을 조작할 수 있다. `couponCode` 는
  // 식별자일 뿐이고, 서버는 이 uid 의 보유분에서 그 코드를 다시 찾아 상태·기간을 직접
  // 검증한 뒤 할인율도 그 문서에서 읽는다(2026-09-27 사용자 결정 — 2장 이상이면 사용자가 고른다).
  const { productId, combo, useCoupon, couponCode: rawCouponCode, userInput, consent } = (await req.json()) as {
    productId?: string;
    combo?: string;
    useCoupon?: boolean;
    /** 보유 쿠폰이 2장 이상일 때 사용자가 고른 코드. 1장 이하면 화면이 아예 보내지 않고,
     *  그러면 지금까지처럼 서버가 `pickBestCoupon`으로 자동 선택한다. */
    couponCode?: string;
    /** 사주 리포트 상품에서 사용자가 적어 넣은 사연(상품의 userInputPrompt 에 대한 답). */
    userInput?: string;
    /** [필수] 동의 둘 — 이용약관 + 청약철회 제한 안내. 사주 리포트 상품에서만 요구한다.
     *  화면이 보내는 필드명이 `consent` 다(src/app/(app)/fortune/[slug]/FortuneDetailScreen.tsx). */
    consent?: PurchaseConsentInput;
  };
  // 사주 리포트는 타로 상품표에 **의도적으로** 없다(src/lib/saju/purchase.ts — 겹치면 그 결제가
  // 타로 이용권 지급 경로로 흘러간다). 그래서 타로 해석이 실패한 **뒤에** 한 번 더 시도한다.
  // 둘 다 아니면 지금까지와 똑같은 400 이다.
  const tarotProduct = resolveProduct(productId);
  const product = tarotProduct ?? resolveSajuReportProduct(productId);
  if (!product || product.type === "coin") {
    return NextResponse.json({ error: "존재하지 않는 상품이에요." }, { status: 400 });
  }

  // 사주 리포트의 판매 제약(§10)과 **구매 시점 스냅샷**.
  //
  // 스냅샷을 여기서 뜨는 게 핵심이다. 계산은 결제 확정 뒤에 따로 돌아가는데(29초를 결제 웹훅에
  // 붙일 수 없다 — src/lib/saju/open.ts), 그 사이에 사용자가 프로필을 고치면 **산 것과 다른
  // 결과가 나온다.** 그래서 게이트를 통과시킨 그 값을 그대로 주문 마커에 박고, 계산은 그것만 본다.
  let sajuOrder: Omit<Parameters<typeof recordSajuOrderIntent>[0], "paymentId"> | null = null;
  let sajuConsent: PurchaseConsentRecord | null = null;
  if (product.type === "sajuReport") {
    const sajuProduct = getSajuProduct(product.slug);
    const birthInfo = userData?.birthInfo;
    if (!sajuProduct || !isValidBirthInfo(birthInfo)) {
      return NextResponse.json(
        { error: "생년월일시를 먼저 입력해주세요.", code: "NO_BIRTH_INFO" },
        { status: 409 }
      );
    }
    // 상대 스냅샷에는 **닉네임까지** 담는다 — 본문이 상대를 그 이름으로 부르는데, 나중에 프로필
    // 닉네임이 바뀌면 저장된 리포트와 어긋난다(storage.ts 의 SajuPartnerSnapshot 주석).
    const rawPartner = userData?.partner;
    const partner = isValidPartner(rawPartner) ? rawPartner : null;
    const partnerBirthInfo = partner ? partnerToBirthInfo(partner) : null;
    const partnerSnapshot =
      partner && partnerBirthInfo ? { nickname: partner.nickname, birthInfo: partnerBirthInfo } : null;
    const reason = whyNotPurchasable({
      product: sajuProduct,
      mode: product.mode,
      birthInfo,
      hasPartnerBirthInfo: Boolean(partnerSnapshot),
    });
    if (reason) return NextResponse.json({ error: reason, code: "NOT_PURCHASABLE" }, { status: 409 });

    // [필수] 동의 둘(이용약관·청약철회 제한)은 **결제를 열기 전에** 받아야 하고, 받은 사실이
    // 기록으로 남아야 한다 — 제한을 주장할 때 증명책임이 우리 쪽이다(purchase.ts 의
    // `validatePurchaseConsent` 주석). 화면만 믿으면 클라이언트가 체크를 빼고도 통과한다.
    // 여기서 통과한 기록은 주문 내역에 실려 fulfill 로 건너가고, 거기서 **결제 문서**에 박힌다.
    const checked = validatePurchaseConsent(consent, new Date());
    if (!checked.ok) {
      return NextResponse.json({ error: checked.reason, code: "CONSENT_REQUIRED" }, { status: 409 });
    }
    sajuConsent = checked.record;
    sajuOrder = {
      uid,
      productSlug: product.slug,
      mode: product.mode,
      birthSnapshot: birthInfo,
      partnerBirthSnapshot: sajuProduct.needsPartner ? partnerSnapshot : null,
      userInput: typeof userInput === "string" ? userInput.slice(0, 1000) : "",
    };
  }

  // 자미두수 포함 조합은 태어난 시간이 없으면 정확한 계산이 불가능하다 — 지금까지는 클라이언트
  // 팝업으로만 막고 있었는데(2026-09-19), 이 엔드포인트를 직접 두드리면 우회 가능했다.
  const comboRequiresZiwei = product.type === "countPass" ? isComboKey(combo) && COMBOS[combo].ziwei : product.type === "timePass" ? COMBOS[product.combo].ziwei : false;
  if (comboRequiresZiwei) {
    const birthInfo = userData?.birthInfo;
    if (!isValidBirthInfo(birthInfo) || !birthInfo.birthTime || birthInfo.timeUnknown) {
      return NextResponse.json(
        { error: "태어난 시간이 입력되어 있지 않아 해당 상품을 구입하실 수 없습니다.", code: "NO_BIRTH_TIME" },
        { status: 409 }
      );
    }
  }

  if (product.type === "countPass") {
    if (!isComboKey(combo)) {
      return NextResponse.json({ error: "이용권 옵션을 선택해주세요." }, { status: 400 });
    }
    const passes = await userRef.collection(COUNT_PASSES).get();
    // 리워드로 받은 이용권은 여러 개 보유가 정상이라 구매분만 본다.
    const held = passes.docs.find((doc) => {
      const data = doc.data();
      return data.source === "purchase" && isHeldPass(data);
    });
    if (held) return blockedByHeldPass(held.data().status, "");
  }

  if (product.type === "timePass") {
    const passes = await userRef.collection(TIME_PASSES).get();
    const held = passes.docs.find((doc) => isHeldPass(doc.data()));
    if (held) return blockedByHeldPass(held.data().status, "시간제 ");
  }

  // 보유 중인 할인쿠폰 중 지금 적용할 것을 정한다. 클라이언트는 "쓸지 말지"와(2장 이상 보유
  // 시) "어느 것"만 보낸다 — 얼마를 깎을지는 항상 서버가 이 문서들에서 다시 계산한다.
  //
  // status 로 거르지 않고 전부 읽는다 — couponCode 로 특정 코드를 골랐을 때 "이미 썼다"와
  // "애초에 그런 코드가 없다"를 구분해야 하는데(resolveCouponSelection), unused 만 읽으면 이미
  // 쓴 쿠폰이 조회에서 아예 빠져 항상 "없는 코드"로 보인다. 한 사람이 가진 쿠폰 수는 많아야
  // 몇 개라 전부 읽어도 부담이 없다.
  const nowIso = new Date().toISOString();
  const heldCoupons: HeldDiscountCoupon[] = useCoupon === false ? [] : await userRef
    .collection(USER_DISCOUNT_COUPONS)
    .get()
    .then((snap) =>
      snap.docs.flatMap((doc) => {
        const data = doc.data();
        if (typeof data.discountRate !== "number" || typeof data.startsAt !== "string" || typeof data.endsAt !== "string") {
          console.error("[coupon] 형식이 깨진 보유 쿠폰 — 무시한다", uid, doc.id);
          return [];
        }
        return [{
          code: doc.id,
          discountRate: data.discountRate,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          status: data.status === "used" ? ("used" as const) : ("unused" as const),
        }];
      })
    )
    .catch((error) => {
      // 쿠폰 조회 실패로 구매 자체를 막지는 않는다 — 정가로 진행된다. 할인을 못 받은 사용자는
      // 다시 시도하면 되지만, 여기서 500 을 내면 쿠폰이 없는 사람까지 결제를 못 한다.
      console.error("[coupon] 보유 쿠폰 조회 실패 — 정가로 진행한다", uid, error);
      return [];
    });

  // couponCode 가 오면 **그 쿠폰만** 본다 — 안 되면 조용히 다른 쿠폰이나 정가로 넘어가지 않고
  // 거절한다(2026-09-27 사용자 결정: "A 를 쓴 줄 알았는데 B 가 없어졌다"가 되면 안 된다, 쿠폰은
  // 1 회용이라 되돌릴 수 없다). 코드가 없으면(1장 이하 보유 시 화면이 아예 안 보냄) 지금까지처럼
  // 자동으로 가장 유리한 것을 고른다.
  const normalizedCouponCode = useCoupon === false ? null : normalizeCouponCode(rawCouponCode);
  if (rawCouponCode !== undefined && useCoupon !== false && !normalizedCouponCode) {
    return NextResponse.json({ error: "쿠폰 코드를 다시 확인해주세요.", code: "COUPON_NOT_FOUND" }, { status: 409 });
  }
  let coupon: HeldDiscountCoupon | null;
  if (normalizedCouponCode) {
    const picked = resolveCouponSelection(heldCoupons, normalizedCouponCode, nowIso);
    if (!picked.ok) {
      const byReason = {
        not_found: { error: "쿠폰을 찾을 수 없어요. 다시 골라주세요.", code: "COUPON_NOT_FOUND" },
        used: { error: "이미 사용한 쿠폰이에요. 다시 골라주세요.", code: "COUPON_ALREADY_USED" },
        expired: { error: "사용 기간이 지난 쿠폰이에요. 다시 골라주세요.", code: "COUPON_EXPIRED" },
      } as const;
      return NextResponse.json(byReason[picked.reason], { status: 409 });
    }
    coupon = picked.coupon;
  } else {
    coupon = pickBestCoupon(heldCoupons, nowIso);
  }
  const { amountWon, discountWon } = coupon
    ? discountedAmount(product.priceWon, coupon.discountRate)
    : { amountWon: product.priceWon, discountWon: 0 };

  const paymentId = randomUUID();

  // 이 주문이 "얼마여야 하는가"를 서버에 적어 둔다 — 지급 시점(validatePaidPayment)이 상품표
  // 정가가 아니라 이 기록과 대조한다. 지금은 정가와 같은 값이지만, 할인쿠폰이 붙으면 할인된
  // 금액이 여기 들어간다. 할인액은 **서버가 계산해서 여기 적는 것**이고, 클라이언트가 보낸
  // 금액은 어느 단계에서도 믿지 않는다.
  //
  // 결제창을 열기 전에 반드시 써 둬야 한다(await). 기록이 없으면 검증이 옛 방식(정가 대조)으로
  // 내려가므로, 할인 결제가 정가 대조에 걸려 거부된다.
  await adminDb.collection(PAYMENT_INTENTS).doc(paymentId).set({
    uid,
    productId: product.productId,
    productType: product.type,
    combo: product.type === "countPass" ? combo : null,
    /** 할인 전 정가. 기록·표시용이며 대조에는 쓰지 않는다. */
    listPriceWon: product.priceWon,
    /** 실제로 청구할 금액 — 대조의 기준. */
    amountWon,
    // 어떤 쿠폰으로 깎았는지. 지급이 확정될 때 fulfill 이 이 쿠폰을 소진하고, 환불되면
    // 되돌린다. 여기 안 적어 두면 지급 시점에 "이 할인이 어디서 왔는지" 알 방법이 없다.
    couponCode: coupon?.code ?? null,
    couponDiscountRate: coupon?.discountRate ?? null,
    discountWon,
    orderName: product.orderName,
    // 청약철회 제한 동의의 **운반용 사본**. 주문 내역은 TTL 대상이라 여기 남은 것이 보존 기록은
    // 아니다 — fulfill 이 이걸 읽어 결제 문서에 박고, **그 결제 문서 쪽이 원본**이다(탈퇴 시
    // paymentArchive 로 5년 복사된다. 전자상거래법 시행령 제6조제1항제2호 "계약 또는 청약철회
    // 등에 관한 기록: 5년"). 타로 결제에는 이 필드가 없다.
    ...(sajuConsent ? { purchaseConsent: sajuConsent } : {}),
    createdAt: nowIso,
  });

  // 주문 마커는 주문 내역(paymentIntents)을 쓴 **뒤에** 남긴다 — 금액 대조의 근거가 먼저 있어야
  // 한다. 스냅샷을 주문 내역이 아니라 이 마커에 담는 이유: paymentIntents 는 최상위 컬렉션이라
  // 회원 탈퇴의 recursiveDelete(users/{uid}) 에 지워지지 않아 생년월일시가 탈퇴 후에도 남는다.
  // 방침 제3조는 "회원 탈퇴 시 지체 없이 파기"다. 마커는 users 서브트리 안이라 함께 지워진다.
  if (sajuOrder) {
    await recordSajuOrderIntent({ ...sajuOrder, paymentId });
  }

  return NextResponse.json({
    paymentId,
    orderName: product.orderName,
    totalAmount: amountWon,
    currency: "KRW",
    customData: {
      uid,
      productId: product.productId,
      ...(product.type === "countPass" ? { combo } : {}),
    },
  });
}
