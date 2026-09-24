// `node --test` 가 소스의 `@/...` 별칭 import 를 풀 수 있게 해 주는 해석 훅.
//
// tsconfig 의 paths 는 타입체커와 번들러만 보는 설정이라, 런타임인 node 는 `@/lib/...` 을
// 그대로 패키지 이름으로 읽고 실패한다. 테스트가 상대경로만 쓰는 모듈에 갇히지 않도록 여기서
// 같은 규칙(`@/*` → `<repo>/src/*`)을 런타임에도 적용한다. 확장자도 붙여 준다 — 소스는
// 확장자 없이 import 하는데 node 의 ESM 해석은 확장자를 요구하기 때문이다.
//
// 사용: node --import ./scripts/test-alias.mjs --test <파일들>  (= npm test)
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");

function resolveAlias(specifier) {
  const base = path.join(SRC, specifier.slice(2));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const url = resolveAlias(specifier);
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
