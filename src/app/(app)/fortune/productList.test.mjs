import test from "node:test";
import assert from "node:assert/strict";
import { productsFor, productMeta } from "@/app/(app)/fortune/productList";
import { FORTUNE_FILTERS, fortuneFilterFromKey, fortuneListHref } from "@/app/(app)/fortune/filters";
import { NEW_SLUGS, SAJU_PRODUCTS, getSajuProduct } from "@/lib/saju/products";
import { purchasableSajuProducts } from "@/lib/saju/purchase";

// 2026-09-26 신설. 운세 목록 화면이 **무엇을 보여주는가**를 고정한다. 화면은 JSX 라 여기서
// 못 부르므로 고르는 논리만 `productList.ts` 로 빼 뒀다.
//
// 지키려는 것 넷:
//  1. 한 상품이 걸린 카테고리 **전부**에서 나온다(사용자 요구 "관련있는 카테고리에서 다 뜨게")
//  2. 「신규」 = `NEW_SLUGS` ∩ 판매가능. 상수 하나를 켜면 세 장이 된다
//  3. 칩 표기(`결혼 · 가족`)와 카드 브레드크럼(`결혼·가족`)이 **서로 다른 채로** 남는다
//  4. 「전체」는 거르지 않는다

const filter = (key) => {
  const found = FORTUNE_FILTERS.find((f) => f.key === key);
  assert.ok(found, `필터 ${key} 가 없다`);
  return found;
};
const slugs = (list) => list.map((p) => p.slug);

// ── 1. 카테고리 필터 ────────────────────────────────────────────────────────

test("여러 카테고리에 걸린 상품은 그 카테고리 전부에서 나온다", () => {
  // 사용자가 명시적으로 정한 동작이다 — `categories` 가 배열인 이유가 이것뿐이다.
  const multi = SAJU_PRODUCTS.filter((p) => p.categories.length > 1);
  assert.ok(multi.length > 0, "여러 카테고리에 걸린 상품이 하나도 없다면 전제가 무너진 것이다");

  for (const product of multi) {
    for (const category of product.categories) {
      const chip = FORTUNE_FILTERS.find((f) => f.category === category);
      assert.ok(chip, `카테고리 ${category} 에 대응하는 칩이 없다`);
      assert.ok(
        slugs(productsFor(chip)).includes(product.slug),
        `${product.slug} 이 ${category} 칸에 없다`
      );
    }
  }
});

test("카테고리 칩은 그 카테고리를 가진 상품만 보여준다", () => {
  for (const item of FORTUNE_FILTERS) {
    if (!item.category) continue;
    for (const product of productsFor(item)) {
      assert.ok(
        product.categories.includes(item.category),
        `${product.slug} 이 ${item.category} 칸에 잘못 들어왔다`
      );
    }
  }
});

test("모든 카테고리에 대응하는 칩이 있고, 빈 칸이 없다", () => {
  const covered = new Set(FORTUNE_FILTERS.map((f) => f.category).filter(Boolean));
  for (const product of SAJU_PRODUCTS) {
    for (const category of product.categories) {
      assert.ok(covered.has(category), `${category} 를 보여줄 칩이 없다 — 그 상품은 영영 안 뜬다`);
    }
  }
  for (const item of FORTUNE_FILTERS) {
    if (!item.category) continue;
    assert.ok(productsFor(item).length > 0, `${item.label} 칸이 비어 있다`);
  }
});

test("「전체」는 거르지 않는다 — 팔 수 있는 상품 전부다", () => {
  assert.deepEqual(slugs(productsFor(filter("all"))), slugs(purchasableSajuProducts()));
});

test("모르는 필터 키는 「전체」로 떨어진다", () => {
  for (const bad of [null, undefined, "", "LOVE", "연애", "does-not-exist"]) {
    assert.equal(fortuneFilterFromKey(bad).key, "all", `${bad} 가 전체로 안 떨어졌다`);
  }
  assert.equal(fortuneFilterFromKey("love").key, "love");
});

test("「전체」 주소에는 쿼리가 붙지 않고, 나머지는 키로 붙는다", () => {
  assert.equal(fortuneListHref("all"), "/fortune");
  assert.equal(fortuneListHref("love"), "/fortune?c=love");
  // 왕복이 성립해야 드로어에서 고른 카테고리가 목록에 닿는다.
  for (const item of FORTUNE_FILTERS) {
    const query = new URL(fortuneListHref(item.key), "http://x").searchParams.get("c");
    assert.equal(fortuneFilterFromKey(query).key, item.key);
  }
});

// ── 2. 「신규」 ─────────────────────────────────────────────────────────────

test("「신규」는 NEW_SLUGS 의 배열 순서 그대로다", () => {
  const shown = slugs(productsFor(filter("new"), SAJU_PRODUCTS));
  assert.deepEqual(shown, [...NEW_SLUGS], "배열 순서가 곧 표시 순서다");
});

test("NEW_SLUGS 는 전부 실재하는 상품을 가리킨다", () => {
  for (const slug of NEW_SLUGS) {
    assert.ok(getSajuProduct(slug), `${slug} 라는 상품이 없다 — 오타이거나 상품이 사라졌다`);
  }
});

test("「신규」는 NEW_SLUGS 세 장 그대로다", () => {
  // 한동안 성인 게이트가 속궁합을 걸러 두 장이었는데, 그 게이트를 걷어냈다(2026-09-26).
  // 목업 `Fortune_Home_*` 이 그린 세 장과 이제 실제로 같다.
  const shown = slugs(productsFor(filter("new")));
  assert.deepEqual(shown, [...NEW_SLUGS]);
  assert.equal(shown.length, 3, "목업 `Fortune_Home_*` 의 신규는 세 장이다");
});

test("「신규」는 판매 가능 목록에서만 고른다", () => {
  // 지금은 거르는 조건이 없어서 셋이 다 뜨지만, 나중에 품절·기간 한정으로 하나가 빠지면
  // 「신규」에서도 빠져야 한다. 주입으로 그 세계를 재현한다 — 조건이 생긴 뒤에 이 성질이
  // 깨지면 "목록엔 있는데 못 사는 카드"가 된다.
  const withoutFirst = SAJU_PRODUCTS.filter((p) => p.slug !== NEW_SLUGS[0]);
  const shown = slugs(productsFor(filter("new"), withoutFirst));
  assert.ok(!shown.includes(NEW_SLUGS[0]));
  assert.deepEqual(shown, NEW_SLUGS.slice(1));
});

test("목록은 판매 가능 목록 밖의 상품을 진열하지 않는다", () => {
  // 탭하면 막히는 카드가 목록에 있는 것 자체가 버그다. 조건을 화면이 다시 쓰지 않고
  // `purchasableSajuProducts()` 하나만 보는지 확인한다 — 주입으로 "못 파는 상품"을 만들어
  // 그게 어느 칸에도 안 뜨는지 본다.
  const dropped = SAJU_PRODUCTS[0];
  const sellable = SAJU_PRODUCTS.filter((p) => p !== dropped);
  for (const item of FORTUNE_FILTERS) {
    for (const product of productsFor(item, sellable)) {
      assert.notEqual(product, dropped, `${dropped.slug} 이 ${item.label} 칸에 떴다`);
    }
  }
});

// ── 3. 표기가 갈린 채로 남는가 ───────────────────────────────────────────────

test("칩 라벨은 가운뎃점 양옆에 공백이 있다", () => {
  // 목업 실측: `결혼 · 가족` 칩 101.7px. 공백을 빼면 91.7 로 10px 좁아진다(2026-09-26 대조).
  assert.equal(filter("marriage").label, "결혼 · 가족");
  assert.equal(filter("money").label, "직업 · 재물");
  assert.equal(filter("relationship").label, "건강 · 인간관계");
});

test("칩 라벨과 카테고리 값은 공백만 다르다 — 통일하면 안 된다", () => {
  for (const item of FORTUNE_FILTERS) {
    if (!item.category) continue;
    assert.equal(
      item.label.replace(/ /g, ""),
      item.category.replace(/ /g, ""),
      `${item.key} 의 라벨과 카테고리가 공백 말고도 다르다`
    );
    if (item.category.includes("·")) {
      assert.notEqual(item.label, item.category, `${item.key} 의 라벨이 카테고리 값과 같아졌다`);
      assert.ok(item.label.includes(" · "), `${item.key} 의 라벨에 공백이 빠졌다`);
    }
  }
});

test("카드 브레드크럼은 공백 없는 원래 값을 쓴다", () => {
  // 여기서 라벨(`결혼 · 가족`)을 쓰면 `인생 · 결혼 · 가족 · 결혼` 이 되어 카테고리가 넷으로
  // 읽힌다. 그래서 칩과 갈라 둔 것이고, 그 결정을 여기서 지킨다.
  const marriage = getSajuProduct("marriage-timing");
  assert.deepEqual(marriage.categories, ["인생", "결혼·가족", "연애"]);
  assert.equal(productMeta(marriage), "인생 · 결혼·가족 · 연애 · 결혼");

  // 맨 뒤 한 칸만 태그이고 앞은 전부 카테고리다(설계 §3).
  for (const product of SAJU_PRODUCTS) {
    const parts = productMeta(product).split(" · ");
    assert.equal(parts.length, product.categories.length + 1);
    assert.equal(parts.at(-1), product.tag);
    assert.deepEqual(parts.slice(0, -1), product.categories);
  }
});
