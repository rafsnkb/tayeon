import test from "node:test";
import assert from "node:assert/strict";
import { withReturnTo, safeReturnTo } from "./navigation.ts";

const BACKSLASH = String.fromCharCode(92);

test("the origin is appended without clobbering an existing query", () => {
  assert.equal(withReturnTo("/charge", "/me"), "/charge?from=%2Fme");
  assert.equal(withReturnTo("/charge?tab=time", "/tarot/abc"), "/charge?tab=time&from=%2Ftarot%2Fabc");
});

test("an in-app path comes back unchanged", () => {
  for (const path of ["/", "/me", "/tarot/abc", "/?tab=time"]) {
    assert.equal(safeReturnTo(path), path);
  }
});

// 주소창으로 들어오는 값이라, 이게 새면 뒤로가기 버튼이 외부 사이트로 보내는 통로가 된다.
test("anything that could leave the site is refused", () => {
  const hostile = [
    "https://evil.com",
    "http://evil.com",
    "//evil.com",
    // 브라우저가 역슬래시를 `/` 로 고쳐 읽어서 위와 같아진다 — `/` 로 시작하는지만 보면 통과한다.
    "/" + BACKSLASH + "evil.com",
    BACKSLASH + BACKSLASH + "evil.com",
    "javascript:alert(1)",
    "me",
  ];
  for (const value of hostile) {
    assert.equal(safeReturnTo(value), undefined, `${value} 가 통과했다`);
  }
});

test("a missing origin falls back to nothing rather than a broken link", () => {
  for (const value of [null, undefined, ""]) {
    assert.equal(safeReturnTo(value), undefined);
  }
});
