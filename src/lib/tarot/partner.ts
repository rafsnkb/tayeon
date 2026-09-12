import type { BirthInfo } from "./birthInfo";

export type Partner = {
  nickname: string;
  birthDate: string | null;
  birthTime: string | null;
  gender: "male" | "female" | "unspecified";
  calendarType?: "solar" | "lunar";
};

export function isValidPartner(value: unknown): value is Partner {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Partner>;
  return typeof p.nickname === "string" && p.nickname.length > 0;
}

/**
 * 상대 정보는 마찰을 줄이기 위해 자시법은 따로 입력받지 않고 일반 자시법(자정 기준)을 기본값으로 가정한다.
 * calendarType은 저장 이전 데이터 호환을 위해 없으면 양력으로 간주한다.
 * 생년월일 또는 성별(남/여)이 없으면 계산할 수 없으므로 null을 반환한다.
 */
export function partnerToBirthInfo(partner: Partner): BirthInfo | null {
  if (!partner.birthDate) return null;
  if (partner.gender !== "male" && partner.gender !== "female") return null;

  return {
    calendarType: partner.calendarType ?? "solar",
    birthDate: partner.birthDate,
    birthTime: partner.birthTime,
    timeUnknown: !partner.birthTime,
    jasiRule: "midnight",
    // 상대 정보는 마찰 감소를 위해 자시법과 마찬가지로 진태양시 보정도 따로 입력받지 않고 고정.
    useTrueSolarTime: false,
    gender: partner.gender,
  };
}
