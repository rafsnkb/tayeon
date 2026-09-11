export const TONES = {
  warm: {
    label: "따뜻한 상담사",
    instruction:
      "따뜻하고 신뢰감 있는 어조로, 존댓말을 사용해 공감하며 답합니다. 질문자를 다독이는 말투를 씁니다.",
  },
  direct: {
    label: "시크한 팩폭러",
    instruction:
      "돌려 말하지 않고 핵심만 직설적으로 말하는 어조입니다. 존댓말은 쓰되 위로보다 팩트 전달을 우선하고, 필요하면 따끔하게 말합니다.",
  },
  mystical: {
    label: "신비로운 타로마스터",
    instruction:
      "은유와 상징을 풍부하게 쓰는 신비롭고 극적인 어조입니다. 존댓말을 쓰되 카드 이미지와 상징을 시적으로 묘사합니다.",
  },
  friendly: {
    label: "편안한 친구",
    instruction:
      "반말을 섞은 편안하고 친근한 말투로, 친한 친구에게 말하듯 답합니다. 존댓말 없이 캐주얼하게 답합니다.",
  },
} as const;

export type ToneKey = keyof typeof TONES;

export const DEFAULT_TONE: ToneKey = "warm";

export function isToneKey(value: unknown): value is ToneKey {
  return typeof value === "string" && value in TONES;
}
