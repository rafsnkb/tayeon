import type { ComboKey } from "@/lib/tarot/pricing";
import { COUNT_PACKAGES } from "@/lib/tarot/pricing";

// 원본 성운 텍스처 4종(asset/texture/prizebg_tier_1~4.jpg → public/textures/tier-1~4.jpg) —
// 숫자가 낮을수록(1) 톤이 진한 핑크, 높을수록(4) 옅은 청록에 가깝다. 시간제 이용권 4종과
// 횟수제 상품 6종이 등급에 따라 이 4장을 나눠 쓴다(실제 매핑은 사용자가 직접 지정, 2026-09-14).
export const TIER_TEXTURE: Record<1 | 2 | 3 | 4, string> = {
  1: "/textures/tier-1.jpg",
  2: "/textures/tier-2.jpg",
  3: "/textures/tier-3.jpg",
  4: "/textures/tier-4.jpg",
};

/** 이용권 카드 한 장에 필요한 색 묶음. 쓰는 쪽은 전부 같은 모양이다 —
 *  테두리 `border`, 배경 텍스처 `bg`, 그리고 배지 알약의 `tagBg`/`tagText`. */
export type PassTier = { bg: string; border: string; tagBg: string; tagText: string };

/** **이용권 카드 팔레트의 단일 출처.** 등급은 색 이름으로 부른다 — 횟수제는 6단계,
 *  시간제는 조합 4종인데 둘이 같은 4색 사다리(청록→파랑→보라→코랄)를 공유하기 때문에
 *  "3단계"처럼 번호로 부르면 어느 쪽 번호인지 알 수 없다.
 *
 *  목업 "Buy - Coin.png"·"Buy - Timepass_15.png"를 sharp로 픽셀 샘플링해서 얻은 값
 *  (2026-09-14/09-19). 예전엔 이 표가 이 파일과 `/charge`의 `COUNT_TIERS`에 **두 벌로
 *  중복**돼 있었고, 실제로 코랄 등급이 한쪽은 `var(--point)`, 다른 쪽은 옛 CHZZK 핑크
 *  `#ff007f` 로 갈라져 있었다(2026-09-24 정리). */
const TIER = {
  teal: { bg: TIER_TEXTURE[4], border: "#9de9ed", tagBg: "rgba(12, 68, 86, 0.86)", tagText: "#9de9ed" },
  blue: { bg: TIER_TEXTURE[3], border: "#2f8bee", tagBg: "rgba(15, 52, 98, 0.86)", tagText: "#66b0ff" },
  violet: { bg: TIER_TEXTURE[2], border: "#8335d6", tagBg: "rgba(56, 24, 82, 0.86)", tagText: "#a04ff8" },
  // 최상위 등급만 브랜드 코랄이라 토큰을 따라간다 — 리디자인으로 --point 가 바뀌면 같이
  // 움직여야 하고, 라이트 모드에서도 --point 쪽이 맞는 값이다. tagBg 는 알약 뒤에 깔리는
  // 짙은 자주라 대응하는 토큰이 없어 실측값을 그대로 둔다.
  coral: { bg: TIER_TEXTURE[1], border: "var(--point)", tagBg: "rgba(82, 17, 59, 0.86)", tagText: "var(--point)" },
} as const satisfies Record<string, PassTier>;

/** 시간제 이용권 조합별 등급. /charge 시간제 탭과 대화 화면의 보유 이용권 카드가 같이 쓴다. */
export const TIME_COMBO_TIER: Record<ComboKey, PassTier> = {
  tarot: TIER.teal,
  "tarot-saju": TIER.blue,
  "tarot-ziwei": TIER.violet,
  "tarot-saju-ziwei": TIER.coral,
};

/** 상품 한 종류마다 그림이 따로 있다(목업 Buy_CountPass / Buy_TimePass, 2026-09-25).
 *  예전 카드는 등급 텍스처 4장을 여럿이 나눠 썼는데, 새 목업은 2열 그리드의 카드마다 고유한
 *  그림이 들어간다.
 *
 *  원본은 `asset/texture/` 의 1254px 정사각(합쳐 45MB)이라 그대로 web 에 못 올린다 —
 *  `scripts/build-pass-art.cjs` 가 `public/pass/` 에 **두 크기**로 만든다: 히어로용 1254px
 *  (`.webp`)와 목록 카드용 552px(`-card.webp`). 목록은 한 화면에 6장이 깔려서 히어로 크기를
 *  쓰면 그 화면만 1.2MB가 된다.
 *
 *  그림 자체에는 흰 그러데이션이 없다. 아래로 흐려지는 건 카드가 덧씌우는 것이다. */
const COUNT_PACKAGE_ART: Record<string, string> = {
  "count-starter": "/pass/count-starter.webp",
  "count-basic": "/pass/count-basic.webp",
  "count-standard": "/pass/count-standard.webp",
  "count-plus": "/pass/count-plus.webp",
  "count-premium": "/pass/count-premium.webp",
  "count-ultimate": "/pass/count-ultimate.webp",
};

/** `size: "card"` 는 목록 그리드용 552px 판을 준다. 기본은 히어로용 1254px. */
export function countPackageArt(productId: string, size: "hero" | "card" = "hero"): string {
  const base = COUNT_PACKAGE_ART[productId] ?? COUNT_PACKAGE_ART["count-starter"];
  return size === "card" ? base.replace(/\.webp$/, "-card.webp") : base;
}

/** 시간제는 "분 × 조합" 12종에 각각 그림이 있다. 파일 이름의 tier 1~4 는 COMBO_ORDER 순서
 *  (타로 / +사주 / +자미두수 / +사주+자미두수)와 같다 — 목업 카드와 원본을 나란히 놓고 확인했다. */
const TIME_COMBO_INDEX: Record<ComboKey, 1 | 2 | 3 | 4> = {
  tarot: 1,
  "tarot-saju": 2,
  "tarot-ziwei": 3,
  "tarot-saju-ziwei": 4,
};

export function timePassArt(minutes: number, combo: ComboKey, size: "hero" | "card" = "hero"): string {
  const suffix = size === "card" ? "-card" : "";
  return `/pass/time-${minutes}-${TIME_COMBO_INDEX[combo] ?? 1}${suffix}.webp`;
}

// 위 표가 상품 목록과 어긋나면 개발 중에 바로 알 수 있게 해 둔다 — 그림이 하나 빠져도 화면은
// 그럭저럭 그려지기 때문에 눈으로는 늦게 발견된다.
if (process.env.NODE_ENV !== "production") {
  const missing = COUNT_PACKAGES.filter((pkg) => !(pkg.id in COUNT_PACKAGE_ART)).map((pkg) => pkg.id);
  if (missing.length > 0) {
    console.warn(`[passTiers] 그림이 없는 횟수제 상품: ${missing.join(", ")}`);
  }
}
