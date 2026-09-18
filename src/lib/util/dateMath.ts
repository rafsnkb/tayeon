/** ISO 날짜에 개월 수를 더하되, 말일을 넘어가지 않게 클램프한다(예: 1월 31일 + 1개월 = 2월 28/29일).
 * 이용권 유효기간(fulfill.ts, referral/code.ts)과 받은 이용권 수령 가능 기간(pending-rewards)이
 * 공용으로 쓴다. */
export function addMonthsClamped(iso: string, months: number): string {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString();
}
