import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { resolveProduct } from "@/lib/payment/products";
import { adminDb } from "@/lib/firebase/admin";
import { COMBOS, isComboKey, isHeldPass } from "@/lib/tarot/pricing";
import { isValidBirthInfo } from "@/lib/tarot/birthInfo";
import { USERS, COUNT_PASSES, TIME_PASSES } from "@/lib/firestore/collections";
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

  const { productId, combo } = (await req.json()) as { productId?: string; combo?: string };
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

  const paymentId = randomUUID();

  return NextResponse.json({
    paymentId,
    orderName: product.orderName,
    totalAmount: product.priceWon,
    currency: "KRW",
    customData: {
      uid,
      productId: product.productId,
      ...(product.type === "countPass" ? { combo } : {}),
    },
  });
}
