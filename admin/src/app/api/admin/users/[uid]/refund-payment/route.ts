import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { portone } from "@/lib/payment/portone";

// 결제 취소(환불) — 관리자 전용으로 만든 이유:
// 타연의 환불 정책(src/lib/legal/content.ts 제9조)은 "환불 요청은 admin@rafraum.com으로 접수"
// 라고 명시돼 있어, 애초에 셀프서비스 환불이 아니라 관리자가 문의를 받아 처리하는 흐름이다.
// 게다가 코인은 FIFO 차감 원장이 없는 단일 숫자 필드라(pricing.ts 주석 참고) "이 결제로 받은
// 코인이 아직 안 쓰였는지"를 완벽히 추적할 수 없다 — 아래 unusedHeuristic은 최선의 근사치일 뿐,
// 최종 판단은 사람이 하는 게 안전하다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const { paymentId, reason } = (await req.json()) as { paymentId?: string; reason?: string };
  if (!paymentId || !reason?.trim()) {
    return NextResponse.json({ error: "paymentId와 reason이 필요해요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const paymentRef = userRef.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 결제 건이에요." }, { status: 404 });
  }
  const payment = paymentSnap.data() as {
    status: string;
    productType: "coin" | "timePass";
    coins: number | null;
    timePassId: string | null;
    priceWon: number;
    paidAt: string;
  };

  if (payment.status !== "fulfilled") {
    return NextResponse.json(
      { error: `이미 처리된 결제예요(status=${payment.status}).` },
      { status: 409 }
    );
  }

  // 참고용 경고 — 하드 블록은 아니다. 관리자가 이메일로 접수한 사안을 검토한 뒤 진행하는
  // 흐름이므로, 정책 위반 여부를 최종 판단하는 건 관리자다. 응답의 warnings로 눈에 띄게 알려준다.
  const warnings: string[] = [];
  const daysSincePaid = (Date.now() - new Date(payment.paidAt).getTime()) / 86_400_000;
  if (daysSincePaid > 7) {
    warnings.push(`결제일로부터 ${Math.floor(daysSincePaid)}일 지났어요(정책상 7일 이내 전액 환불).`);
  }

  if (payment.productType === "coin" && payment.coins) {
    const userSnap = await userRef.get();
    const currentCoins = (userSnap.data()?.coins as number | undefined) ?? 0;
    // FIFO 원장이 없어 정확한 "이 결제로 받은 코인" 잔여량은 알 수 없다 — 최소한 이 결제로 받은
    // 코인 수만큼 잔액이 남아있는지만 근사적으로 확인한다.
    if (currentCoins < payment.coins) {
      warnings.push(
        `현재 코인 잔액(${currentCoins.toLocaleString("ko-KR")})이 이 결제로 지급된 코인(${payment.coins.toLocaleString(
          "ko-KR"
        )})보다 적어요 — 이미 일부 사용됐을 수 있어요.`
      );
    }
  }

  if (payment.productType === "timePass" && payment.timePassId) {
    const passSnap = await userRef.collection("timePasses").doc(payment.timePassId).get();
    if (passSnap.data()?.status !== "unused") {
      warnings.push(`이용권이 이미 "${passSnap.data()?.status}" 상태예요 — 미사용이 아닐 수 있어요.`);
    }
  }

  let cancellation;
  try {
    const response = await portone.cancelPayment({ paymentId, reason });
    cancellation = response.cancellation;
  } catch (error) {
    console.error("[refund] cancelPayment 실패", paymentId, error);
    const message = error instanceof Error ? error.message : "포트원 결제 취소에 실패했어요.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const adminUser = await adminAuth.getUser(adminUid);
  const now = new Date().toISOString();

  await adminDb.runTransaction(async (tx) => {
    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedByUid: adminUid,
      refundedByEmail: adminUser.email ?? null,
    });

    if (payment.productType === "coin" && payment.coins) {
      tx.set(userRef, { coins: FieldValue.increment(-payment.coins) }, { merge: true });
    } else if (payment.productType === "timePass" && payment.timePassId) {
      tx.update(userRef.collection("timePasses").doc(payment.timePassId), {
        status: "refunded",
      });
    }
  });

  return NextResponse.json({ cancellation, warnings });
}
