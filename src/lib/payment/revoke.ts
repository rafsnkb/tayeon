// 결제 취소 반영(이용권 회수)의 유일한 진입점 — fulfill.ts의 정확한 반대편.
//
// 어드민 환불(admin/.../refund-payment)은 자기가 portone.cancelPayment를 부르면서 같은
// 트랜잭션에서 이용권까지 회수하므로 이 경로를 타지 않는다. 여기가 필요한 건 "앱을 거치지 않고
// 결제가 취소된" 경우다 — 운영자가 포트원 콘솔에서 직접 취소했거나, 카드사/PG 측 사유로 취소된
// 경우. 그동안은 /api/payment/webhook이 웹훅 종류를 구분하지 않고 전부 fulfillPayment로 보내서,
// 취소가 앱에 전혀 반영되지 않고 사용자가 이용권을 그대로 보유했다(2026-09-21).
//
// fulfill.ts와 같은 원칙: 웹훅 본문을 신뢰하지 않고 paymentId로 포트원에 재조회해서 실제 취소
// 상태만 근거로 회수한다.
import { adminDb } from "@/lib/firebase/admin";
import { portone } from "@/lib/payment/portone";
import { USERS, PAYMENTS, TIME_PASSES, COUNT_PASSES } from "@/lib/firestore/collections";

export type RevokeOutcome =
  | { kind: "revoked"; uid: string; passStatusBefore: string | null }
  | { kind: "already_revoked" }
  | { kind: "ignored"; reason: string }
  | { kind: "rejected"; reason: string };

/**
 * 취소된 결제의 이용권을 회수한다.
 *
 * 이미 사용한 이용권까지 회수할지는 정책 판단이 필요한 부분인데, 어드민 환불 경로가 "미사용
 * 이용권만" 환불 가능하도록 이미 막고 있어(refund-payment/route.ts) 사용된 이용권이 취소되는
 * 상황은 정상 운영에서 나올 수 없다. 그래도 결제가 취소된 이상 이용권이 살아있으면 안 되므로
 * 상태와 무관하게 회수하고, 이미 사용된 건이었다면 운영상 이상 징후로 로그를 남긴다.
 */
export async function revokeCancelledPayment(paymentId: string): Promise<RevokeOutcome> {
  const payment = await portone.getPayment({ paymentId }).catch((error) => {
    console.error("[payment revoke] getPayment 실패", paymentId, error);
    return null;
  });
  if (!payment) {
    return { kind: "rejected", reason: "결제 정보를 조회하지 못했어요." };
  }

  // 부분 취소는 이 서비스의 상품 구조상(이용권 1건 = 결제 1건) 쓰지 않는 흐름이다. 일부만
  // 취소됐는데 이용권 전체를 회수해버리면 과잉 회수가 되므로, 전액 취소만 회수 대상으로 본다.
  if (payment.status !== "CANCELLED") {
    if (payment.status === "PARTIAL_CANCELLED") {
      console.error("[payment revoke] 부분 취소는 자동 회수하지 않음 — 수동 확인 필요", paymentId);
      return { kind: "ignored", reason: "부분 취소는 자동 회수 대상이 아니에요." };
    }
    return { kind: "ignored", reason: `취소 상태가 아니에요(status=${String(payment.status)}).` };
  }

  let customData: { uid?: unknown } = {};
  try {
    customData = payment.customData ? JSON.parse(payment.customData) : {};
  } catch (error) {
    console.error("[payment revoke] customData 파싱 실패", paymentId, error);
    return { kind: "rejected", reason: "customData를 해석하지 못했어요." };
  }
  const uid = customData.uid;
  if (typeof uid !== "string" || !uid) {
    return { kind: "rejected", reason: "customData에 uid가 없어요." };
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentRef = userRef.collection(PAYMENTS).doc(paymentId);
  const now = new Date().toISOString();

  return adminDb.runTransaction(async (tx): Promise<RevokeOutcome> => {
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists) {
      // 지급된 적 없는 결제(예: 프로덕션에서 TEST 채널 결제가 거부된 건)는 회수할 것도 없다.
      return { kind: "ignored", reason: "지급 기록이 없는 결제예요." };
    }
    const paymentData = paymentSnap.data() as {
      status?: string;
      productType?: "coin" | "countPass" | "timePass";
      countPassId?: string | null;
      timePassId?: string | null;
    };
    if (paymentData.status === "refunded") {
      return { kind: "already_revoked" };
    }

    const passCollection =
      paymentData.productType === "countPass"
        ? COUNT_PASSES
        : paymentData.productType === "timePass"
          ? TIME_PASSES
          : null;
    const passId =
      paymentData.productType === "countPass" ? paymentData.countPassId : paymentData.timePassId;

    let passStatusBefore: string | null = null;
    if (passCollection && passId) {
      const passRef = userRef.collection(passCollection).doc(passId);
      const passSnap = await tx.get(passRef);
      if (passSnap.exists) {
        passStatusBefore = (passSnap.data()?.status as string | undefined) ?? null;
        tx.update(passRef, { status: "refunded", refundedAt: now });
      }
    }

    // 사용자 문서의 활성 포인터가 회수된 이용권을 가리키고 있으면 같이 끊는다. 이걸 안 하면
    // 시간제는 activeTimePass.expiresAt이 남아있는 동안 계속 무제한으로 쓸 수 있다.
    const userSnap = await tx.get(userRef);
    const userData = userSnap.data() as
      | { activeCountPass?: { passId?: string } | null; activeTimePass?: { passId?: string } | null }
      | undefined;
    if (passId && userData?.activeCountPass?.passId === passId) {
      tx.update(userRef, { activeCountPass: null });
    }
    if (passId && userData?.activeTimePass?.passId === passId) {
      tx.update(userRef, { activeTimePass: null });
    }

    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: "포트원 취소 웹훅으로 자동 회수",
      refundedVia: "webhook",
    });

    return { kind: "revoked", uid, passStatusBefore };
  });
}
