import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOURCE, COPY } from "./syncPaths.mjs";

// Functions 는 별도 패키지라 단일 출처를 import 하지 못하고 사본을 들고 간다. 예전에는 그 사본이
// 손으로 복사된 상수 뭉치였고, 앱만 고치면 Functions 가 조용히 옛 값으로 남았다(2026-09-24
// 인계 메모 3번 — "npm test 도 Functions 쪽 값은 보지 않는다"). 이 테스트가 그 구멍이다.
test("리워드 규칙 단일 출처와 functions 사본이 같다", () => {
  const source = readFileSync(SOURCE, "utf8");
  const copy = readFileSync(COPY, "utf8");
  assert.equal(
    copy,
    source,
    "functions/src/shared/rewardRules.ts 가 src/lib/reward/rules.ts 와 다르다. " +
      "단일 출처만 고치고 `npm run sync:reward-rules` 를 돌릴 것(사본을 직접 고치면 덮어쓰인다)."
  );
});
