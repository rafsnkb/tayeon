import type { DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { revokeSajuReading } from "@/lib/revokeSajuReading";
import { portone } from "@/lib/payment/portone";
import { notifyOwner } from "@/lib/notifyOwner";
import { isWithinRefundWindow } from "@/lib/refundWindow";

export { REFUND_WINDOW_MS } from "@/lib/refundWindow";

export type RefundExecuteResult =
  /** `alreadyCancelled` 면 포트원에서는 이미 취소돼 있었고 여기서는 앱 상태만 맞춘 것이다. */
  | { ok: true; cancellation: unknown; alreadyCancelled: boolean }
  | { ok: false; status: number; error: string };

/**
 * 사주 리포트 결제의 환불. 이용권 회수가 없는 대신 **리포트를 잠근다.**
 *
 * 잠그는 일은 본체 창구(`/api/internal/saju/revoke`)가 한다 — 주문 마커를 내리고 리포트를
 * `failed` 로 만드는 걸 한 트랜잭션으로 묶는 로직을 어드민에 복사하면 두 벌이 되고, 본체의
 * 취소 웹훅 경로(`src/lib/payment/revoke.ts`)와 어긋나는 날 **어느 경로로 환불했는지에 따라
 * 리포트가 잠기거나 안 잠긴다.** 그래서 `revokeSajuReading.ts` 가 창구만 부른다.
 *
 * 순서가 중요하다: **돈을 돌려준 뒤에 잠근다.** 반대로 하면 잠갔는데 취소가 실패해서 "돈은
 * 그대로인데 못 읽는" 상태가 된다 — 사용자가 잃는 쪽이다. 지금 순서에서 창구가 실패하면
 * "환불됐는데 아직 읽히는" 상태인데, 그건 운영자가 손으로 막을 수 있으므로 urgent 로 부른다.
 */
async function refundSajuReport(args: {
  uid: string;
  paymentId: string;
  reason: string;
  approvedBy: string | null;
  couponCode: string | null;
  refundRequestRef: DocumentReference;
  paymentRef: DocumentReference;
  userRef: DocumentReference;
}): Promise<RefundExecuteResult> {
  const { uid, paymentId, reason } = args;

  let cancellation: unknown = null;
  let alreadyCancelled = false;
  try {
    const response = await portone.cancelPayment({ paymentId, reason });
    cancellation = response.cancellation;
  } catch (error) {
    if (isAlreadyCancelled(error)) {
      console.warn("[refund] 포트원에서 이미 취소된 결제 — 앱 상태만 맞춘다", paymentId);
      alreadyCancelled = true;
    } else {
      console.error("[refund] cancelPayment 실패", paymentId, error);
      return { ok: false, status: 502, error: error instanceof Error ? error.message : "포트원 결제 취소에 실패했어요." };
    }
  }

  const approvedByEmail = args.approvedBy
    ? await adminAuth.getUser(args.approvedBy).then((u) => u.email ?? null).catch(() => null)
    : null;
  const now = new Date().toISOString();
  const couponRef = args.couponCode ? args.userRef.collection("discountCoupons").doc(args.couponCode) : null;

  await adminDb.runTransaction(async (tx) => {
    const [refundRequestSnap, couponSnap] = await Promise.all([
      tx.get(args.refundRequestRef),
      couponRef ? tx.get(couponRef) : Promise.resolve(null),
    ]);
    tx.update(args.paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedByUid: args.approvedBy,
      refundedByEmail: approvedByEmail,
      refundedVia: args.approvedBy ? "admin" : "auto",
      refundReconciled: alreadyCancelled,
    });
    // 쿠폰 복원 — 이용권 경로와 같은 이유(전자상거래법 제18조⑨·제35조). 상품 종류와 무관하다.
    if (couponRef && couponSnap?.exists) {
      tx.update(couponRef, { status: "unused", usedPaymentId: null, usedAt: null, restoredAt: now });
    }
    if (refundRequestSnap.exists && refundRequestSnap.data()?.status === "pending") {
      tx.update(args.refundRequestRef, {
        status: "approved",
        approvedAt: now,
        approvedByUid: args.approvedBy,
        approvedVia: args.approvedBy ? "admin" : "auto",
      });
    }
  });

  // `locked: false` 는 실패가 아니다 — 아직 열지 않은 건이면 잠글 리포트가 없고, 그때 창구는
  // 주문 마커만 내려 그 뒤의 열기 요청을 막는다(revokeSajuReading.ts 주석 참고).
  const revoked = await revokeSajuReading(uid, paymentId, reason);
  if (!revoked.ok) {
    console.error("[refund] 사주 리포트 잠금 창구 실패 — 수동 처리 필요", paymentId, revoked.reason);
    await notifyOwner({
      key: `saju-revoke-failed/${paymentId}`,
      level: "urgent",
      title: "환불된 사주 리포트가 잠기지 않음 — 확인 필요",
      fields: [
        ["결제", paymentId],
        ["사용자", uid],
        ["실패 사유", revoked.reason],
      ],
      note: "**환불은 끝났지만 리포트가 계속 읽히는 상태입니다.** 본체 창구가 응답하지 않았습니다 — 해당 리포트를 직접 잠가 주세요.",
    }).catch((error) => console.error("[refund] 사주 잠금 실패 알림 실패", paymentId, error));
  }

  return { ok: true, cancellation, alreadyCancelled };
}

/** 포트원이 "이미 취소된 결제"라고 답했는지. 운영자가 포트원 콘솔에서 직접 취소했거나, 취소는
 *  됐는데 웹훅이 우리 쪽에 닿지 못한 경우다(로컬 개발 중에는 웹훅이 아예 못 온다).
 *
 *  이건 실패가 아니다 — 돈은 이미 돌아갔고 앱 기록만 뒤처진 상태라, 그대로 오류를 내면
 *  이용권이 refund_pending 에 갇혀 사용자는 쓰지도 사지도 못한다(2026-09-24). */
function isAlreadyCancelled(error: unknown): boolean {
  const data = (error as { data?: { type?: unknown } })?.data;
  if (data?.type === "PAYMENT_ALREADY_CANCELLED") return true;
  // 타입이 안 잡히는 경로(래핑된 에러 등)를 위한 보조 판정.
  return /already cancelled/i.test(error instanceof Error ? error.message : String(error));
}

/** 환불을 실제로 실행한다 — 포트원 결제 취소 + 결제·이용권·환불요청 문서 갱신.
 *
 *  운영자가 어드민에서 누르는 경로와 2영업일 뒤 자동 승인이 같은 함수를 쓴다. 예전에는 라우트
 *  안에 인라인으로 있었는데, 자동 승인이 생기면서 "돈을 움직이는 코드"가 두 벌이 될 뻔했다
 *  (2026-09-24 분리).
 *
 *  `approvedBy` 가 null 이면 자동 승인이다 — 문서에 사람 uid 대신 그 사실을 남긴다. */
export async function executeRefund(input: {
  uid: string;
  paymentId: string;
  reason: string;
  approvedBy: string | null;
}): Promise<RefundExecuteResult> {
  const { uid, paymentId, reason } = input;
  const userRef = adminDb.collection("users").doc(uid);
  const paymentRef = userRef.collection("payments").doc(paymentId);
  const refundRequestRef = adminDb.collection("refundRequests").doc(paymentId);
  const [paymentSnap, requestSnap] = await Promise.all([paymentRef.get(), refundRequestRef.get()]);
  if (!paymentSnap.exists) return { ok: false, status: 404, error: "존재하지 않는 결제 건이에요." };

  const payment = paymentSnap.data() as {
    status: string;
    // "sajuReport" 는 사주·자미두수 유료 리포트다. 이용권이 아니라 **리포트 한 편**을 파는
    // 상품이라 회수할 이용권 문서가 없고, 대신 리포트를 잠근다(아래 sajuReport 분기).
    productType: "countPass" | "timePass" | "coin" | "sajuReport";
    countPassId: string | null;
    timePassId: string | null;
    paidAt: string;
    /** 이 결제에 쓴 할인쿠폰 코드(없으면 null). 환불 시 되돌린다 — 아래 "쿠폰 복원" 참고. */
    couponCode?: string | null;
  };
  const request = requestSnap.data();
  const pendingRequest = requestSnap.exists && request?.status === "pending" ? request : null;

  if (payment.status !== "fulfilled") {
    // 이미 환불된 결제인데 요청만 대기로 남아 있는 경우가 있다 — 포트원 콘솔에서 직접 취소하면
    // 취소 웹훅이 결제를 refunded 로 바꾸지만 refundRequests 문서는 건드리지 않기 때문이다.
    // 여기서 그냥 409 를 내면 그 요청은 영영 pending 에 갇히고, 사용자 화면에도 "환불 대기 중"
    // 으로 남는다. 돈은 이미 돌아갔으니 요청만 완료로 맞춰 준다(2026-09-24).
    if (payment.status === "refunded" && pendingRequest) {
      await refundRequestRef.update({
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedByUid: input.approvedBy,
        approvedVia: input.approvedBy ? "admin" : "auto",
        // 우리가 취소한 게 아니라 이미 취소돼 있던 것을 맞춘 것 — 정산 대조 때 구분된다.
        refundReconciled: true,
      });
      return { ok: true, cancellation: null, alreadyCancelled: true };
    }
    return { ok: false, status: 409, error: `이미 처리된 결제예요(status=${payment.status}).` };
  }

  // 7일 기산점은 **사용자가 청약철회를 행사한 시각**이지 운영자가 버튼을 누른 시각이 아니다.
  //
  // 예전엔 여기서도 Date.now() 로 쟀는데, 그러면 신청은 받아 놓고 승인은 거부하는 구간이
  // 생긴다 — 신청 접수는 결제 후 7일까지 열려 있고(src/app/api/user/refund-requests/route.ts:27)
  // 자동 승인은 접수로부터 2영업일 뒤에 돈다. 금요일(4일차)에 신청하면 화요일(8일차)에 승인이
  // 시도되고 이 검사가 409 를 낸다. 그러면 이용권은 refund_pending 에 영구히 갇혀 쓰지도,
  // 다시 사지도, 다시 신청하지도 못하는 상태가 된다(2026-09-24 발견).
  //
  // 전자상거래법도 같은 구조다 — 제17조①의 7일은 청약철회를 "할 수 있는" 기간이고,
  // 제18조②2호의 3영업일은 "청약철회한 날"부터 사업자가 환급해야 하는 기간이다. 신청이
  // 기간 안에 들어왔다면 처리가 늦어졌다는 이유로 거절할 근거가 없다.
  const exercisedAt = pendingRequest && typeof pendingRequest.requestedAt === "string"
    ? Date.parse(pendingRequest.requestedAt)
    : Date.now();
  if (!isWithinRefundWindow(payment.paidAt, exercisedAt)) {
    return { ok: false, status: 409, error: "결제 후 7일 이내의 이용권만 환불할 수 있어요." };
  }

  // 사주 리포트는 회수할 이용권 문서가 없다 — 아래 이용권 관문을 그대로 통과시키면 `passCollection`
  // 이 null 이라 409 로 막혀 **환불 자체가 불가능해진다.** 그래서 여기서 갈라 나간다.
  //
  // ⚠️ 사주의 환불 자격 판정은 이용권과 다르다. 설계 §9 는 경계를 **"사용자가 아직 아무것도
  // 읽지 않았는가"** 로 정했는데(읽은 뒤의 전액 환불은 부적절), 그 판정은 여기 없다 —
  // 정책·화면과 같이 정할 일이라 발명하지 않았다. 지금은 위 7일 창(`isWithinRefundWindow`)만
  // 적용되고, **이미 읽은 리포트도 운영자가 승인하면 환불된다.** 그 판정이 정해지면 이 분기에
  // 넣을 것.
  if (payment.productType === "sajuReport") {
    return refundSajuReport({
      uid,
      paymentId,
      reason,
      approvedBy: input.approvedBy ?? null,
      couponCode: typeof payment.couponCode === "string" && payment.couponCode ? payment.couponCode : null,
      refundRequestRef,
      paymentRef,
      userRef,
    });
  }

  const passCollection =
    payment.productType === "countPass" ? "countPasses" : payment.productType === "timePass" ? "timePasses" : null;
  const passId = payment.productType === "countPass" ? payment.countPassId : payment.timePassId;
  if (!passCollection || !passId) {
    return { ok: false, status: 409, error: "현재 판매하지 않는 상품이거나 이용권 정보를 찾을 수 없어요." };
  }
  const passRef = userRef.collection(passCollection).doc(passId);
  const passSnap = await passRef.get();
  // 사용자가 환불을 신청하면 이용권이 즉시 refund_pending 으로 잠긴다(2026-09-24). 그 상태도
  // "한 번도 안 쓴" 것이므로 승인 대상이다 — unused 만 보면 사용자 요청 건을 승인할 수 없다.
  const passStatus = passSnap.data()?.status;
  if (!passSnap.exists || (passStatus !== "unused" && passStatus !== "refund_pending")) {
    return { ok: false, status: 409, error: "한 번도 사용하거나 활성화하지 않은 이용권만 환불할 수 있어요." };
  }

  let cancellation: unknown = null;
  let alreadyCancelled = false;
  try {
    const response = await portone.cancelPayment({ paymentId, reason });
    cancellation = response.cancellation;
  } catch (error) {
    if (isAlreadyCancelled(error)) {
      console.warn("[refund] 포트원에서 이미 취소된 결제 — 앱 상태만 맞춘다", paymentId);
      alreadyCancelled = true;
    } else {
      console.error("[refund] cancelPayment 실패", paymentId, error);
      return { ok: false, status: 502, error: error instanceof Error ? error.message : "포트원 결제 취소에 실패했어요." };
    }
  }

  const approvedByEmail = input.approvedBy
    ? await adminAuth.getUser(input.approvedBy).then((u) => u.email ?? null).catch(() => null)
    : null;
  const now = new Date().toISOString();

  // 돈이 이미 돌아간 뒤에 이용권 상태가 바뀌어 있었다면 그 사실을 운영자가 알아야 한다.
  let touchedStatus: string | null = null;

  await adminDb.runTransaction(async (tx) => {
    // Firestore 트랜잭션은 모든 읽기가 모든 쓰기보다 먼저 와야 한다 — 읽기를 여기서 끝낸다.
    // 이 결제에 할인쿠폰을 썼다면 되돌려 준다. 컬렉션 이름은 본체(src/lib/firestore/collections.ts
    // 의 USER_DISCOUNT_COUPONS)와 같아야 한다 — admin 은 별도 앱이라 상수를 공유하지 않는다.
    const couponCode = typeof payment.couponCode === "string" && payment.couponCode ? payment.couponCode : null;
    const couponRef = couponCode ? userRef.collection("discountCoupons").doc(couponCode) : null;
    const [refundRequestSnap, userSnap, txPassSnap, couponSnap] = await Promise.all([
      tx.get(refundRequestRef),
      tx.get(userRef),
      tx.get(passRef),
      couponRef ? tx.get(couponRef) : Promise.resolve(null),
    ]);
    // 위 상태 검사와 여기 사이에는 포트원 취소(네트워크)와 Auth 조회가 끼어 있어서 수백
    // 밀리초가 지난다. 그 사이에 사용자가 시간제 이용권을 활성화하면 "돈은 돌려받고 이용권도
    // 쓰는" 상태가 만들어진다(2026-09-24).
    //
    // 여기서 중단하지는 않는다 — 결제는 이미 취소됐고, 되돌릴 방법이 없다. 중단하면 돈만
    // 나가고 이용권은 살아 있는, 정확히 막으려던 그 상태가 된다. revoke.ts 와 같은 원칙으로
    // 상태와 무관하게 회수하고 이상 징후로 남긴다.
    const txPassStatus = txPassSnap.data()?.status;
    if (txPassStatus !== "unused" && txPassStatus !== "refund_pending") {
      touchedStatus = typeof txPassStatus === "string" ? txPassStatus : "없음";
    }
    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedByUid: input.approvedBy,
      refundedByEmail: approvedByEmail,
      refundedVia: input.approvedBy ? "admin" : "auto",
      // 포트원에서 이미 취소돼 있던 건은 우리가 취소한 게 아니라 맞춘 것이다 — 나중에
      // 정산을 대조할 때 구분이 된다.
      refundReconciled: alreadyCancelled,
      // 회수 직전에 이용권이 이미 다른 상태였다면 남긴다(정상이면 null).
      passStatusAtRefund: touchedStatus,
    });
    tx.update(passRef, { status: "refunded" });

    // 쿠폰 복원 — 환불했다고 쿠폰까지 잃게 하면 청약철회에 불이익을 붙이는 셈이 된다
    // (전자상거래법 제18조⑨·제35조, 대법원 2018다287034). 조건 없이 되돌린다: 유효기간은
    // 쿠폰의 것이라 이미 지났으면 되돌려도 어차피 못 쓴다.
    // 같은 처리가 본체의 취소 웹훅 경로(src/lib/payment/revoke.ts)에도 있다 — 환불 경로가 둘이라
    // 양쪽에 넣어야 한다. 한쪽만 고치면 그 경로로 환불한 사람만 쿠폰을 잃는다.
    if (couponRef && couponSnap?.exists) {
      tx.update(couponRef, { status: "unused", usedPaymentId: null, usedAt: null, restoredAt: now });
    }

    // 사용자 문서의 활성 포인터가 방금 회수한 이용권을 가리키고 있으면 같이 끊는다.
    // 안 끊으면 시간제는 activeTimePass.expiresAt 이 남아 있는 동안 계속 무제한으로 쓸 수
    // 있다 — 취소 웹훅 경로(src/lib/payment/revoke.ts)는 같은 이유로 이미 끊고 있었고,
    // 돈이 돌아간 뒤에도 쓸 수 있는 상태만은 어떤 경로로도 만들지 않는다(2026-09-24).
    const userData = userSnap.data() as
      | { activeCountPass?: { passId?: string } | null; activeTimePass?: { passId?: string } | null }
      | undefined;
    if (userData?.activeCountPass?.passId === passId) tx.update(userRef, { activeCountPass: null });
    if (userData?.activeTimePass?.passId === passId) tx.update(userRef, { activeTimePass: null });

    // 사용자 요청에서 시작한 건은 PG 취소와 동일한 트랜잭션에서 완료 처리한다. 취소는 됐는데
    // 요청만 대기 상태로 남는 운영상 혼선을 방지한다.
    if (refundRequestSnap.exists && refundRequestSnap.data()?.status === "pending") {
      tx.update(refundRequestRef, {
        status: "approved",
        approvedAt: now,
        approvedByUid: input.approvedBy,
        approvedVia: input.approvedBy ? "admin" : "auto",
      });
    }
  });

  if (touchedStatus) {
    console.error("[refund] 취소 직전에 이용권 상태가 바뀌어 있었다 — 경위 확인 필요", paymentId, touchedStatus);
    await notifyOwner({
      key: `refund-pass-touched/${paymentId}`,
      level: "urgent",
      title: "환불 중 이용권 상태가 바뀜 — 확인 필요",
      fields: [
        ["결제", paymentId],
        ["사용자", uid],
        ["회수 직전 상태", touchedStatus],
      ],
      note: "**결제는 취소됐고 이용권도 회수했습니다.** 다만 취소와 회수 사이에 이용권이 활성화/사용된 흔적이 있습니다 — 실제로 쓰였는지 확인해 주세요.",
    }).catch((error) => console.error("[refund] 이상 징후 알림 실패", paymentId, error));
  }

  return { ok: true, cancellation, alreadyCancelled };
}
