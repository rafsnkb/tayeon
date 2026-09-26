import { SAJU_PRODUCTS } from "@/lib/saju/products";

/** 상품 썸네일 조회는 여기 한 곳뿐이다. 여기 말고 어디서도 슬러그로 그림을 찾지 말 것.
 *
 *  에셋 19종이 `asset/texture/fortune_prizeimage_{slug}.png` 로 들어왔다(2026-09-26). 저장소엔
 *  안 둔다(`/asset/texture/` gitignore) — `scripts/build-fortune-art.cjs` 가 `public/fortune/`
 *  에 두 해상도로 구워 두고, 커밋 대상은 그 결과물이다(`build-pass-art.cjs` 와 같은 구조).
 *  `SajuProduct.image` 는 리포트 **안에** 들어갈 생성 이미지의 지시문이라 이것과 다른 물건이다.
 *
 *  카테고리 아이콘(`public/icons/fortune_category_*`)을 여기 끌어다 쓰지 않는다: 그건 메뉴
 *  드로어의 8줄용이고(설계 §3 「카테고리 ↔ 아이콘」), 상품 썸네일 자리는 사진이다. */
const PRODUCT_ART = new Set([
  "business-partnership",
  "career-fit",
  "couple-compatibility",
  "crush-reading",
  "exam-fortune",
  "family-planning",
  "intimacy-compatibility",
  "life-overview",
  "marriage-compatibility",
  "marriage-timing",
  "new-year-fortune",
  "personality-compatibility",
  "relationship-destiny",
  "reunion-reading",
  "single-love",
  "situationship-reading",
  "skinship-compatibility",
  "wealth-flow",
  "wellness-rhythm",
]);

/** hero = 상세 히어로(풀블리드, 원본 해상도) · card = 목록·보관함 카드(384px, `w-32` 3배).
 *  원본이 4:3 이고 세 화면 다 4:3 이라 크롭은 없다 — 해상도만 갈린다. */
export function productArt(slug: string, size: "hero" | "card" = "hero"): string | null {
  const suffix = size === "card" ? "-card" : "";
  return PRODUCT_ART.has(slug) ? `/fortune/${slug}${suffix}.webp` : null;
}

// 상품이 늘어나는데 그림이 안 따라오면 화면은 자리표로 그럭저럭 그려져서 눈으로는 늦게
// 발견된다 — `passTiers.ts` 와 같은 개발용 경고.
if (process.env.NODE_ENV !== "production") {
  const missing = SAJU_PRODUCTS.filter((p) => !PRODUCT_ART.has(p.slug)).map((p) => p.slug);
  if (missing.length > 0) {
    console.warn(`[productArt] 그림이 없는 상품: ${missing.join(", ")}`);
  }
}
