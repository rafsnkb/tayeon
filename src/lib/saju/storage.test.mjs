// `pageGateReason` — 페이지 N 을 지금 만들 수 있는가.
//
// 이 함수만 따로 테스트하는 이유는 **여기가 틀리면 증상이 정반대 두 가지로 갈린다**는 점이다.
// 너무 엄하면 사용자가 다음 페이지를 영영 못 보고, 너무 느슨하면 2단 생성이 앞 섹션을 못 받아
// 중복을 막는 장치가 조용히 무력해진다(§5·§6). Firestore 를 부르지 않는 순수 함수라 목이 없다.
import test from "node:test";
import assert from "node:assert/strict";
import { pageGateReason } from "./storage.ts";

/** 섹션 `count` 개짜리 골격만 있는 리포트. 게이트가 보는 건 status 와 섹션 수뿐이다. */
function reading(count, status = "generating") {
  return { status, outline: { sections: Array.from({ length: count }, (_, i) => ({ id: `s${i + 1}` })) } };
}

test("1번은 앞 페이지가 없어도 통과한다", () => {
  // 1번 앞에는 골격뿐이고 골격은 이 문서가 존재한다는 것 자체로 보장된다.
  assert.deepEqual(pageGateReason(reading(10), [], 1), { ok: true });
});

test("앞 페이지가 있으면 통과한다", () => {
  assert.deepEqual(pageGateReason(reading(10), [1], 2), { ok: true });
  assert.deepEqual(pageGateReason(reading(10), [1, 2, 3], 4), { ok: true });
});

test("앞 페이지가 없으면 missing 에 그 번호를 담아 거절한다", () => {
  // `missing` 이 정확해야 라우트가 "먼저 N 을 만들라"고 정확히 안내할 수 있다.
  assert.deepEqual(pageGateReason(reading(10), [], 2), {
    ok: false,
    reason: "missing_previous",
    missing: 1,
  });
  assert.deepEqual(pageGateReason(reading(10), [1, 2], 5), {
    ok: false,
    reason: "missing_previous",
    missing: 4,
  });
});

test("바로 앞 한 장만 본다 — 더 앞이 비어 있어도 통과한다", () => {
  // "N-1 이 있으면 1..N-1 이 전부 있다"가 재귀적으로 보장되므로 의도된 동작이다.
  // 이 성질 덕분에 저장 트랜잭션이 컬렉션 전체가 아니라 문서 하나만 읽고 끝낼 수 있다.
  assert.deepEqual(pageGateReason(reading(10), [4], 5), { ok: true });
});

test("실패 자리표가 있는 앞 페이지도 '존재'로 쳐서 통과한다", () => {
  // §9: 섹션 하나가 재시도까지 실패하면 그 자리에 자리표를 남기고 **뒤는 계속 읽게** 한다.
  // 게이트는 번호만 받으므로 본문인지 자리표인지 구분하지 않는다 — 그게 이 설계의 요점이다.
  // (자리표를 안 남기면 4번 실패 하나가 5~10번을 전부 막는다. 그게 고친 구멍이다.)
  assert.deepEqual(pageGateReason(reading(10), [3, 4], 5), { ok: true });
});

test("범위를 벗어난 번호는 out_of_range", () => {
  const r = reading(10);
  for (const n of [0, -1, 11, 999]) {
    assert.deepEqual(pageGateReason(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], n), {
      ok: false,
      reason: "out_of_range",
    });
  }
});

test("정수가 아닌 번호는 out_of_range", () => {
  // 라우트가 URL 조각을 `Number()` 로 바꿔 넘기므로 소수·NaN·Infinity 가 실제로 들어올 수 있다.
  const r = reading(10);
  for (const n of [1.5, NaN, Infinity, -Infinity]) {
    assert.deepEqual(pageGateReason(r, [1], n), { ok: false, reason: "out_of_range" });
  }
});

test("마지막 섹션 번호는 경계 안이다", () => {
  const saved = Array.from({ length: 9 }, (_, i) => i + 1);
  assert.deepEqual(pageGateReason(reading(10), saved, 10), { ok: true });
});

test("섹션이 0개면 어떤 번호도 만들 수 없다", () => {
  assert.deepEqual(pageGateReason(reading(0), [], 1), { ok: false, reason: "out_of_range" });
});

test("failed 리포트는 다른 무엇보다 먼저 막는다", () => {
  // 환불이 끝난 건이므로 더 생성되지도 읽히지도 않아야 한다. 범위 판정보다 앞이라는 것도
  // 계약이다 — 잘못된 번호로 물어도 "범위 밖"이 아니라 "실패한 건"이라고 답해야 라우트가
  // 사용자에게 엉뚱한 안내를 띄우지 않는다.
  assert.deepEqual(pageGateReason(reading(10, "failed"), [1], 2), {
    ok: false,
    reason: "reading_failed",
  });
  assert.deepEqual(pageGateReason(reading(10, "failed"), [], 99), {
    ok: false,
    reason: "reading_failed",
  });
});

test("complete 리포트는 막지 않는다", () => {
  // 총평까지 끝난 건이라 새로 만들 페이지는 없지만, 게이트가 막을 이유도 없다 —
  // 이미 저장된 페이지를 다시 읽는 경로가 이 판정을 지난다.
  assert.deepEqual(pageGateReason(reading(10, "complete"), [1], 2), { ok: true });
});
