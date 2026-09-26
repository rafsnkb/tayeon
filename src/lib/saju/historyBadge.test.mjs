import test from "node:test";
import assert from "node:assert/strict";
import { sajuHistoryBadge } from "@/lib/saju/historyBadge";

// 2026-09-26 신설, 2026-09-27 축소. 결제 내역이 사주 리포트를 이용권 문서 없이 배지로
// 보여줘야 해서(사용자 요청 "결제내역에 리포트도 추가해") 갈래를 Firestore 없이 고정한다.
//
// 「보관 만료」 갈래는 없어졌다 — 리포트가 무기한 보관으로 바뀌면서(2026-09-27) 만료 판정
// 자체가 사라졌고, `paidAt` 근사값·파싱 실패 처리도 같이 사라졌다.

test("주문 마커에 readingId 가 없으면 아직 안 열림이다", () => {
  assert.equal(sajuHistoryBadge(null), "아직 안 열림");
  assert.equal(sajuHistoryBadge({ readingId: null }), "아직 안 열림");
  assert.equal(sajuHistoryBadge({}), "아직 안 열림");
});

test("readingId 가 있으면 읽는 중이다 — 시간이 아무리 지나도 만료되지 않는다", () => {
  assert.equal(sajuHistoryBadge({ readingId: "r-1" }), "읽는 중");
});
