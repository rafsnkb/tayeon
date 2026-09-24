import { lunarToSolar, LUNAR_MIN_YEAR, LUNAR_MAX_YEAR } from "manseryeok";

/**
 * 음력 달력 조회. 사주 계산에 쓰는 `manseryeok` 이 이미 음력 표를 들고 있어서(1391~2100)
 * 따로 데이터를 넣을 필요가 없다 — 날짜 입력 휠이 음력일 때 그 달의 일수를 여기서 얻는다.
 *
 * 그 패키지에 "이 달은 며칠인가" 를 바로 주는 함수는 없다. 대신 `lunarToSolar` 가 범위를 벗어난
 * 날을 넘기면 **던진다**(예: 1988년 음력 9월에 30일을 넣으면 "1~29 범위여야 합니다"). 그래서
 * 30일이 있는지 물어보는 식으로 알아낸다. 진입점이 14KB 뿐이라 클라이언트에 실어도 된다.
 */

export { LUNAR_MIN_YEAR, LUNAR_MAX_YEAR };

/** 그 음력 달이 실제로 있는지. 없는 윤달(대부분의 달)은 여기서 걸린다. */
export function lunarMonthExists(year: number, month: number, isLeapMonth: boolean): boolean {
  try {
    lunarToSolar(year, month, 1, isLeapMonth);
    return true;
  } catch {
    return false;
  }
}

/** 음력 한 달의 일수(29 또는 30). 없는 달이면 0. */
export function lunarMonthDays(year: number, month: number, isLeapMonth: boolean): number {
  if (!lunarMonthExists(year, month, isLeapMonth)) return 0;
  try {
    lunarToSolar(year, month, 30, isLeapMonth);
    return 30;
  } catch {
    return 29;
  }
}

/**
 * 그 해에 윤달이 붙는 달들. 음력에는 윤달이 **한 해에 있어도 한 번**이고 없는 해가 더 많아서,
 * "음력(윤달)" 을 골랐을 때 달 목록을 이것으로 좁혀야 한다 — 그러지 않으면 있지도 않은
 * "윤3월" 같은 값이 저장된다.
 */
export function leapMonthsOf(year: number): number[] {
  const months: number[] = [];
  for (let month = 1; month <= 12; month++) {
    if (lunarMonthExists(year, month, true)) months.push(month);
  }
  return months;
}
