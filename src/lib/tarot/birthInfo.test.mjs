import test from "node:test";
import assert from "node:assert/strict";
import { toCalendarMode, isJasiRule } from "./birthInfo.ts";

// 2026-09-24: 궁합 화면의 사본이 `calendarType` 없는 상대를 음력으로 읽던 버그를 고치며 추가.
// Partner.calendarType 은 선택 필드라 이 필드가 생기기 전에 저장된 상대 정보는 undefined 다.
test("calendarType 이 없으면 양력으로 본다 (partnerToBirthInfo 의 ?? \"solar\" 와 같은 규칙)", () => {
  assert.equal(toCalendarMode(undefined), "solar");
  assert.equal(toCalendarMode(undefined, false), "solar");
  // 윤달 플래그가 남아 있어도 달력 종류가 음력이 아니면 양력이다 — 옛 데이터에서
  // isLeapMonth 만 true 로 남는 경우 화면이 음력으로 튀면 안 된다.
  assert.equal(toCalendarMode(undefined, true), "solar");
});

test("양력은 윤달 플래그와 무관하게 양력", () => {
  assert.equal(toCalendarMode("solar"), "solar");
  assert.equal(toCalendarMode("solar", true), "solar");
});

test("음력은 윤달 플래그로 갈린다", () => {
  assert.equal(toCalendarMode("lunar"), "lunar");
  assert.equal(toCalendarMode("lunar", false), "lunar");
  assert.equal(toCalendarMode("lunar", true), "lunarLeap");
});

test("isJasiRule 은 아는 자시법만 통과시킨다", () => {
  for (const rule of ["midnight", "jasi", "splitJasi"]) {
    assert.equal(isJasiRule(rule), true, rule);
  }
  for (const bad of ["Midnight", "", "zasi", null, undefined, 0, {}]) {
    assert.equal(isJasiRule(bad), false, String(bad));
  }
});
