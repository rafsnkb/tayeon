import { calculateFourPillars } from "manseryeok";
import type { BirthInfo } from "@/lib/tarot/birthInfo";

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

  const result = calculateFourPillars({
    year,
    month,
    day,
    hour,
    minute,
    isLunar: birthInfo.calendarType === "lunar",
    dayBoundary: birthInfo.jasiRule,
    gender: birthInfo.gender,
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
