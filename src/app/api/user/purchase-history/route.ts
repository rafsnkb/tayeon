import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { COUNT_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";
import { USERS, PAYMENTS, COUNT_PASSES, TIME_PASSES } from "@/lib/firestore/collections";
import { REFUND_WINDOW_DAYS } from "@/lib/payment/refundPolicy";

const ENTRY_LIMIT = 50;

function productName(productId: string, productType: string): string {
  // 목업(PurchaseHistory.png)은 "스타터 이용권"처럼 패키지 이름 뒤에 "이용권"을 붙인다.
  // pricing.ts의 name은 "스타터"까지만 담고 있어 여기서 붙인다(시간제는 productName이 이미 포함).
  if (productType === "countPass") {
    const pkg = COUNT_PACKAGES.find((p) => p.id === productId);
    return pkg ? `${pkg.name} 이용권` : "이용권";
  }
  if (productType === "timePass") {
    const pkg = TIME_PASS_PACKAGES.find((p) => p.id === productId);
    return pkg ? `시간제 이용권 ${pkg.minutes}분 무제한` : "시간제 이용권";
  }
  return "충전 상품";
}

function badgeLabel(status: string | undefined): string {
  if (status === "unused") return "미사용";
  if (status === "active") return "사용중";
  if (status === "exhausted") return "사용완료";
  if (status === "expired") return "유효기간 만료";
  if (status === "refunded") return "환불완료";
  return "";
}

/** GET /api/user/purchase-history — "결제 내역"(asset/Screen/PurchaseHistory.png). 실제 결제
 * 원장(users/{uid}/payments, src/lib/payment/fulfill.ts가 씀)을 읽어 상품명/금액/상태 배지로
 * 매핑한다. 예전엔 이 페이지가 실제 데이터에 연결돼 있지 않은 정적 빈 화면이었다(2026-09-18에
 * 연결). */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentsSnap = await userRef
    .collection(PAYMENTS)
    .orderBy("fulfilledAt", "desc")
    .limit(ENTRY_LIMIT)
    .get();

  const entries = await Promise.all(
    paymentsSnap.docs.map(async (doc) => {
      const data = doc.data();
      let badge = "";
      let refundable = false;
      // 환불/취소된 결제는 이용권 상태 대신 "환불완료" 배지를 달고, 다시 환불할 수는 없다.
      // 어드민 환불과 포트원 취소 웹훅(src/lib/payment/revoke.ts) 양쪽 다 status를 refunded로
      // 쓴다. 이용권 문서도 같이 refunded가 되지만, 이용권이 없는 상품(코인 등)이나 문서가
      // 유실된 경우에도 환불 사실은 보여야 하므로 결제 문서 쪽을 기준으로 판단한다.
      if (data.status === "refunded") {
        return {
          paymentId: doc.id,
          productName: productName(data.productId, data.productType),
          priceWon: data.priceWon,
          paidAt: data.paidAt ?? data.fulfilledAt,
          refunded: true,
          badge: "환불완료",
          refundable: false,
        };
      }
      if (data.productType === "countPass" && data.countPassId) {
        const passSnap = await userRef.collection(COUNT_PASSES).doc(data.countPassId).get();
        const status = passSnap.data()?.status as string | undefined;
        badge = badgeLabel(status);
        refundable = status === "unused";
      } else if (data.productType === "timePass" && data.timePassId) {
        const passSnap = await userRef.collection(TIME_PASSES).doc(data.timePassId).get();
        const status = passSnap.data()?.status as string | undefined;
        badge = badgeLabel(status);
        refundable = status === "unused";
      }
      if (refundable) {
        const paidAt = Date.parse(data.paidAt ?? data.fulfilledAt);
        refundable = Number.isFinite(paidAt) && Date.now() - paidAt <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      }
      return {
        paymentId: doc.id,
        productName: productName(data.productId, data.productType),
        priceWon: data.priceWon,
        paidAt: data.paidAt ?? data.fulfilledAt,
        refunded: false,
        badge,
        refundable,
      };
    })
  );

  return NextResponse.json({ entries });
}
