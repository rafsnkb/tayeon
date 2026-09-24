// 영업일 계산 — 환불 처리 기한과 자동 승인 시점이 모두 이 단위를 쓴다.
//
// 법정 기한: 전자상거래법 제18조②2호 "청약철회등을 한 날부터 3영업일"(디지털콘텐츠).
// 자동 승인: 요청 후 2영업일(사용자 지정, 2026-09-24) — 법정 기한보다 최소 1영업일 앞선다.
//
// ⚠️ 공휴일은 계산하지 않는다 — 주말만 건너뛴다. 공휴일까지 빼면 실제 기한은 여기 계산보다
// **늦어지므로**, 이 값은 항상 실제보다 이르거나 같다(= 서둘러 처리하는 쪽). 반대 방향으로
// 틀리지 않게 일부러 이렇게 뒀다. 정확한 날짜가 필요하면 공휴일 달력이 있어야 한다.
/** 법정 환급 기한(전자상거래법 제18조②2호). */
export const REFUND_DUE_BUSINESS_DAYS = 3;

/** 사람이 손대지 않으면 자동 승인되기까지의 영업일. 법정 기한보다 짧아야 의미가 있다. */
export const REFUND_AUTO_APPROVE_BUSINESS_DAYS = 2;

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
