import { test } from "node:test";
import assert from "node:assert/strict";
import { monthChoices, dayCount, toBirthDate } from "./birthWheel.ts";

// 윤달은 있는 해가 정해져 있다. 없는 해를 "음력(윤달)"로 고르면 고를 달이 하나도 없는 것이
// 정상이고, 그 상태로 날짜를 만들어서는 안 된다 — 예전엔 "1996--NaN"이 저장됐다.
test("윤달이 없는 해는 고를 달이 없고 날짜도 만들어지지 않는다", () => {
  assert.deepEqual(monthChoices(1996, "lunarLeap"), []);
  assert.equal(toBirthDate(1996, 6, 1, "lunarLeap"), null);
  assert.deepEqual(monthChoices(1995, "lunarLeap"), [8]);
  assert.equal(toBirthDate(1995, 8, 1, "lunarLeap"), "1995-08-01");
  assert.equal(toBirthDate(1995, 7, 1, "lunarLeap"), null);
});

test("양력·음력 모두 12달을 고를 수 있다", () => {
  assert.equal(monthChoices(1996, "solar").length, 12);
  assert.equal(monthChoices(1996, "lunar").length, 12);
});

test("그 달에 없는 날은 마지막 날로 당겨진다", () => {
  assert.equal(toBirthDate(1995, 2, 31, "solar"), "1995-02-28");
  assert.equal(toBirthDate(1996, 2, 31, "solar"), "1996-02-29"); // 윤년
  assert.equal(toBirthDate(1995, 4, 31, "solar"), "1995-04-30");
  assert.equal(toBirthDate(1995, 1, 31, "solar"), "1995-01-31");
});

test("음력 달은 29 또는 30일까지다", () => {
  assert.equal(dayCount(1988, 9, "lunar"), 29);
  assert.equal(dayCount(1988, 8, "lunar"), 30);
  assert.equal(toBirthDate(1988, 9, 30, "lunar"), "1988-09-29");
  assert.equal(toBirthDate(1988, 9, 31, "lunar"), "1988-09-29");
});

test("숫자가 아닌 값이 들어와도 NaN 이 섞인 날짜를 만들지 않는다", () => {
  assert.equal(toBirthDate(1996, Number(""), 1, "solar"), null);
  assert.equal(toBirthDate(1996, Number("x"), 1, "solar"), null);
  assert.equal(toBirthDate(1996, 1, Number(""), "solar"), "1996-01-01");
  assert.equal(dayCount(1996, Number("x"), "solar"), 0);
});
