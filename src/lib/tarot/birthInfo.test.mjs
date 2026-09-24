import test from "node:test";
import assert from "node:assert/strict";
import { toCalendarMode, isJasiRule, isBirthDateString, isBirthTimeString } from "./birthInfo.ts";

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

// 라우트가 이 검사에 기대므로 형식과 실재 여부를 둘 다 본다 — 휠이 한 번 "1996--NaN" 을
// 만들었고 서버는 그대로 저장했다(2026-09-25).
test("isBirthDateString 은 실재하는 YYYY-MM-DD 만 통과시킨다", () => {
  for (const ok of ["1996-01-31", "1996-02-29", "2026-12-01"]) {
    assert.equal(isBirthDateString(ok), true, ok);
  }
  for (const bad of [
    "1996--NaN", "1996-13-01", "1996-00-10", "1996-02-30", "1995-02-29",
    "96-01-01", "1996-1-1", "1996-01-01 ", "", null, undefined, 19960101,
  ]) {
    assert.equal(isBirthDateString(bad), false, String(bad));
  }
});

test("isBirthTimeString 은 24시간 HH:mm 만 통과시킨다", () => {
  for (const ok of ["00:00", "09:05", "23:59"]) assert.equal(isBirthTimeString(ok), true, ok);
  for (const bad of ["24:00", "9:05", "23:60", "0900", "", null, undefined]) {
    assert.equal(isBirthTimeString(bad), false, String(bad));
  }
});
