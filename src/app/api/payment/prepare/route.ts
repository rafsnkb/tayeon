import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { resolveProduct } from "@/lib/payment/products";
import { adminDb } from "@/lib/firebase/admin";
import { COMBOS, type ComboKey } from "@/lib/tarot/pricing";
import { isValidBirthInfo } from "@/lib/tarot/birthInfo";

function isComboKey(value: unknown): value is ComboKey {
  return typeof value === "string" && value in COMBOS;
}

// 결제창(PortOne.requestPayment)을 열기 직전에 프론트가 호출하는 엔드포인트.
//
// 결제 금액/주문명을 클라이언트가 마음대로 정해서 결제창에 넘기게 두지 않고, 서버가
// pricing.ts 기준으로 검증된 값을 내려준다. (그래도 최종 지급 여부는 여기서 내려준 값이
// 아니라, 결제 완료 후 /api/payment/complete가 포트원 결제내역 조회로 다시 검증한 값만 근거로
// 판단한다 — 이 엔드포인트는 위조 방지의 1차 방어선일 뿐, 신뢰의 근원이 아니다.)
//
// customData에 서버가 Firebase ID 토큰으로 검증한 uid를 실어 보낸다 — 결제창 호출 시 이
// customData를 그대로 포트원에 전달해야 이후 지급 단계에서 "누구의 결제인지"를 신뢰할 수 있다.
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data();
  if (userData?.suspended) {
    const suspendedUntil = Date.parse(userData.suspendedUntil ?? "");
    if (Number.isFinite(suspendedUntil) && suspendedUntil <= Date.now()) {
      await userRef.update({ suspended: false, suspendedAt: null, suspendedUntil: null, suspendedReason: null });
    } else {
      return NextResponse.json(
        {
          error: "정지 중에는 결제할 수 없어요.",
          code: "SUSPENDED",
          reason: userData.suspendedReason ?? null,
          suspendedUntil: userData.suspendedUntil ?? null,
        },
        { status: 403 }
      );
    }
  }

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
    const passes = await userRef.collection("countPasses").get();
    if (passes.docs.some((doc) => {
      const data = doc.data();
      return data.source === "purchase" && (data.status === "unused" || data.status === "active");
    })) {
      return NextResponse.json({ error: "보유 이용권을 소진한 후 새 이용권을 구매해주세요." }, { status: 409 });
    }
  }

  if (product.type === "timePass") {
    const passes = await userRef.collection("timePasses").get();
    if (passes.docs.some((doc) => ["unused", "active"].includes(doc.data().status))) {
      return NextResponse.json({ error: "보유 시간제 이용권을 소진한 후 새 이용권을 구매해주세요." }, { status: 409 });
    }
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
