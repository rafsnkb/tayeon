import test from "node:test";
import assert from "node:assert/strict";
import { withReturnTo, safeReturnTo, canReturnByHistory, resetInAppOrigin } from "./navigation.ts";

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

// 2026-09-25: 마이페이지 → 이용권 구입 → 뒤로가기가 push 라서 히스토리가 줄지 않았고, 돌아간
// 화면의 뒤로가기가 다시 구입 화면으로 들어가며 두 화면이 영원히 왕복했다. 그 판단이
// canReturnByHistory 다 — "온 곳이 히스토리 바로 뒤에 그대로 있는가".
test("같은 문서 안에서 이동해 왔으면 히스토리로 되돌아간다", () => {
  resetInAppOrigin();
  globalThis.window = { history: { length: 3 } };
  withReturnTo("/charge", "/me");
  assert.equal(canReturnByHistory("/me"), true);
  delete globalThis.window;
});

test("문서가 다시 로드됐으면(결제 리다이렉트 등) 히스토리를 믿지 않는다", () => {
  resetInAppOrigin(); // 모듈 변수가 비는 것 = 새 문서
  globalThis.window = { history: { length: 5 } };
  assert.equal(canReturnByHistory("/me"), false);
  delete globalThis.window;
});

test("다른 화면에서 온 뒤로가기 목적지는 히스토리로 처리하지 않는다", () => {
  resetInAppOrigin();
  globalThis.window = { history: { length: 3 } };
  withReturnTo("/charge", "/tarot/abc");
  assert.equal(canReturnByHistory("/me"), false);
  assert.equal(canReturnByHistory(undefined), false);
  delete globalThis.window;
});

test("히스토리에 엔트리가 하나뿐이면(주소창 직접 진입) back 하지 않는다", () => {
  resetInAppOrigin();
  globalThis.window = { history: { length: 1 } };
  withReturnTo("/charge", "/me");
  assert.equal(canReturnByHistory("/me"), false);
  delete globalThis.window;
});
