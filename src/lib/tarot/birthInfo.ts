export type JasiRule = "midnight" | "jasi" | "splitJasi";

export type BirthInfo = {
  calendarType: "solar" | "lunar";
  /** 음력 윤달 여부 — calendarType이 "lunar"일 때만 의미 있음. manseryeok의 isLeapMonth로 직결. */
  isLeapMonth: boolean;
  birthDate: string | null;
  birthTime: string | null;
  timeUnknown: boolean;
  jasiRule: JasiRule;
  /** manseryeok의 대운(大運) 방향 계산에 쓰이는 값 — "unspecified"는 대운 계산을 생략하도록
   * gender를 아예 넘기지 않는다(src/lib/saju/calculate.ts). 사주 팔자 본체(연월일시주)는 성별과
   * 무관해서 "unspecified"를 골라도 그 부분 정확도엔 영향 없음. */
  gender: "male" | "female" | "unspecified";
  /** 진태양시(眞太陽時) 보정 — 표준시(동경 135°)와 한반도 실제 경도(약 127°) 차이로 생기는
   * 약 30분의 시차를 보정해서 시주/일주를 판정할지 여부. 기본 false(보정 없음, 정시 기준).
   * 사주(manseryeok)에만 적용되고 자미두수(iztro)는 이 옵션과 무관하게 항상 정시 기준. */
  useTrueSolarTime: boolean;
  /** 출생지(선택) — 자유 입력 텍스트. src/lib/saju/cityLongitude.ts에서 알려진 도시와 매칭되면
   * 진태양시 보정에 한반도 평균 경도(127.5°) 대신 그 도시의 실제 경도를 사용한다. 매칭 안 되면
   * 저장만 되고 계산에는 영향 없음(그래도 보정 자체가 꺼져 있으면 이 필드는 아무 효과 없음). */
  birthPlace: string | null;
};

export const JASI_RULE_LABEL: Record<JasiRule, string> = {
  midnight: "일반 (자시 23:00~01:00을 당일로 계산, 기본값)",
  jasi: "야자시론 (자시 전체를 다음날로 계산)",
  splitJasi: "조자시/야자시 구분 (일주는 당일, 시주만 다음날 기준)",
};

// 설정 화면의 세그먼트 버튼(짧은 라벨)과 그 아래 설명 박스(긴 설명)는 서로 다른 텍스트를 써야 함
// (피그마 확인: 설명 박스에 "일반"/"기본값" 같은 라벨 반복이 없음, 2026-09-14) — 버튼엔 짧은 쪽,
// 설명 박스엔 긴 쪽만 쓴다.
export const JASI_RULE_SHORT_LABEL: Record<JasiRule, string> = {
  midnight: "일반",
  jasi: "야자시론",
  splitJasi: "조자시/야자시",
};

export const JASI_RULE_DESCRIPTION: Record<JasiRule, string> = {
  midnight: "자시 23:00~01:00을 당일로 계산",
  jasi: "자시 전체를 다음날로 계산",
  splitJasi: "일주는 당일, 시주만 다음날 기준",
};

const VALID_JASI_RULES: JasiRule[] = ["midnight", "jasi", "splitJasi"];

/** 계산 라이브러리에 넘기기 전 필수 필드가 유효한 형태인지 확인 (구버전 스키마로 저장된 데이터 방어) */
export function isValidBirthInfo(info: unknown): info is BirthInfo {
  if (!info || typeof info !== "object") return false;
  const b = info as Partial<BirthInfo>;
  return (
    typeof b.birthDate === "string" &&
    b.birthDate.length > 0 &&
    (b.gender === "male" || b.gender === "female" || b.gender === "unspecified") &&
    (b.calendarType === "solar" || b.calendarType === "lunar") &&
    typeof b.jasiRule === "string" &&
    VALID_JASI_RULES.includes(b.jasiRule as JasiRule)
  );
}
