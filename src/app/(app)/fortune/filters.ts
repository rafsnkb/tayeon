import type { SajuCategory } from "@/lib/saju/products";

/** 운세 화면의 목록 필터 여덟 개. **목록 칩과 메뉴 드로어가 같은 표를 쓴다** — 둘이 각자
 *  배열을 들고 있으면 한쪽만 늘어난다.
 *
 *  「전체」·「신규」는 카테고리가 아니라 필터다(`products/index.ts` 의 `SajuCategory` 주석,
 *  설계 §3). 그래서 `category: null` 로 갈라 두고, 카테고리 여섯 개만 값을 갖는다.
 *
 *  `key` 가 URL(`/fortune?c=love`)과 아이콘 파일명(`fortune_category_love_dark.png`)을 동시에
 *  맡는다 — 설계 §3 의 「카테고리 ↔ 아이콘」 매핑표가 이미 이 영문 키를 정해 뒀고, 상품 정의에는
 *  아이콘 경로를 넣지 않는다(상품은 데이터, 아이콘은 화면 자산). */
export type FortuneFilterKey =
  | "all"
  | "new"
  | "life"
  | "love"
  | "compatibility"
  | "marriage"
  | "money"
  | "relationship";

export type FortuneFilter = {
  key: FortuneFilterKey;
  /** 칩·드로어 라벨이고, 섹션 헤딩의 앞말이다(`{label} 운세`).
   *
   *  **가운뎃점 양옆에 공백이 있다** — `SajuCategory` 값(`결혼·가족`)과 한 글자 다르다. 목업의
   *  칩과 드로어가 둘 다 공백을 넣어 그렸고, 실측 폭도 그래야 맞는다(`결혼 · 가족` 칩 101.7,
   *  공백 없이 그리면 91.7 로 10 좁다). 값이 아니라 **표기**라서 여기 둔다 — 필터링은 아래
   *  `category` 로 하므로 이 문자열이 데이터와 어긋날 일은 없다.
   *
   *  카드의 `카테고리들 · 태그` 줄은 반대로 **공백 없는 원래 값**을 쓴다. 거기서는 여러 개가
   *  ` · ` 로 이어지는데 `인생 · 결혼 · 가족 · 결혼` 이 되면 카테고리가 넷으로 읽힌다. */
  label: string;
  /** 카테고리 필터면 그 카테고리, 「전체」·「신규」면 null. */
  category: SajuCategory | null;
};

/** 배열 순서가 곧 칩과 드로어의 표시 순서다(목업 `Fortune_Home_*`·`MenuOpen_Fortune_*`). */
export const FORTUNE_FILTERS: readonly FortuneFilter[] = [
  { key: "all", label: "전체", category: null },
  { key: "new", label: "신규", category: null },
  { key: "life", label: "인생", category: "인생" },
  { key: "love", label: "연애", category: "연애" },
  { key: "compatibility", label: "궁합", category: "궁합" },
  { key: "marriage", label: "결혼 · 가족", category: "결혼·가족" },
  { key: "money", label: "직업 · 재물", category: "직업·재물" },
  { key: "relationship", label: "건강 · 인간관계", category: "건강·인간관계" },
];

export const ALL_FILTER = FORTUNE_FILTERS[0];

/** URL 의 `?c=` 값을 필터로. 모르는 값이면 「전체」 — 옛 링크나 손으로 고친 주소가 빈 화면을
 *  만들지 않게 한다. */
export function fortuneFilterFromKey(key: string | null | undefined): FortuneFilter {
  return FORTUNE_FILTERS.find((f) => f.key === key) ?? ALL_FILTER;
}

/** 그 필터로 열리는 목록 주소. 「전체」는 기본값이라 쿼리를 붙이지 않는다. */
export function fortuneListHref(key: FortuneFilterKey): string {
  return key === "all" ? "/fortune" : `/fortune?c=${key}`;
}

/** 드로어 아이콘 두 벌의 경로. 래스터라 `currentColor` 로 테마를 못 따라가서 모드별 파일이
 *  따로 있다(설계 §3) — 쓰는 쪽이 `dark:hidden` / `hidden dark:block` 으로 갈라 얹는다
 *  (`BrandBi` 와 같은 방식). */
export function fortuneFilterIcon(key: FortuneFilterKey): { light: string; dark: string } {
  return {
    light: `/icons/fortune_category_${key}_light.png`,
    dark: `/icons/fortune_category_${key}_dark.png`,
  };
}
