import type { CalendarMode } from "@/lib/tarot/birthInfo";
import { leapMonthsOf, lunarMonthDays } from "@/lib/tarot/lunarCalendar";

/**
 * 생년월일 휠(FormControls 의 `BirthDateField`)이 고를 수 있는 값을 정하는 계산. 화면에서
 * 떼어 낸 이유는 **여기가 조용히 틀리는 자리**라서다 — 달마다 일수가 다르고, 음력은 29/30 이고,
 * 윤달은 있는 해가 정해져 있다. 화면 안에 두면 눈으로 돌려 보지 않는 한 확인할 방법이 없다.
 */

export const BIRTH_YEAR_MIN = 1930;

/** 고를 수 있는 달. "음력(윤달)" 이면 **그 해에 실제로 윤달이 붙는 달만** 이다 — 1930~2100 중
 *  대부분의 해에는 아예 없어서 빈 배열이 정상적인 답이다(1996·1997·1999·2000 모두 없다). */
export function monthChoices(year: number, mode: CalendarMode): number[] {
  if (mode === "lunarLeap") return leapMonthsOf(year);
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

/** 양력 그 달의 날 수. `Date.UTC(y, m, 0)` 은 m 월의 0 일 = (m-1)월의 마지막 날이다. */
function solarDayCount(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 고를 수 있는 일수. 없는 달이면 0 이다(윤달이 없는 해의 윤달). */
export function dayCount(year: number, month: number, mode: CalendarMode): number {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 0;
  if (mode === "solar") return solarDayCount(year, month);
  // 음력 일수를 모르면(범위 밖 연도 등) 양력 일수로 물러난다 — 휠이 빈 칸이 되는 것보다 낫다.
  return lunarMonthDays(year, month, mode === "lunarLeap") || solarDayCount(year, month);
}

/**
 * 휠에서 고른 세 값을 저장 형식(`YYYY-MM-DD`)으로 만든다. 없는 날짜면 **null** 을 준다.
 *
 * 그냥 이어 붙이면 안 된다. 앞 칸을 고친 뒤에는 뒤 칸이 그 달에 없는 날일 수 있고(1 월 31 일에서
 * 2 월로 옮기면 31 일), 윤달이 없는 해를 "음력(윤달)" 로 고르면 **고를 달 자체가 없다**.
 * 예전에는 그 경우 `Number("")` 가 그대로 흘러 `"1996--NaN"` 이 저장됐다 — 서버도 형식을
 * 보지 않아서(2026-09-25) 그대로 남고, 사주 계산과 생일 기념 무료 이용권이 그 값을 받았다.
 */
export function toBirthDate(
  year: number,
  month: number,
  day: number,
  mode: CalendarMode,
): string | null {
  if (!monthChoices(year, mode).includes(month)) return null;
  const last = dayCount(year, month, mode);
  if (last === 0) return null;
  const clamped = Math.min(Math.max(day, 1), last);
  if (!Number.isFinite(clamped)) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(clamped)}`;
}
