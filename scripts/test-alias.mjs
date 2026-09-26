// `node --test` 가 소스의 `@/...` 별칭 import 를 풀 수 있게 해 주는 해석 훅.
//
// tsconfig 의 paths 는 타입체커와 번들러만 보는 설정이라, 런타임인 node 는 `@/lib/...` 을
// 그대로 패키지 이름으로 읽고 실패한다. 테스트가 상대경로만 쓰는 모듈에 갇히지 않도록 여기서
// 같은 규칙(`@/*` → `<repo>/src/*`)을 런타임에도 적용한다. 확장자도 붙여 준다 — 소스는
// 확장자 없이 import 하는데 node 의 ESM 해석은 확장자를 요구하기 때문이다.
//
// 사용: node --import ./scripts/test-alias.mjs --test <파일들>  (= npm test)
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "..", "src");

// 확장자·index 후보를 순서대로 본다. **파일이 디렉터리보다 먼저다** — `@/lib/saju/products` 처럼
// 같은 이름의 디렉터리와 파일이 함께 있을 수 있고, 디렉터리를 모듈로 열면 EISDIR 로 죽는다.
function resolveFrom(base) {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base]) {
    if (existsSync(candidate) && !isDirectory(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

function isDirectory(candidate) {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const url = resolveFrom(path.join(SRC, specifier.slice(2)));
      if (url) return { url, shortCircuit: true };
    }
    // 확장자 없는 **상대경로**도 같이 풀어 준다. 위 머리말이 말하는 문제("소스는 확장자 없이
    // import 한다")는 `@/` 에만 있는 게 아니다 — 소스끼리는 `./single-love` 처럼 상대경로로도
    // 부르고, 그건 node 의 ESM 해석이 그대로 실패시킨다. 그래서 별칭만 풀어 주면 그 모듈을
    // import 하는 테스트는 파일을 열지도 못하고 죽는다(2026-09-26).
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const parent = path.dirname(fileURLToPath(context.parentURL));
      const url = resolveFrom(path.resolve(parent, specifier));
      if (url) return { url, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
