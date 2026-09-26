// 후기 입력 검증 — **서버가 자기 규칙으로 다시 재는 자리**다.
//
// 화면의 「0/15자」 표시는 안내일 뿐이라, 이 함수가 무르면 직접 호출로 빈 후기가 쿠폰만 받아
// 간다(후기 한 건당 10% 할인 쿠폰 한 장이 나간다). 돈이 걸린 판정이라 여기서 고정한다.
import test from "node:test";
import assert from "node:assert/strict";
import { validateReviewInput, REVIEW_MIN_BODY_CHARS, REVIEW_MAX_BODY_CHARS } from "./review.ts";

const OK_BODY = "가".repeat(REVIEW_MIN_BODY_CHARS);

test("별점 1~5 와 15자 이상이면 통과한다", () => {
  for (const stars of [1, 2, 3, 4, 5]) {
    const result = validateReviewInput(stars, OK_BODY);
    assert.equal(result.ok, true);
    assert.equal(result.stars, stars);
  }
});

test("별점을 안 고르면(0) 거절한다 — 기본값을 주지 않기로 한 결정의 짝이다", () => {
  assert.equal(validateReviewInput(0, OK_BODY).ok, false);
});

test("별점 범위 밖과 소수점은 거절한다", () => {
  for (const stars of [-1, 6, 100, 3.5]) {
    assert.equal(validateReviewInput(stars, OK_BODY).ok, false, `${stars} 가 통과했다`);
  }
});

test("문자열로 온 별점도 숫자로 받아 준다 — JSON 을 손으로 만든 클라이언트가 있다", () => {
  const result = validateReviewInput("4", OK_BODY);
  assert.equal(result.ok, true);
  assert.equal(result.stars, 4);
});

test("별점이 아예 없거나 숫자가 아니면 거절한다", () => {
  for (const stars of [undefined, null, "별", {}, NaN]) {
    assert.equal(validateReviewInput(stars, OK_BODY).ok, false);
  }
});

test("공백만 채운 후기는 길이로 통과하지 못한다", () => {
  // 다듬기 전 길이로 재면 스페이스 20개가 통과한다. trim 뒤에 재는지가 이 테스트의 요점이다.
  assert.equal(validateReviewInput(5, " ".repeat(50)).ok, false);
});

test("앞뒤 공백은 잘라서 저장한다", () => {
  const result = validateReviewInput(5, `  ${OK_BODY}  `);
  assert.equal(result.ok, true);
  assert.equal(result.body, OK_BODY);
});

test("14자는 거절하고 15자는 통과한다", () => {
  assert.equal(validateReviewInput(5, "가".repeat(REVIEW_MIN_BODY_CHARS - 1)).ok, false);
  assert.equal(validateReviewInput(5, "가".repeat(REVIEW_MIN_BODY_CHARS)).ok, true);
});

test("상한을 넘으면 거절한다 — 자르지 않는다", () => {
  // 조용히 자르면 사용자가 쓴 글의 끝이 사라진 걸 모른 채 저장된다.
  assert.equal(validateReviewInput(5, "가".repeat(REVIEW_MAX_BODY_CHARS + 1)).ok, false);
  assert.equal(validateReviewInput(5, "가".repeat(REVIEW_MAX_BODY_CHARS)).ok, true);
});

test("본문이 문자열이 아니면 거절한다", () => {
  for (const body of [undefined, null, 12345, { body: OK_BODY }]) {
    assert.equal(validateReviewInput(5, body).ok, false);
  }
});
