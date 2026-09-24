import { test } from "node:test";
import assert from "node:assert/strict";
import { lunarMonthDays, lunarMonthExists, leapMonthsOf } from "./lunarCalendar.ts";

// 음력 달은 29일 아니면 30일이다 — 양력 일수를 쓰면 없는 날이 입력된다.
test("음력 달의 일수는 29 또는 30이다", () => {
  for (let month = 1; month <= 12; month++) {
    const days = lunarMonthDays(1990, month, false);
    assert.ok(days === 29 || days === 30, `1990-${month} → ${days}`);
  }
});

test("1988년 음력 9월은 29일까지다", () => {
  assert.equal(lunarMonthDays(1988, 9, false), 29);
  assert.equal(lunarMonthDays(1988, 8, false), 30);
});

// 한 해의 길이로 표가 맞는지 확인한다. 윤달 없는 해는 353~355일이어야 한다.
test("윤달 없는 해의 총 일수는 353~355일이다", () => {
  let total = 0;
  for (let month = 1; month <= 12; month++) total += lunarMonthDays(1990, month, false);
  assert.ok(total >= 353 && total <= 355, `1990 총 ${total}일`);
});

test("윤달은 있는 해에만, 한 달에만 붙는다", () => {
  assert.deepEqual(leapMonthsOf(1987), [6]);
  assert.deepEqual(leapMonthsOf(2025), [6]);
  assert.deepEqual(leapMonthsOf(1988), []);
  for (const year of [1987, 1988, 1990, 2025, 2026]) {
    assert.ok(leapMonthsOf(year).length <= 1, `${year}년에 윤달이 둘 이상`);
  }
});

test("없는 윤달은 없다고 답한다", () => {
  assert.equal(lunarMonthExists(1988, 6, true), false);
  assert.equal(lunarMonthDays(1988, 6, true), 0);
  assert.equal(lunarMonthExists(1987, 6, true), true);
});
