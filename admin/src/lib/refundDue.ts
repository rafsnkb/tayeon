// ⚠️ 본체의 src/lib/util/businessDays.ts 와 같은 규칙을 손으로 맞춰 유지한다 — admin 은
// 타연 본체와 완전히 분리된 별도 앱이라 그 파일을 import 할 수 없다. 한쪽을 고치면
// 다른 쪽도 같이 고칠 것(두 파일 모두 자체 테스트가 있다).
/** 환불 마감 계산 — 전자상거래법 제18조②2호.
 *
 * 타연이 파는 이용권은 디지털콘텐츠이므로 같은 항 2호가 적용된다: **"청약철회등을 한 날부터
 * 3영업일 이내"**. 기준은 결제일이 아니라 **환불 요청일**이다. 넘기면 같은 항 후단의
 * 지연배상금(연 40% 이내에서 시행령이 정하는 이율) 대상이 된다.
 *
 * ⚠️ 공휴일은 계산하지 않는다 — 주말만 건너뛴다. 공휴일까지 빼면 실제 마감은 여기 표시된
 * 날짜보다 **늦어지므로**, 이 값은 항상 실제보다 이르거나 같다(= 서둘러 처리하게 되는 쪽).
 * 반대 방향으로 틀리지 않게 일부러 이렇게 뒀다. 정확한 마감이 필요하면 공휴일 달력이 필요하다.
 */
export const REFUND_DUE_BUSINESS_DAYS = 3;

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** `from` 부터 영업일 `count` 일 뒤의 같은 시각. 시작일 자체는 세지 않는다. */
export function addBusinessDays(from: Date, count: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < count) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added += 1;
  }
  return result;
}

export type RefundDue = {
  dueAt: Date;
  /** 남은 영업일. 0이면 오늘이 마감, 음수면 이미 지났다. */
  businessDaysLeft: number;
  overdue: boolean;
};

/** 요청 시각으로부터의 환불 마감과 남은 영업일. */
export function refundDue(requestedAt: string, now: Date = new Date()): RefundDue | null {
  const requested = new Date(requestedAt);
  if (Number.isNaN(requested.getTime())) return null;
  const dueAt = addBusinessDays(requested, REFUND_DUE_BUSINESS_DAYS);

  // 남은 영업일은 "오늘부터 마감일까지"로 센다 — 시각이 아니라 날짜 단위라야 "D-2" 가 된다.
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let cursor = startOfDay(now);
  const due = startOfDay(dueAt);
  if (cursor > due) return { dueAt, businessDaysLeft: -1, overdue: true };
  let left = 0;
  while (cursor < due) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    if (isBusinessDay(cursor)) left += 1;
  }
  return { dueAt, businessDaysLeft: left, overdue: false };
}
