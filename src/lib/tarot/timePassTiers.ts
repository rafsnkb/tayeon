// 피그마 "HeldTimepass_15/30/60min" 및 "Buy - Coin"(이용권 탭) 카드의 티어별 배경(성운 텍스처,
// asset/texture/prizebg_tier_*)과 배지 색 — /tarot의 보유 이용권 모달과 /charge 양쪽에서 같이 쓴다.
export const TIME_PASS_TIER: Record<
  number,
  { bg: string; border: string; tagBg: string; tagText: string }
> = {
  15: { bg: "/timepass/tier-15.jpg", border: "#2f8bee", tagBg: "#122337", tagText: "#66b0ff" },
  30: { bg: "/timepass/tier-30.jpg", border: "#8335d6", tagBg: "#28173b", tagText: "#a04ff8" },
  60: { bg: "/timepass/tier-60.jpg", border: "#ff007f", tagBg: "#2c1322", tagText: "#ff007f" },
};
