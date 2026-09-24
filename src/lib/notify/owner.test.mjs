import test from "node:test";
import assert from "node:assert/strict";
import { alertDocId } from "@/lib/notify/owner.ts";

// 2026-09-24: 알림 키에 "/" 가 들어가는데 Firestore 문서 id 는 그걸 경로 구분자로 읽는다.
// notifyOwner 의 try/catch 가 그 예외를 삼켜서, 알림이 한 건도 안 나가는데 에러도 안 보이는
// 상태로 한참을 있었다. 키 모양을 바꿀 때 같은 일이 반복되지 않도록 고정한다.

test("슬래시는 문서 id 에 쓸 수 없으므로 치환된다", () => {
  for (const key of [
    "refund-requested/abc123",
    "refund-hold/abc123",
    "refund-failed/abc123/2026-09-24T05",
    "support-inquiry/xyz",
  ]) {
    const id = alertDocId(key);
    assert.ok(!id.includes("/"), key);
  }
});

test("키가 다르면 id 도 다르다 (중복 방지가 무너지면 안 된다)", () => {
  const ids = ["refund-requested/a", "refund-requested/b", "refund-hold/a", "refund-approved/a"].map(alertDocId);
  assert.equal(new Set(ids).size, ids.length);
});

test("Firestore 예약 형식(__foo__)과 점만 있는 id 를 피한다", () => {
  assert.ok(!/^__.*__$/.test(alertDocId("__proto__")));
  assert.equal(alertDocId("."), "_");
  assert.equal(alertDocId(".."), "_");
});

test("평범한 키는 그대로 둔다", () => {
  assert.equal(alertDocId("quota-2026-09-24"), "quota-2026-09-24");
});
