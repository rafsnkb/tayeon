import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { portone } from "@/lib/payment/portone";

// 등록된 빌링키(카드) 목록 조회 — /billing 페이지가 사용.
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // status == "active" 필터 + createdAt 정렬을 같이 쓰면 복합 색인이 필요해지므로, 정렬만 쿼리에
  // 맡기고 상태 필터는 메모리에서 처리한다(빌링키 개수가 유저당 소수라 문제 없음).
  const snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("billingKeys")
    .orderBy("createdAt", "desc")
    .get();

  const billingKeys = snap.docs
    .filter((doc) => doc.data().status === "active")
    .map((doc) => ({
      id: doc.id,
      cardLabel: doc.data().cardLabel ?? null,
      maskedNumber: doc.data().maskedNumber ?? null,
      issuedAt: doc.data().issuedAt ?? null,
    }));

  return NextResponse.json({ billingKeys });
}

// ⚠️ 자동충전(빌링키) 스켈레톤 — 구체적인 트리거 조건(잔액 임계값 등)은 아직 확정되지 않았다.
// 이 엔드포인트는 "카드를 등록해서 빌링키를 저장한다"까지만 담당한다.
//
// 프론트가 `PortOne.requestIssueBillingKey()`로 결제창을 통해 빌링키를 발급받은 뒤(카드 번호는
// 우리 서버를 거치지 않고 PG사로 직접 전달됨), 발급된 billingKey 문자열만 이 엔드포인트로 보낸다.
// 서버는 그 billingKey를 그대로 믿지 않고 포트원에 단건 조회해서, 실제로 발급 완료된 상태이며
// 발급 시 넘긴 customer.id가 이 요청의 uid와 일치하는지 확인한 뒤에만 저장한다(다른 사람의
// billingKey를 가로채 자기 계정에 등록하는 것을 방지).
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { billingKey } = (await req.json()) as { billingKey?: string };
  if (!billingKey) {
    return NextResponse.json({ error: "billingKey가 필요해요." }, { status: 400 });
  }

  const info = await portone.billingKey.getBillingKeyInfo({ billingKey }).catch((error) => {
    console.error("[billing] getBillingKeyInfo 실패", billingKey, error);
    return null;
  });
  if (!info || info.status !== "ISSUED") {
    return NextResponse.json({ error: "유효하지 않은 빌링키예요." }, { status: 400 });
  }
  if (info.customer?.id !== uid) {
    // 발급창 호출 시 customer.customerId로 uid를 넘겨야 여기서 일치 확인이 가능하다
    // (프론트: PortOne.requestIssueBillingKey({ ..., customer: { customerId: uid } })).
    console.error("[billing] customer.id 불일치", { billingKey, uid, actual: info.customer?.id });
    return NextResponse.json({ error: "본인 명의로 발급된 빌링키가 아니에요." }, { status: 400 });
  }

  const cardMethod = info.methods?.find((m) => m.type === "BillingKeyPaymentMethodCard");
  const cardLabel =
    cardMethod?.type === "BillingKeyPaymentMethodCard"
      ? (cardMethod.card?.name ?? cardMethod.card?.brand ?? null)
      : null;
  const maskedNumber =
    cardMethod?.type === "BillingKeyPaymentMethodCard" ? (cardMethod.card?.number ?? null) : null;

  const billingKeyRef = adminDb.collection("users").doc(uid).collection("billingKeys").doc();
  await billingKeyRef.set({
    billingKey,
    status: "active",
    cardLabel,
    maskedNumber,
    issuedAt: info.issuedAt,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: billingKeyRef.id, cardLabel, maskedNumber });
}
