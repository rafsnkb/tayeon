import { NEW_SLUGS, SAJU_PRODUCTS, type SajuProduct } from "@/lib/saju/products";
import { purchasableSajuProducts } from "@/lib/saju/purchase";
import type { FortuneFilter } from "./filters";

/** 운세 목록이 "무엇을 보여줄지" 고르는 자리. **화면(.tsx) 밖에 둔다** — `node --test` 는 JSX 를
 *  못 읽어서 컴포넌트 안에 있으면 테스트가 손을 못 댄다(`productList.test.mjs`). */

/** 필터에 걸리는 상품들.
 *
 *  「전체」는 필터 없음, 「신규」는 `NEW_SLUGS` 의 **배열 순서**, 나머지는 `categories` 에 그
 *  카테고리가 들어 있는지로 거른다 — 상품 하나가 여러 카테고리에 걸리므로 여러 칸에 나온다.
 *  사용자가 명시적으로 요구한 동작이다: "상품이 관련있는 카테고리에서 다 뜨게"(설계 §3).
 *
 *  바탕이 `SAJU_PRODUCTS` 가 아니라 **`purchasableSajuProducts()`** 인 게 중요하다. 지금 못 파는
 *  상품(성인 2종, `ADULT_PRODUCTS_ON_SALE=false`)이 진열되면 탭해도 막히는 카드가 된다. 조건을
 *  여기서 다시 쓰지 않는 이유가 그거다 — 상수 하나로 진열과 결제가 같이 열려야 한다.
 *
 *  `sellable` 를 밖에서 넣을 수 있는 건 **그 상수를 켠 세계를 테스트하기 위해서**다. 상수는
 *  `const` 라 테스트가 뒤집을 수 없는데, 「신규」가 지금 2장이고 상수를 켜면 3장이 된다는 게
 *  설계 전제라 그걸 계약으로 박아 둬야 한다. 화면은 이 인자를 넘기지 않는다. */
export function productsFor(
  filter: FortuneFilter,
  sellable: readonly SajuProduct[] = purchasableSajuProducts()
): SajuProduct[] {
  if (filter.key === "new") {
    return NEW_SLUGS.map((slug) => sellable.find((p) => p.slug === slug)).filter(
      (p): p is SajuProduct => p !== undefined
    );
  }
  const category = filter.category;
  if (!category) return [...sellable];
  return sellable.filter((p) => p.categories.includes(category));
}

/** 카드 윗줄의 `카테고리들 · 태그`. 맨 뒤 한 칸만 태그이고 앞은 전부 카테고리다(설계 §3).
 *
 *  **`SajuCategory` 원래 값을 쓴다 — 칩·드로어의 표기 라벨이 아니다.** 여기서는 여러 개가
 *  ` · ` 로 이어지는데 라벨 쪽(`결혼 · 가족`)을 쓰면 `인생 · 결혼 · 가족 · 결혼` 이 되어
 *  카테고리가 넷으로 읽힌다. 이유는 `filters.ts` 의 `label` 주석에 같이 적어 뒀고, 두 표기가
 *  갈린 채로 남는지는 테스트가 지킨다. */
export function productMeta(product: SajuProduct): string {
  return [...product.categories, product.tag].join(" · ");
}

/** 「신규」가 상수를 켰을 때 몇 장이 되는지 재는 쪽에서 쓰는 전체 목록. 테스트 전용 별칭이
 *  아니라, 화면이 아닌 곳에서 "판매 여부와 무관한 전체"를 가리킬 때 쓰는 이름이다. */
export const ALL_SAJU_PRODUCTS = SAJU_PRODUCTS;
