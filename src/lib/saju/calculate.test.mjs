// 신살(도화·역마) 판정과 오행 개수 집계 — 계산 규칙만 검증한다. 실제 만세력 날짜 연산은
// `calculateSaju`(→ manseryeok)의 몫이라 여기서는 안 건드린다; 대신 이미 계산된 지지 8개를
// 손으로 골라 삼합 표 대조와 오행 합산이 정확한지만 본다(calculate.ts 머리말 참고).
import test from "node:test";
import assert from "node:assert/strict";
import { calculateSpecialStars, calculateElementCounts } from "./calculate.ts";

function pillars(year, month, day, hour = null) {
  return { year, month, day, hour };
}

test("일지가 신자진(申子辰) 그룹이면 도화는 유, 역마는 인이다", () => {
  // 일지 자(병자→branch 자)가 신자진 그룹 — 연지에 유(도화), 월지에 인(역마)을 심어둔다.
  const hits = calculateSpecialStars(pillars("갑유", "을인", "병자", "정묘"));
  assert.deepEqual(hits, [
    { star: "도화", branch: "유", positions: ["year"] },
    { star: "역마", branch: "인", positions: ["month"] },
  ]);
});

test("일지가 인오술(寅午戌) 그룹이면 도화는 묘, 역마는 신이다", () => {
  const hits = calculateSpecialStars(pillars("을묘", "병신", "갑오", null));
  assert.deepEqual(hits, [
    { star: "도화", branch: "묘", positions: ["year"] },
    { star: "역마", branch: "신", positions: ["month"] },
  ]);
});

test("도화·역마에 해당하는 지지가 하나도 없으면 빈 배열이다 — '없음'을 빈 문자열로 표현하지 않는다", () => {
  const hits = calculateSpecialStars(pillars("갑축", "을묘", "병자", "정사"));
  assert.deepEqual(hits, []);
});

test("같은 신살이 두 기둥에 겹치면 positions 배열에 둘 다 담는다", () => {
  // 일지 자(신자진 그룹, 도화=유) — 연지·월지 둘 다 유.
  const hits = calculateSpecialStars(pillars("갑유", "을유", "병자", "정사"));
  assert.deepEqual(hits, [{ star: "도화", branch: "유", positions: ["year", "month"] }]);
});

test("시간을 모르면(hour: null) 시주는 판정에서 빠진다", () => {
  // 시주에 역마 지지(인)를 심어도, hour가 null이면 그 자리 자체가 없어서 잡히면 안 된다.
  const hits = calculateSpecialStars(pillars("갑축", "을묘", "병자", null));
  assert.deepEqual(hits, []);
});

test("오행 개수는 여덟 글자(천간 4 + 지지 4)를 고전 오행표대로 합산한다", () => {
  // 갑(목)·자(수) / 병(화)·오(화) / 무(토)·진(토) / 경(금)·신(금) — 여덟 글자가 다섯 오행에
  // 고르게 흩어지도록 골랐다.
  const counts = calculateElementCounts(pillars("갑자", "병오", "무진", "경신"));
  assert.deepEqual(counts, { 목: 1, 화: 2, 토: 2, 금: 2, 수: 1 });
});

test("시간을 모르면(hour: null) 여섯 글자만 세고, 나온 적 없는 오행은 0이다", () => {
  // 신(금)·유(금) / 계(수)·묘(목) / 기(토)·미(토) — 화(火)가 한 번도 안 나오게 골랐다.
  const counts = calculateElementCounts(pillars("신유", "계묘", "기미", null));
  assert.deepEqual(counts, { 목: 1, 화: 0, 토: 2, 금: 2, 수: 1 });
});
