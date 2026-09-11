export type JasiRule = "midnight" | "jasi" | "splitJasi";

export type BirthInfo = {
  calendarType: "solar" | "lunar";
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean;
  jasiRule: JasiRule;
  gender: "male" | "female";
};

export const JASI_RULE_LABEL: Record<JasiRule, string> = {
  midnight: "일반 (자시 23:00~01:00을 당일로 계산, 기본값)",
  jasi: "야자시론 (자시 전체를 다음날로 계산)",
  splitJasi: "조자시/야자시 구분 (일주는 당일, 시주만 다음날 기준)",
};

const VALID_JASI_RULES: JasiRule[] = ["midnight", "jasi", "splitJasi"];

/** 계산 라이브러리에 넘기기 전 필수 필드가 유효한 형태인지 확인 (구버전 스키마로 저장된 데이터 방어) */
export function isValidBirthInfo(info: unknown): info is BirthInfo {
  if (!info || typeof info !== "object") return false;
  const b = info as Partial<BirthInfo>;
  return (
    typeof b.birthDate === "string" &&
    b.birthDate.length > 0 &&
    (b.gender === "male" || b.gender === "female") &&
    (b.calendarType === "solar" || b.calendarType === "lunar") &&
    typeof b.jasiRule === "string" &&
    VALID_JASI_RULES.includes(b.jasiRule as JasiRule)
  );
}
