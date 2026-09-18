import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { COUNT_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";

const REFUND_WINDOW_DAYS = 7;
const ENTRY_LIMIT = 50;

function productName(productId: string, productType: string): string {
  if (productType === "countPass") return COUNT_PACKAGES.find((pkg) => pkg.id === productId)?.name ?? "이용권";
  if (productType === "timePass") {
    const pkg = TIME_PASS_PACKAGES.find((p) => p.id === productId);
    return pkg ? `시간제 이용권 ${pkg.minutes}분 무제한` : "시간제 이용권";
  }
  return "코인";
}

function badgeLabel(status: string | undefined): string {
  if (status === "unused") return "미사용";
  if (status === "active") return "사용중";
  if (status === "exhausted") return "사용완료";
  if (status === "expired") return "유효기간 만료";
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

  const userRef = adminDb.collection("users").doc(uid);
  const paymentsSnap = await userRef
    .collection("payments")
    .orderBy("fulfilledAt", "desc")
    .limit(ENTRY_LIMIT)
    .get();

  const entries = await Promise.all(
    paymentsSnap.docs.map(async (doc) => {
      const data = doc.data();
      let badge = "";
      let refundable = false;
      if (data.productType === "countPass" && data.countPassId) {
        const passSnap = await userRef.collection("countPasses").doc(data.countPassId).get();
        const status = passSnap.data()?.status as string | undefined;
        badge = badgeLabel(status);
        refundable = status === "unused";
      } else if (data.productType === "timePass" && data.timePassId) {
        const passSnap = await userRef.collection("timePasses").doc(data.timePassId).get();
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
        badge,
        refundable,
      };
    })
  );

  return NextResponse.json({ entries });
}
