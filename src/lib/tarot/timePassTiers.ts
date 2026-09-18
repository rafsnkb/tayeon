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

// 시간제 이용권이 조합(ComboKey) 4종으로 개편되며(2026-09-19) 추가된 조합별 티어 색 — 목업
// "Buy - Timepass_15.png"를 sharp로 픽셀 샘플링해서 확인(청록/파랑/보라/핑크가 COUNT_TIERS와
// 정확히 같은 팔레트). /charge 시간제 탭과 /tarot의 보유 이용권 카드가 같이 쓴다.
export const TIME_COMBO_TIER: Record<
  "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei",
  { bg: string; border: string; tagBg: string; tagText: string }
> = {
  tarot: { bg: TIER_TEXTURE[4], border: "#9de9ed", tagBg: "rgba(12, 68, 86, 0.86)", tagText: "#9de9ed" },
  "tarot-saju": { bg: TIER_TEXTURE[3], border: "#2f8bee", tagBg: "rgba(15, 52, 98, 0.86)", tagText: "#66b0ff" },
  "tarot-ziwei": { bg: TIER_TEXTURE[2], border: "#8335d6", tagBg: "rgba(56, 24, 82, 0.86)", tagText: "#a04ff8" },
  "tarot-saju-ziwei": { bg: TIER_TEXTURE[1], border: "#ff007f", tagBg: "rgba(82, 17, 59, 0.86)", tagText: "#ff007f" },
};
