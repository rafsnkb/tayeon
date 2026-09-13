import { calculateFourPillars } from "manseryeok";
import type { BirthInfo } from "@/lib/tarot/birthInfo";
import { lookupLongitude } from "./cityLongitude";

export type SajuResult = {
  pillars: { year: string; month: string; day: string; hour: string | null };
  tenGods: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string } | null;
  };
  voidBranches: string[];
  timeUnknown: boolean;
};

export function calculateSaju(birthInfo: BirthInfo): SajuResult | null {
  if (!birthInfo.birthDate) return null;

  const [year, month, day] = birthInfo.birthDate.split("-").map(Number);
  const [hour, minute] =
    !birthInfo.timeUnknown && birthInfo.birthTime
      ? birthInfo.birthTime.split(":").map(Number)
      : [12, 0];

  const longitude = lookupLongitude(birthInfo.birthPlace);

  const result = calculateFourPillars({
    year,
    month,
    day,
    hour,
    minute,
    isLunar: birthInfo.calendarType === "lunar",
    isLeapMonth: birthInfo.calendarType === "lunar" ? birthInfo.isLeapMonth : undefined,
    dayBoundary: birthInfo.jasiRule,
    // "unspecified"는 대운(大運) 방향 계산을 생략하도록 gender 자체를 안 넘김 — 사주 팔자 본체
    // (연월일시주)는 성별과 무관해서 정확도에 영향 없음(src/lib/tarot/birthInfo.ts 주석 참고).
    gender: birthInfo.gender === "unspecified" ? undefined : birthInfo.gender,
    // 한반도 평균 경도(127.5°) 기준 진태양시 보정 — 사용자가 켠 경우에만 적용, 기본은 라이브러리
    // 기본값(보정 없음, 정시 기준)과 동일하게 OFF. 출생지가 알려진 도시와 매칭되면 평균값 대신
    // 그 도시의 실제 경도를 사용(src/lib/saju/cityLongitude.ts).
    trueSolarTime: birthInfo.useTrueSolarTime
      ? longitude !== null
        ? { longitude }
        : {}
      : undefined,
  });

  const obj = result.toObject();

  return {
    pillars: {
      year: obj.year,
      month: obj.month,
      day: obj.day,
      hour: birthInfo.timeUnknown ? null : obj.hour,
    },
    tenGods: {
      year: result.tenGods.year,
      month: result.tenGods.month,
      day: result.tenGods.day,
      hour: birthInfo.timeUnknown ? null : result.tenGods.hour,
    },
    voidBranches: result.voidBranches,
    timeUnknown: birthInfo.timeUnknown,
  };
}

export function buildSajuPromptBlock(saju: SajuResult): string {
  const lines = [
    `- 연주: ${saju.pillars.year} (십신 - 천간: ${saju.tenGods.year.stem}, 지지: ${saju.tenGods.year.branch})`,
    `- 월주: ${saju.pillars.month} (십신 - 천간: ${saju.tenGods.month.stem}, 지지: ${saju.tenGods.month.branch})`,
    `- 일주: ${saju.pillars.day} (일간 기준)`,
  ];

  if (saju.pillars.hour) {
    lines.push(
      `- 시주: ${saju.pillars.hour} (십신 - 천간: ${saju.tenGods.hour?.stem}, 지지: ${saju.tenGods.hour?.branch})`
    );
  } else {
    lines.push("- 시주: 태어난 시간 모름 (시주는 해석에서 제외)");
  }

  lines.push(`- 공망: ${saju.voidBranches.join(", ")}`);

  return lines.join("\n");
}
