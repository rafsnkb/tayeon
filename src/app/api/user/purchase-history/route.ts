import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { COMBOS, COUNT_PACKAGES, TIME_PASS_PACKAGES, isComboKey } from "@/lib/tarot/pricing";
import { USERS, PAYMENTS, COUNT_PASSES, TIME_PASSES, REFUND_REQUESTS } from "@/lib/firestore/collections";
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

/** 어떤 옵션으로 산 이용권인지 — "타로 전용" / "타로+사주" 등.
 *
 *  두 상품이 조합을 다른 곳에 들고 있다. 시간제는 조합이 상품에 박혀 있어서(`timepass-tarot-15`)
 *  productId 만으로 알 수 있고, 횟수제는 구매 시점에 고르는 값이라 이용권 문서에 들어 있다
 *  (결제 문서에는 없다). 아래 호출부가 배지를 만들려고 어차피 이용권 문서를 읽으므로 그 값을
 *  그대로 넘겨받는다 — 저장 구조를 바꾸지 않아도 지난 결제까지 전부 표시된다.
 *
 *  조합이 없던 시절(2026-09-18 개편 전)에 만들어진 이용권은 null 이 되고, 화면은 그 줄을
 *  그리지 않는다. */
function comboLabel(productId: string, productType: string, passCombo: unknown): string | null {
  if (productType === "timePass") {
    const pkg = TIME_PASS_PACKAGES.find((p) => p.id === productId);
    return pkg ? COMBOS[pkg.combo].label : null;
  }
  if (productType === "countPass") {
    return isComboKey(passCombo) ? COMBOS[passCombo].label : null;
  }
  return null;
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
  // paidAt 으로 정렬한다. 예전엔 fulfilledAt 이었는데, 그 필드는 지급에 성공한 문서에만 있다 —
  // 보유 제한에 걸려 자동 취소된 건(status:"duplicate_cancelled", src/lib/payment/fulfill.ts)은
  // 그 필드가 없고, **Firestore 는 정렬 필드가 없는 문서를 결과에서 통째로 제외한다.** 그래서
  // 자동 취소가 실패해 돈이 묶인 건까지 결제 내역에서 아예 보이지 않았다(2026-09-24).
  // paidAt 은 fulfill.ts 의 두 분기가 모두 쓰므로 어느 쪽도 빠지지 않는다.
  const paymentsSnap = await userRef
    .collection(PAYMENTS)
    .orderBy("paidAt", "desc")
    .limit(ENTRY_LIMIT)
    .get();

  // 환불 요청은 최상위 refundRequests 에 paymentId 를 문서 id 로 들어간다. 행마다 따로 읽지
  // 않고 한 번에 가져온다(최대 ENTRY_LIMIT 건).
  const requestSnaps = paymentsSnap.docs.length
    ? await adminDb.getAll(...paymentsSnap.docs.map((d) => adminDb.collection(REFUND_REQUESTS).doc(d.id)))
    : [];
  const refundRequests = new Map(
    requestSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() ?? {}])
  );

  const entries = await Promise.all(
    paymentsSnap.docs.map(async (doc) => {
      const data = doc.data();
      // 예전엔 환불 분기가 먼저 return 해서 이용권 문서를 읽지 않았다. 옵션 표시가 환불 건에만
      // 빠지는 걸 막으려고 조회를 앞으로 당겼다(행당 읽기 1회, 최대 ENTRY_LIMIT 건).
      const passRef =
        data.productType === "countPass" && data.countPassId
          ? userRef.collection(COUNT_PASSES).doc(data.countPassId)
          : data.productType === "timePass" && data.timePassId
            ? userRef.collection(TIME_PASSES).doc(data.timePassId)
            : null;
      const passData = passRef ? (await passRef.get()).data() : undefined;
      const combo = comboLabel(data.productId, data.productType, passData?.combo);
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
          combo,
          rejectionReason: null,
        };
      }
      // 이미 같은 종류의 이용권을 보유 중이어서 지급하지 않고 결제를 되돌린 건. 자동 취소가
      // 성공했으면 "결제 취소됨"이고, 실패했으면 돈이 묶여 있는 상태라 고객센터로 보내야 한다.
      if (data.status === "duplicate_cancelled") {
        return {
          paymentId: doc.id,
          productName: productName(data.productId, data.productType),
          priceWon: data.priceWon,
          paidAt: data.paidAt ?? data.blockedAt,
          refunded: true,
          badge: data.cancelFailed ? "취소 확인 필요" : "결제 취소됨",
          refundable: false,
          combo,
          rejectionReason: data.cancelFailed
            ? "이미 보유 중인 이용권이 있어 지급되지 않았어요. 결제 취소가 지연되고 있으니 고객센터로 문의해주세요."
            : "이미 보유 중인 이용권이 있어 지급되지 않아 결제가 자동으로 취소됐어요.",
        };
      }
      if (passData) {
        const status = passData.status as string | undefined;
        badge = badgeLabel(status);
        refundable = status === "unused";
      }
      // 환불을 요청해 둔 건은 이용권이 아직 "미사용"이어도 그렇게 보이면 안 된다 — 사용자가
      // 요청한 사실이 화면에서 사라져 버린다. 처리 중이므로 다시 요청할 수도 없다.
      const request = refundRequests.get(doc.id);
      const requested = request?.status as string | undefined;
      let rejectionReason: string | null = null;
      if (requested === "pending") {
        badge = "환불 대기 중";
        refundable = false;
      } else if (requested === "rejected") {
        // 거절돼도 이용권은 다시 unused 로 풀리므로(어드민 거절 라우트) 조건만 맞으면 다시
        // 요청할 수 있다 — 청약철회는 소비자의 권리라 한 번 거절로 막을 수 없다. 왜 거절됐는지
        // 모르면 같은 사유로 다시 넣게 되므로 사유를 같이 내려준다.
        badge = "환불 거절됨";
        rejectionReason = typeof request?.rejectionReason === "string" ? request.rejectionReason : null;
      }
      if (refundable) {
        const paidAt = Date.parse(data.paidAt ?? data.fulfilledAt);
        refundable = Number.isFinite(paidAt) && Date.now() - paidAt <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      }
      return {
        paymentId: doc.id,
        // 사용자가 스스로 요청을 물릴 수 있는 상태인지. 승인·거절이 난 뒤에는 되돌릴 게 없다.
        refundPending: requested === "pending",
        productName: productName(data.productId, data.productType),
        priceWon: data.priceWon,
        paidAt: data.paidAt ?? data.fulfilledAt,
        refunded: false,
        badge,
        refundable,
        combo,
        rejectionReason,
      };
    })
  );

  return NextResponse.json({ entries });
}
