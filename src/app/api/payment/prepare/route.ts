import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { resolveProduct } from "@/lib/payment/products";
import { adminDb } from "@/lib/firebase/admin";
import { COMBOS, isComboKey, isHeldPass } from "@/lib/tarot/pricing";
import { isValidBirthInfo } from "@/lib/tarot/birthInfo";
import { USERS, COUNT_PASSES, TIME_PASSES, PAYMENT_INTENTS, USER_DISCOUNT_COUPONS } from "@/lib/firestore/collections";
import { pickBestCoupon, discountedAmount, type HeldDiscountCoupon } from "@/lib/payment/discountCoupon";
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
  // 클라이언트가 보내는 것은 **쓸지 말지**뿐이다. 어떤 쿠폰을 쓸지도, 얼마를 깎을지도 서버가
  // 정한다 — 그쪽을 믿으면 금액을 조작할 수 있다.
  const { productId, combo, useCoupon } = (await req.json()) as { productId?: string; combo?: string; useCoupon?: boolean };
  const product = resolveProduct(productId);
  if (!product || product.type === "coin") {
    return NextResponse.json({ error: "존재하지 않는 상품이에요." }, { status: 400 });
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

  // 보유 중인 할인쿠폰 가운데 지금 쓸 수 있는 것을 **서버가** 고른다. 클라이언트는 어떤 쿠폰을
  // 쓸지도, 얼마를 깎을지도 보내지 않는다 — 보내 봐야 읽지 않는다.
  //
  // 기간이 겹치게 발급하지 않는 것이 운영 원칙이라 후보는 보통 0 또는 1 개다(pickBestCoupon 주석).
  // 쿼리는 status 로만 추리고 기간은 코드에서 본다 — Firestore 복합 조건은 색인이 필요한데,
  // 한 사람이 가진 쿠폰 수는 많아야 몇 개라 전부 읽어도 부담이 없다.
  const nowIso = new Date().toISOString();
  const heldCoupons: HeldDiscountCoupon[] = useCoupon === false ? [] : await userRef
    .collection(USER_DISCOUNT_COUPONS)
    .where("status", "==", "unused")
    .get()
    .then((snap) =>
      snap.docs.flatMap((doc) => {
        const data = doc.data();
        if (typeof data.discountRate !== "number" || typeof data.startsAt !== "string" || typeof data.endsAt !== "string") {
          console.error("[coupon] 형식이 깨진 보유 쿠폰 — 무시한다", uid, doc.id);
          return [];
        }
        return [{ code: doc.id, discountRate: data.discountRate, startsAt: data.startsAt, endsAt: data.endsAt, status: "unused" as const }];
      })
    )
    .catch((error) => {
      // 쿠폰 조회 실패로 구매 자체를 막지는 않는다 — 정가로 진행된다. 할인을 못 받은 사용자는
      // 다시 시도하면 되지만, 여기서 500 을 내면 쿠폰이 없는 사람까지 결제를 못 한다.
      console.error("[coupon] 보유 쿠폰 조회 실패 — 정가로 진행한다", uid, error);
      return [];
    });
  const coupon = pickBestCoupon(heldCoupons, nowIso);
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
    createdAt: nowIso,
  });

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
