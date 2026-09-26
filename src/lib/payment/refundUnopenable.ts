// 열지 못한 사주 주문의 환불 — 설계 §9 "계산 실패·골격 실패 → 자동 전액 환불"의 실행부.
//
// `open.ts` 의 `openSajuReading` 이 `{ outcome: "refundable" }` 을 돌려주는 모든 경우가 여기로
// 온다(상품 정의 없음·판매 제약 위반·계산 실패·골격 3회 실패). 공통점은 하나 — 이 시점까지
// `createSajuReading` 이 한 번도 불리지 않았다. 즉 사용자는 아직 리포트를 한 글자도 읽지
// 못했고, §9 의 전액 환불 경계("사용자가 아직 아무것도 읽지 않았는가") 안에 논란 없이 들어간다.
//
// 라우트(`POST /api/saju/orders/{paymentId}/open`)는 이 함수 하나만 부른다 — 읽기용 라우트가
// 직접 포트원을 부르기 시작하면 그 권한 경계가 흐려진다. 포트원 취소·실패 알림·DB 되돌리기까지
// 전부 이 함수(=결제 계층) 책임이다. `fulfill.ts` 의 duplicate·coupon_conflict 처리와 같은 자리.
//
// ⚠️ 이 결제는 이미 **fulfilled 로 지급 확정된 뒤**다. duplicate·coupon_conflict 는 지급
// 트랜잭션 "안"에서 막지만(그 결제 문서는 애초에 만들어지지 않거나 blocked 상태로 만들어진다),
// 여기 오는 결제는 지급이 정상적으로 끝난 한참 뒤(사용자가 결과 화면에 들어왔을 때) 골격 생성이
// 실패해서 되돌리는 것이다. 그래서 되돌리는 항목(쿠폰 복원·주문 마커 refunded)은
// `revoke.ts`(취소 웹훅 반영) 와 같지만, 포트원 취소는 **이 함수가 직접 시작한다** — revoke.ts
// 는 이미 취소된 결제를 반영만 하는 반대 경우다.
//
// 리포트 문서는 없다 — 골격이 실패했으니 `createSajuReading` 이 불린 적이 없다. 그래서
// `markSajuReadingFailed` 를 부를 대상도 없다(정상이다).
import { adminDb } from "@/lib/firebase/admin";
import { portone } from "@/lib/payment/portone";
import { isAlreadyCancelled } from "@/lib/payment/fulfill";
import { notifyOwner } from "@/lib/notify/owner";
import { USERS, PAYMENTS, USER_DISCOUNT_COUPONS } from "@/lib/firestore/collections";
import { markSajuOrderRefunded, sajuOrderRef } from "@/lib/saju/storage";

/**
 * payments 문서의 상태만 보고 이 환불을 계속 진행해도 되는지 판정한다. Firestore 없이 멱등성
 * 분기를 테스트할 수 있도록 순수 함수로 뺐다 — `fulfill.ts` 의 `couponConflictReason`, `saju/
 * purchase.ts` 의 `openGateReason` 과 같은 이유.
 */
export function refundGateReason(
  status: string | undefined
): "proceed" | "already_refunded" | { notFulfilled: string } {
  if (status === "refunded") return "already_refunded";
  if (status !== "fulfilled") return { notFulfilled: String(status ?? "unknown") };
  return "proceed";
}

export type RefundUnopenableOutcome =
  /** 돈을 돌려줬다(DB 도 refunded 로 갱신됨). `alreadyCancelled` 는 포트원에서는 이미 취소돼
   *  있었고 여기서는 앱 상태만 맞춘 것인지(예: 이전 시도가 포트원 취소는 성공했는데 그 뒤
   *  네트워크가 끊겨 DB 갱신 전에 죽은 경우) 표시한다. */
  | { kind: "refunded"; alreadyCancelled: boolean }
  /** 포트원 취소 자체가 실패했다 — 돈은 아직 우리 쪽에 있고 DB 는 그대로 `fulfilled` 다.
   *  운영자에게 urgent 알림을 이미 보냈다. 사용자에게는 "환불이 지연되고 있다"로 보여줘야 한다. */
  | { kind: "cancel_failed" }
  /** 이미 이 함수(또는 다른 환불 경로)가 처리한 결제 — 멱등성. 화면이 실패 시 열기를
   *  재시도하면 여기로 두 번 올 수 있다(open.ts 머리말 "멱등하다"와 같은 이유). */
  | { kind: "already_refunded" }
  /** payments 문서가 없다 — 지급된 적 없는 결제다. `openGateReason` 이 `status:"paid"` 를
   *  요구하므로 정상 흐름에서는 오지 않는다(방어적으로만 다룬다). */
  | { kind: "not_found" }
  /** `fulfilled` 도 `refunded` 도 아닌 다른 상태(예: `duplicate_cancelled`) — 애초에 지급되지
   *  않았거나 이미 다른 경로로 처리된 결제다. 이 함수가 다룰 대상이 아니다. */
  | { kind: "not_fulfilled"; status: string };

/**
 * 열 수 없는 사주 주문을 환불한다 — 포트원 결제 취소 + 결제 문서 갱신 + 쿠폰 복원 + 주문 마커
 * 되돌림을 한 번에 끝낸다.
 *
 * 멱등하다. 화면이 열기를 재시도하면 이 경로에 두 번 올 수 있다 — `payments.status` 가
 * `fulfilled` 일 때만 진행하고, 이미 `refunded` 면 포트원을 다시 부르지 않고 그대로 알려준다.
 * 포트원 쪽이 "이미 취소됨"으로 답하는 경우(`isAlreadyCancelled`, fulfill.ts 의 duplicate 처리와
 * 같은 판정)도 실패로 보지 않는다.
 *
 * @param reason 왜 열 수 없었는지 — `openSajuReading` 이 돌려준 `refundable.reason` 을 그대로
 *   넘긴다. 포트원 취소 사유와 운영자 알림에 그대로 실린다.
 */
export async function refundUnopenableSajuOrder(
  uid: string,
  paymentId: string,
  reason: string
): Promise<RefundUnopenableOutcome> {
  const userRef = adminDb.collection(USERS).doc(uid);
  const paymentRef = userRef.collection(PAYMENTS).doc(paymentId);

  const paymentSnap = await paymentRef.get();
  const payment = paymentSnap.data() as { status?: string; couponCode?: string | null } | undefined;
  if (!paymentSnap.exists || !payment) return { kind: "not_found" };
  const gate = refundGateReason(payment.status);
  if (gate === "already_refunded") return { kind: "already_refunded" };
  if (gate !== "proceed") return { kind: "not_fulfilled", status: gate.notFulfilled };

  let alreadyCancelled = false;
  const cancelled = await portone
    .cancelPayment({ paymentId, reason: `사주 리포트를 열 수 없음(${reason}) — 자동 전액 환불` })
    .then(() => true)
    .catch((error) => {
      if (isAlreadyCancelled(error)) {
        alreadyCancelled = true;
        return true;
      }
      console.error("[saju] 열지 못한 주문 자동 환불 실패 — 수동 환불 필요", paymentId, error);
      return false;
    });

  if (!cancelled) {
    await notifyOwner({
      key: `saju-unopenable-refund-failed/${paymentId}`,
      level: "urgent",
      title: `🚨 사주 리포트 자동 환불 실패 · ${paymentId}`,
      fields: [
        ["결제", paymentId],
        ["사용자", uid],
        ["사유", reason],
      ],
      note: "**골격 생성에 실패해 환불하려 했지만 포트원 취소가 실패했습니다.** 돈은 받았고 줄 물건도 없는 상태입니다 — 포트원 콘솔에서 직접 취소해 주세요.",
    }).catch((error) => console.error("[saju] 자동 환불 실패 알림 실패", paymentId, error));
    return { kind: "cancel_failed" };
  }

  const now = new Date().toISOString();
  const couponCode = typeof payment.couponCode === "string" && payment.couponCode ? payment.couponCode : null;
  const couponRef = couponCode ? userRef.collection(USER_DISCOUNT_COUPONS).doc(couponCode) : null;

  await adminDb.runTransaction(async (tx) => {
    // 트랜잭션 안에서 다시 본다 — 위 조회와 여기 사이에 다른 재시도(멱등 호출)가 먼저
    // 끝냈을 수 있다. Firestore 트랜잭션은 모든 읽기가 모든 쓰기보다 먼저 와야 한다.
    const [freshPaymentSnap, couponSnap, sajuOrderSnap] = await Promise.all([
      tx.get(paymentRef),
      couponRef ? tx.get(couponRef) : Promise.resolve(null),
      tx.get(sajuOrderRef(uid, paymentId)),
    ]);
    if (freshPaymentSnap.data()?.status === "refunded") return;

    tx.update(paymentRef, {
      status: "refunded",
      refundedAt: now,
      refundReason: reason,
      refundedVia: "system",
      // 포트원에서 이미 취소돼 있던 건은 우리가 취소한 게 아니라 맞춘 것이다 — 정산 대조 때
      // 구분된다(admin/refundExecute.ts 와 같은 필드).
      refundReconciled: alreadyCancelled,
    });

    // 쿠폰 복원 — 환불했다고 쿠폰까지 잃으면 청약철회에 불이익을 붙이는 셈이 된다(전자상거래법
    // 제18조⑨·제35조, 대법원 2018다287034). fulfill.ts·revoke.ts·admin/refundExecute.ts 와
    // 같은 처리 — 환불 경로가 여럿이라 한 곳만 고치면 그 경로로 환불한 사람만 쿠폰을 잃는다.
    if (couponRef && couponSnap?.exists) {
      tx.update(couponRef, { status: "unused", usedPaymentId: null, usedAt: null, restoredAt: now });
    }

    // 마커를 내린다 — 안 내리면 이 환불된 결제로 그 뒤 열기 요청이 리포트를 만들어 준다
    // (`openGateReason` 의 "환불이 열기보다 먼저 온 경우"와 같은 구멍, `revoke.ts` 가 같은 이유로
    // 막고 있다). 리포트 문서는 없으므로 `markSajuReadingFailed` 는 부를 대상이 없다.
    //
    // `exists` 를 본다 — 이 함수는 항상 `openSajuReading` 이 마커를 읽어 판정한 뒤에 불리므로
    // 정상 흐름에서는 반드시 있지만, 없는 채로 `tx.update` 를 부르면 던진다(revoke.ts 와 같은
    // 방어 — 계정 탈퇴로 마커가 먼저 지워지는 것 같은 아주 드문 경합까지 견딘다).
    if (sajuOrderSnap.exists) {
      markSajuOrderRefunded(tx, uid, paymentId);
    }
  });

  return { kind: "refunded", alreadyCancelled };
}
