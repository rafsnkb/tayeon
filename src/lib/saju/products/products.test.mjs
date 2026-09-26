// 상품 레지스트리 불변식.
//
// 19개 상품은 기획 문서에서 **손으로 옮긴 데이터**다(파일 19개, 섹션 195개). 로직이 아니라
// 데이터라 타입체커가 잡아 주는 건 "문자열이 문자열인가"까지이고, slug 오타·섹션 id 중복·가격
// 자릿수 같은 건 전부 통과한다. 그리고 이 데이터의 오류는 **런타임에 조용히** 드러난다 —
// 섹션 id 가 겹치면 2단이 엉뚱한 섹션을 쓰고, 가격이 틀리면 서버가 정상 결제를 위조로 본다.
import test from "node:test";
import assert from "node:assert/strict";
import * as registry from "./index.ts";
import { SAJU_PRODUCTS, getSajuProduct } from "./index.ts";

// 기획 1.2 가 정한 여섯 개뿐이다. 새로 만들면 목록 필터에서 아무 상품도 안 걸리는 칸이 생긴다.
const CATEGORIES = ["인생", "연애", "궁합", "결혼·가족", "직업·재물", "건강·인간관계"];

test("19개다", () => {
  assert.equal(SAJU_PRODUCTS.length, 19);
});

test("slug 가 중복되지 않는다", () => {
  // 중복이면 `getSajuProduct` 가 먼저 선언된 쪽만 돌려주고 나머지는 영원히 안 팔린다.
  const slugs = SAJU_PRODUCTS.map((p) => p.slug);
  assert.deepEqual([...new Set(slugs)].sort(), [...slugs].sort());
});

test("slug 가 URL 에 쓸 수 있는 꼴이다", () => {
  // 라우트가 `/fortune/[slug]` 라 대문자·공백·한글이 섞이면 주소가 깨진다.
  for (const p of SAJU_PRODUCTS) {
    assert.match(p.slug, /^[a-z0-9-]+$/, p.slug);
  }
});

test("getSajuProduct 가 모든 slug 를 찾고, 없는 건 undefined 다", () => {
  for (const p of SAJU_PRODUCTS) {
    assert.equal(getSajuProduct(p.slug)?.slug, p.slug);
  }
  assert.equal(getSajuProduct("없는-상품"), undefined);
});

test("섹션이 0개인 상품이 없다", () => {
  for (const p of SAJU_PRODUCTS) {
    assert.ok(p.sections.length > 0, p.slug);
  }
});

test("섹션 id 가 상품 안에서 유일하다", () => {
  // 1단이 배정표를 id 로 맞춰 재배열하고(`byId` Map) 2단이 그 id 로 섹션을 고른다. 겹치면
  // 나중 것이 앞 것을 덮어서 한 섹션이 두 번 쓰이고 다른 하나는 빠진다.
  for (const p of SAJU_PRODUCTS) {
    const ids = p.sections.map((s) => s.id);
    assert.deepEqual([...new Set(ids)].sort(), [...ids].sort(), p.slug);
  }
});

test("섹션 id·제목이 비어 있지 않다", () => {
  for (const p of SAJU_PRODUCTS) {
    for (const s of p.sections) {
      assert.ok(s.id.trim().length > 0, `${p.slug} 의 빈 id`);
      assert.ok(s.title.trim().length > 0, `${p.slug}/${s.id} 의 빈 제목`);
    }
  }
});

test("categories 가 비어 있지 않고 전부 아는 카테고리다", () => {
  for (const p of SAJU_PRODUCTS) {
    assert.ok(p.categories.length > 0, p.slug);
    for (const c of p.categories) {
      assert.ok(CATEGORIES.includes(c), `${p.slug} 의 알 수 없는 카테고리: ${c}`);
    }
  }
});

test("categories 안에 같은 값이 두 번 들어가지 않는다", () => {
  // 배열 순서가 곧 화면 표기 순서라, 중복은 `연애 · 연애 · 썸` 처럼 그대로 보인다.
  for (const p of SAJU_PRODUCTS) {
    assert.equal(new Set(p.categories).size, p.categories.length, p.slug);
  }
});

test("여섯 카테고리에 상품이 하나도 없는 칸이 없다", () => {
  for (const c of CATEGORIES) {
    assert.ok(
      SAJU_PRODUCTS.some((p) => p.categories.includes(c)),
      `빈 카테고리: ${c}`
    );
  }
});

test("tag 가 있고 카테고리 이름을 그대로 쓰지 않는다", () => {
  // 맨 뒤 한 칸은 상품을 가리키는 말이다(`솔로`, `재회`). 카테고리를 넣으면 `연애 · 연애` 가 된다.
  for (const p of SAJU_PRODUCTS) {
    assert.ok(p.tag.trim().length > 0, p.slug);
    assert.ok(!CATEGORIES.includes(p.tag), `${p.slug} 의 tag 가 카테고리다: ${p.tag}`);
  }
});

test("pricesWon 세 값이 양의 정수다", () => {
  // 서버가 결제 금액을 이 값과 대조한다. 0·소수·음수면 정상 결제가 거부되거나 공짜가 된다.
  for (const p of SAJU_PRODUCTS) {
    for (const mode of ["saju", "ziwei", "integrated"]) {
      const won = p.pricesWon[mode];
      assert.ok(Number.isInteger(won) && won > 0, `${p.slug}/${mode}: ${won}`);
    }
  }
});

test("가격이 사주 < 자미두수 < 통합 순이다", () => {
  for (const p of SAJU_PRODUCTS) {
    const { saju, ziwei, integrated } = p.pricesWon;
    assert.ok(saju < ziwei, `${p.slug}: 사주 ${saju} >= 자미두수 ${ziwei}`);
    assert.ok(ziwei < integrated, `${p.slug}: 자미두수 ${ziwei} >= 통합 ${integrated}`);
  }
});

test("글 칸이 전부 채워져 있다", () => {
  // 전부 프롬프트에 그대로 꽂히는 문자열이다(§3 "파싱하지 않는다"). 비면 모델이 그 항목을
  // 지시 없이 지나가는데, 빈 문자열은 타입체커가 잡아 주지 않는다.
  const FILLED = [
    "title",
    "subtitle",
    "description",
    "userInputPrompt",
    "purpose",
    "sajuFocus",
    "ziweiFocus",
    "crossPoints",
  ];
  for (const p of SAJU_PRODUCTS) {
    for (const key of FILLED) {
      assert.ok(typeof p[key] === "string" && p[key].trim().length > 0, `${p.slug}.${key}`);
    }
  }
});

test("needsPartner 는 10개다", () => {
  const withPartner = SAJU_PRODUCTS.filter((p) => p.needsPartner).map((p) => p.slug);
  assert.equal(withPartner.length, 10, withPartner.join(","));
});

test("needsPartner 는 모든 상품에 boolean 으로 있다", () => {
  // 선택 필드가 아니다 — undefined 면 구매 화면이 상대 정보 입력칸을 안 띄운다.
  for (const p of SAJU_PRODUCTS) {
    assert.equal(typeof p.needsPartner, "boolean", p.slug);
  }
});

test("성인 전용 상품은 없다", () => {
  // 속궁합·성향 두 상품에 `adultOnly: true` 가 붙어 있었는데 걷어냈다(2026-09-26 사용자 결정).
  // 근거가 없었다 — 청소년보호법의 「청소년유해매체물」은 심의기관이 결정·고시한 것만이고
  // 해당이 없다. 다시 붙이려면 **연령 게이트도 같이** 와야 한다는 걸 이 테스트가 말해 준다:
  // 필드만 되살리면 아무것도 막지 않으면서 막고 있다고 착각하게 된다.
  const adult = SAJU_PRODUCTS.filter((p) => p.adultOnly).map((p) => p.slug);
  assert.deepEqual(adult, []);
});

test("image 는 솔로·결혼 시기·자녀 셋뿐이다", () => {
  // 기획 6.5 의 표가 정한 세 상품이다. `generate/image.ts` 가 `product.image` 없이 불리면
  // `SAJU_IMAGE_UNSUPPORTED_PRODUCT` 로 던지므로, 여기가 늘거나 줄면 그쪽 계약도 움직인다.
  const withImage = SAJU_PRODUCTS.filter((p) => p.image).map((p) => p.slug);
  assert.deepEqual(withImage.sort(), ["family-planning", "marriage-timing", "single-love"]);
});

test("image 가 있으면 subject 와 elements 가 채워져 있다", () => {
  // subject 가 비면 모델이 내담자 본인을 그린다(§5 주의 3, 실측에서 실제로 나왔다).
  for (const p of SAJU_PRODUCTS.filter((x) => x.image)) {
    assert.ok(p.image.subject.trim().length > 0, `${p.slug}.image.subject`);
    assert.ok(Array.isArray(p.image.elements) && p.image.elements.length > 0, `${p.slug}.image.elements`);
    for (const e of p.image.elements) {
      assert.ok(typeof e === "string" && e.trim().length > 0, `${p.slug}.image.elements 의 빈 값`);
    }
  }
});

test("constraints 는 성향 궁합 하나뿐이고 비어 있지 않다", () => {
  // 안전 제약이라 시스템 블록이 문체 규칙보다 앞에 꽂는다(§3). 빈 문자열이면 그 자리가 사라진다.
  const withConstraints = SAJU_PRODUCTS.filter((p) => p.constraints).map((p) => p.slug);
  assert.deepEqual(withConstraints, ["skinship-compatibility"]);
  assert.ok(getSajuProduct("skinship-compatibility").constraints.trim().length > 0);
});

test("성향 궁합의 안전 제약이 「대화로 확인」을 계속 말한다", () => {
  // 이 문장이 이 상품의 유일한 안전장치다. 성인 표시를 뗐어도 **성향을 단정하지 않고 당사자
  // 대화로 확인하게 하는 것**은 남아야 한다 — 문구를 다듬다 이 부분이 빠지면 모델이 성향을
  // 사실처럼 쓴다.
  assert.match(getSajuProduct("skinship-compatibility").constraints, /대화로 확인/);
});

test("친밀감·성향 궁합은 상대 정보가 필요하다", () => {
  // 둘 다 두 사람의 관계를 다루는 상품이다. 혼자 보는 형태가 생기면 동의·경계 원칙(기획 7.2)을
  // 다시 봐야 한다 — 상대의 성향을 상대 동의 없이 혼자 읽는 상품이 되기 때문이다.
  for (const slug of ["intimacy-compatibility", "skinship-compatibility"]) {
    assert.equal(getSajuProduct(slug).needsPartner, true, slug);
  }
});

test("NEW_SLUGS 가 있으면 전부 실제 상품을 가리킨다", () => {
  // sub_3 가 추가 중이라 아직 없을 수 있다. 없으면 이 테스트는 할 일이 없고, 생기는 순간부터
  // 오타가 잡힌다 — 진열용 목록이라 틀려도 화면에 "신규"가 안 뜰 뿐 아무도 에러를 안 본다.
  const slugs = registry.NEW_SLUGS;
  if (!slugs) return;
  assert.ok(Array.isArray(slugs), "NEW_SLUGS 가 배열이 아니다");
  assert.equal(new Set(slugs).size, slugs.length, "NEW_SLUGS 에 중복이 있다");
  for (const slug of slugs) {
    assert.ok(getSajuProduct(slug), `NEW_SLUGS 의 알 수 없는 slug: ${slug}`);
  }
});
