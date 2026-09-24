// ⚠️ 본체의 src/lib/payment/refundRisk.ts 와 같은 규칙을 손으로 맞춰 유지한다 — admin 은
// 타연 본체와 완전히 분리된 별도 앱이라 그 파일을 import 할 수 없다. 본체 쪽에 테스트가
// 있으니(refundRisk.test.mjs) 조건을 바꾸면 양쪽과 테스트를 함께 고칠 것.
// 환불 요청을 사람 확인 없이 자동 승인해도 되는지 판정한다.
//
// 순수 함수다 — 포트원도 Firestore도 모른다. 호출부가 필요한 값을 모아서 넘기고, 여기서는
// "이 조합이면 보류"만 결정한다. 돈을 자동으로 움직이는 판단이라 테스트로 고정해 둔다
// (refundRisk.test.mjs).
//
// 보류(hold)가 곧 거절은 아니다. 자동 승인만 멈추고 운영자에게 넘긴다 — 법정 기한(청약철회일
// 부터 3영업일)은 계속 흐르므로, 보류된 건은 알림에서 눈에 띄어야 한다.

export type RefundRiskInput = {
  /** 이용권 문서의 현재 상태. 신청 시 refund_pending 으로 잠긴다. */
  passStatus: string | undefined;
  /** 포트원에서 재조회한 결제 상태. */
  paymentStatus: string | undefined;
  /** 포트원 결제 금액과 우리가 기록한 금액. */
  paidAmount: number | undefined;
  recordedAmount: number | undefined;
  /** 결제 시각과 환불 요청 시각(ISO). */
  paidAt: string | undefined;
  requestedAt: string;
  /** 이 사용자의 다른 환불 요청 시각 목록(이번 건 제외, ISO). */
  otherRequestedAt: string[];
};

export type RefundRisk = { hold: boolean; reasons: string[] };

/** 결제 직후 환불은 사람이 한 번 보는 게 낫다 — 결제 테스트나 오조작일 수 있다. */
const IMMEDIATE_REFUND_MINUTES = 10;
/** 최근 이 기간 안에 이 횟수 이상 환불을 요청하면 반복 환불로 본다. */
const REPEAT_WINDOW_DAYS = 3;
const REPEAT_THRESHOLD = 2;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function assessRefundRisk(input: RefundRiskInput): RefundRisk {
  const reasons: string[] = [];
  const requested = Date.parse(input.requestedAt);

  if (input.passStatus !== "refund_pending") {
    reasons.push(`이용권 상태가 refund_pending 이 아님(현재: ${input.passStatus ?? "없음"})`);
  }
  if (input.paymentStatus !== "PAID") {
    reasons.push(`결제 상태가 PAID 가 아님(현재: ${input.paymentStatus ?? "조회 실패"})`);
  }
  if (
    typeof input.paidAmount !== "number" ||
    typeof input.recordedAmount !== "number" ||
    input.paidAmount !== input.recordedAmount
  ) {
    reasons.push(`결제 금액이 기록과 다름(포트원 ${input.paidAmount ?? "?"} / 기록 ${input.recordedAmount ?? "?"})`);
  }

  const paid = Date.parse(input.paidAt ?? "");
  if (Number.isFinite(paid) && Number.isFinite(requested)) {
    const elapsed = requested - paid;
    if (elapsed >= 0 && elapsed < IMMEDIATE_REFUND_MINUTES * MINUTE) {
      reasons.push(`결제 후 ${Math.max(1, Math.round(elapsed / MINUTE))}분 만에 환불 요청`);
    }
  }

  if (Number.isFinite(requested)) {
    const recent = input.otherRequestedAt.filter((iso) => {
      const t = Date.parse(iso);
      return Number.isFinite(t) && requested - t >= 0 && requested - t <= REPEAT_WINDOW_DAYS * DAY;
    });
    // 이번 건을 포함해 세므로 +1 한다.
    if (recent.length + 1 >= REPEAT_THRESHOLD) {
      reasons.push(`최근 ${REPEAT_WINDOW_DAYS}일 내 환불 요청 ${recent.length + 1}건`);
    }
  }

  return { hold: reasons.length > 0, reasons };
}
