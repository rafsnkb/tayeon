// 원본 성운 텍스처 4종(asset/texture/prizebg_tier_1~4.jpg → public/textures/tier-1~4.jpg) —
// 숫자가 낮을수록(1) 톤이 진한 핑크, 높을수록(4) 옅은 청록에 가깝다. 시간제 이용권 3종과 코인
// 상품 7종이 등급에 따라 이 4장을 나눠 쓴다(실제 매핑은 사용자가 직접 지정, 2026-09-14).
export const TIER_TEXTURE: Record<1 | 2 | 3 | 4, string> = {
  1: "/textures/tier-1.jpg",
  2: "/textures/tier-2.jpg",
  3: "/textures/tier-3.jpg",
  4: "/textures/tier-4.jpg",
};

// 피그마 "HeldTimepass_15/30/60min" 및 "Buy - Coin"(이용권 탭) 카드의 티어별 배경/배지 색 —
// /tarot의 보유 이용권 모달과 /charge 양쪽에서 같이 쓴다.
export const TIME_PASS_TIER: Record<
  number,
  { bg: string; border: string; tagBg: string; tagText: string }
> = {
  15: { bg: TIER_TEXTURE[3], border: "#2f8bee", tagBg: "#122337", tagText: "#66b0ff" },
  30: { bg: TIER_TEXTURE[2], border: "#8335d6", tagBg: "#28173b", tagText: "#a04ff8" },
  60: { bg: TIER_TEXTURE[1], border: "#ff007f", tagBg: "#2c1322", tagText: "#ff007f" },
};
