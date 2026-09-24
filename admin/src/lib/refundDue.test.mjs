import test from "node:test";
import assert from "node:assert/strict";
import { refundDue, addBusinessDays } from "./refundDue.ts";

// 전자상거래법 제18조②2호의 "청약철회한 날부터 3영업일" 마감을 계산한다. 넘기면 지연배상금
// 대상이라 날짜를 틀리면 안 되는데 요일 계산은 조용히 틀리기 쉬워서 못 박아 둔다(2026-09-24).
//
// 기준 달력: 2026-09-24(목) 25(금) 26(토) 27(일) 28(월) 29(화) 30(수), 10-01(목) 02(금)

const at = (ymd) => new Date(`${ymd}T10:00:00`);

test("주말을 건너뛰고 3영업일 뒤가 마감이다", () => {
  const cases = [
    ["2026-09-24", "2026-09-29"], // 목 → 금·월·화
    ["2026-09-25", "2026-09-30"], // 금 → 월·화·수
    ["2026-09-28", "2026-10-01"], // 월 → 화·수·목
  ];
  for (const [req, due] of cases) {
    const r = refundDue(at(req).toISOString(), at(req));
    assert.equal(r.dueAt.toISOString().slice(0, 10), due, req);
  }
});

test("주말에 접수된 요청도 다음 영업일부터 센다", () => {
  // 토·일에 들어온 요청은 월·화·수를 세므로 둘 다 수요일이 마감이다.
  for (const req of ["2026-09-26", "2026-09-27"]) {
    const r = refundDue(at(req).toISOString(), at(req));
    assert.equal(r.dueAt.toISOString().slice(0, 10), "2026-09-30", req);
  }
});

test("남은 영업일은 오늘을 기준으로 줄어든다", () => {
  const req = at("2026-09-24").toISOString();
  assert.equal(refundDue(req, at("2026-09-24")).businessDaysLeft, 3);
  assert.equal(refundDue(req, at("2026-09-25")).businessDaysLeft, 2);
  // 주말에는 남은 영업일이 줄지 않는다 — 금요일과 같은 2일.
  assert.equal(refundDue(req, at("2026-09-26")).businessDaysLeft, 2);
  assert.equal(refundDue(req, at("2026-09-28")).businessDaysLeft, 1);
  assert.equal(refundDue(req, at("2026-09-29")).businessDaysLeft, 0);
});

test("마감일 당일은 아직 지난 게 아니다", () => {
  const req = at("2026-09-24").toISOString();
  assert.equal(refundDue(req, at("2026-09-29")).overdue, false);
  assert.equal(refundDue(req, at("2026-09-30")).overdue, true);
  assert.equal(refundDue(req, at("2026-10-05")).overdue, true);
});

test("요청 시각이 깨져 있으면 null 을 준다 (배지를 그리지 않는다)", () => {
  assert.equal(refundDue("", at("2026-09-24")), null);
  assert.equal(refundDue("어제", at("2026-09-24")), null);
});

test("addBusinessDays 는 시작일 자체를 세지 않는다", () => {
  // 목요일에서 1영업일 뒤는 금요일이다.
  assert.equal(addBusinessDays(at("2026-09-24"), 1).getDay(), 5);
  // 금요일에서 1영업일 뒤는 토·일을 건너뛴 월요일이다.
  assert.equal(addBusinessDays(at("2026-09-25"), 1).getDay(), 1);
});
