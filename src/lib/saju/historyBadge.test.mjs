import test from "node:test";
import assert from "node:assert/strict";
import { sajuHistoryBadge } from "@/lib/saju/historyBadge";
import { SAJU_REPORT_RETENTION_DAYS } from "@/lib/legal/retention";

// 2026-09-26 신설. 결제 내역이 사주 리포트를 이용권 문서 없이 배지로 보여줘야 해서
// (사용자 요청 "결제내역에 리포트도 추가해") 세 갈래(아직 안 열림/읽는 중/보관 만료)를
// Firestore 없이 고정한다.

const NOW = new Date("2026-09-26T12:00:00.000Z");
const RETENTION_MS = SAJU_REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

test("주문 마커에 readingId 가 없으면 아직 안 열림이다", () => {
  assert.equal(sajuHistoryBadge(null, "2026-09-26T00:00:00.000Z", NOW), "아직 안 열림");
  assert.equal(sajuHistoryBadge({ readingId: null }, "2026-09-26T00:00:00.000Z", NOW), "아직 안 열림");
});

test("readingId 가 있고 30일이 안 지났으면 읽는 중이다", () => {
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, "2026-09-26T00:00:00.000Z", NOW), "읽는 중");
});

// 경계 테스트. 이전 버전은 "만료 1초 전"이라고 주석을 달아 놓고 실제로는 paidAt 을 NOW 에서
// 1초 뺀 값으로 넘겼다 — 그건 "1초 전에 결제한 건"이라 만료(paidAt + 30일)까지 30일이나
// 남아 있어서 경계와 무관했다(2026-09-26 tayeon-84 지적). 진짜 경계는 paidAt 자체를
// `NOW - 30일 ± 1초` 로 잡아야 만료 시각이 NOW 근처로 온다.
test("경계 — 만료 1초 전(paidAt = NOW - 30일 + 1초)은 아직 읽는 중이다", () => {
  const paidAt = new Date(NOW.getTime() - RETENTION_MS + 1000);
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, paidAt.toISOString(), NOW), "읽는 중");
});

test("경계 — 만료 1초 후(paidAt = NOW - 30일 - 1초)는 보관 만료다", () => {
  const paidAt = new Date(NOW.getTime() - RETENTION_MS - 1000);
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, paidAt.toISOString(), NOW), "보관 만료");
});

test("readingId 가 있고 30일이 지났으면 보관 만료다", () => {
  const paidAt = "2026-08-01T00:00:00.000Z"; // NOW 로부터 30일보다 훨씬 이전
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, paidAt, NOW), "보관 만료");
});

test("paidAt 이 깨졌으면 만료로 보지 않는다 — 파싱 실패로 잠그지 않는다(storage.ts 와 같은 원칙)", () => {
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, null, NOW), "읽는 중");
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }, "아무말", NOW), "읽는 중");
});
