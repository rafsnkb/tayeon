import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { productArt } from "@/app/(app)/fortune/productArt";
import { SAJU_PRODUCTS } from "@/lib/saju/products";

// 2026-09-26 신설. **슬러그 19개가 손으로 나열된 곳이 두 군데**라 서로 갈라질 수 있다:
//
//  1. `productArt.ts` 의 `PRODUCT_ART` — 화면이 "이 상품에 그림이 있나"를 묻는 곳
//  2. `scripts/build-fortune-art.cjs` 의 `SLUGS` — 그림을 실제로 굽는 곳
//
// 20번째 상품이 생겼을 때 **하나만 고쳐도 아무 에러가 안 난다**는 게 문제다. 굽기만 하고
// 목록에 안 넣으면 그림이 생겼는데 안 뜨고, 목록에만 넣으면 404 가 난다. 둘 다 조용하다.
// `productArt.ts` 의 dev 경고는 "상품은 있는데 그림 없음" 한 방향만 본다.
//
// 목록을 코드에서 합칠 수는 없다 — 그 스크립트는 CommonJS 이고 상품 정의는 TS/ESM 이라
// `require` 로 못 읽는다(그래서 애초에 두 벌이 됐다). 그래서 **소스를 읽어서** 대조한다.
// 파일을 정규식으로 파싱하는 건 보통 나쁜 신호지만, 여기서는 "합칠 수 없는 중복"을 묶는
// 유일한 방법이다. 셋을 한 번에 비교하므로 어느 쪽을 빠뜨려도 여기서 걸린다.
//
// 스크립트를 `require` 하지 않는 이유가 하나 더 있다 — 그 파일은 최상위 IIFE 로 sharp 를
// 바로 돌린다. import 하는 순간 테스트가 이미지를 굽기 시작한다.

const repoRoot = new URL("../../../../", import.meta.url);

/** 소스 파일에서 `const <name> = [ ... ]` / `new Set([ ... ])` 안의 문자열 리터럴을 뽑는다. */
function slugsInSource(relativePath, declaration) {
  const source = readFileSync(new URL(relativePath, repoRoot), "utf8");
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${relativePath} 에서 \`${declaration}\` 를 못 찾았다 — 선언이 바뀌었으면 이 테스트도 같이 고칠 것`);
  const end = source.indexOf("]", start);
  assert.notEqual(end, -1, `${relativePath} 의 \`${declaration}\` 배열이 안 닫혔다`);
  const found = source.slice(start, end).match(/['"]([a-z][a-z-]+)['"]/g) ?? [];
  const slugs = found.map((quoted) => quoted.slice(1, -1));
  assert.ok(slugs.length > 0, `${relativePath} 의 \`${declaration}\` 에서 슬러그를 하나도 못 뽑았다`);
  return slugs;
}

const productSlugs = SAJU_PRODUCTS.map((p) => p.slug);
const artSlugs = slugsInSource("src/app/(app)/fortune/productArt.ts", "const PRODUCT_ART");
const scriptSlugs = slugsInSource("scripts/build-fortune-art.cjs", "const SLUGS");

test("그림 목록과 굽기 스크립트가 정확히 같은 슬러그를 나열한다", () => {
  // 순서까지 같아야 한다고 요구하지는 않는다 — 둘 다 알파벳 순이지만 그건 규칙이 아니다.
  assert.deepEqual(
    [...artSlugs].sort(),
    [...scriptSlugs].sort(),
    "productArt.ts 와 build-fortune-art.cjs 의 슬러그가 갈라졌다 — 상품을 추가할 때 둘 다 고쳐야 한다"
  );
});

test("모든 상품에 그림이 있다", () => {
  const missing = productSlugs.filter((slug) => !artSlugs.includes(slug));
  assert.deepEqual(missing, [], `그림 목록에 없는 상품 — 목록에 넣고 원본 PNG 를 받아 스크립트를 돌릴 것`);
});

test("없는 상품의 그림을 나열하지 않는다", () => {
  // 반대 방향이다. dev 경고가 이 방향을 안 봐서 여기서 잡는다 — 상품이 사라졌는데 그림이
  // 남아 있으면 굽기 스크립트가 없는 원본을 찾다가 죽는다.
  const orphans = artSlugs.filter((slug) => !productSlugs.includes(slug));
  assert.deepEqual(orphans, [], "상품이 없는데 그림만 나열된 슬러그");
});

test("productArt() 가 모든 상품에 두 해상도 주소를 준다", () => {
  // 목록이 맞아도 함수가 틀릴 수 있다. `card` 를 빼먹으면 에러 없이 원본이 작은 칸에
  // 들어가서 트래픽만 샌다 — 그래서 두 값을 다 고정한다.
  for (const slug of productSlugs) {
    assert.equal(productArt(slug), `/fortune/${slug}.webp`);
    assert.equal(productArt(slug, "card"), `/fortune/${slug}-card.webp`);
    assert.equal(productArt(slug, "hero"), `/fortune/${slug}.webp`, "기본값은 hero 다");
  }
});

test("모르는 슬러그에는 null 을 준다 — 자리표로 떨어져야 한다", () => {
  for (const bad of ["", "does-not-exist", "LIFE-OVERVIEW"]) {
    assert.equal(productArt(bad), null, `${bad} 에 주소가 나왔다`);
  }
});
