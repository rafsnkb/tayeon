import { astro } from "iztro";
import type { GenderName } from "iztro/lib/i18n";
import type { BirthInfo } from "@/lib/tarot/birthInfo";

const GENDER_LABEL: Record<BirthInfo["gender"], GenderName> = {
  male: "남성",
  female: "여자",
};

/** 00:00 기준 13개 시진 구간의 timeIndex. 0=00:00~01:00 ... 12=23:00~24:00 */
function resolveTimeIndex(
  hour: number,
  jasiRule: BirthInfo["jasiRule"]
): { timeIndex: number; dayOffset: number } {
  if (hour === 23) {
    // 23:00~23:59 구간 — 자시 관법에 따라 당일(index 12) 또는 다음날(index 0)로 처리
    if (jasiRule === "midnight") return { timeIndex: 12, dayOffset: 0 };
    return { timeIndex: 0, dayOffset: 1 };
  }
  if (hour === 0) {
    return { timeIndex: 0, dayOffset: 0 };
  }
  // 01:00~01:00 구간마다 하나씩, 1시부터 2시간 단위로 index 1~11
  const index = Math.floor((hour - 1) / 2) + 1;
  return { timeIndex: Math.min(index, 11), dayOffset: 0 };
}

function addDays(year: number, month: number, day: number, offset: number): [number, number, number] {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
}

export type ZiweiResult = {
  soul: string;
  body: string;
  fiveElementsClass: string;
  sign: string;
  zodiac: string;
  palaces: { name: string; majorStars: string[]; minorStars: string[] }[];
  timeUnknown: boolean;
};

export function calculateZiwei(birthInfo: BirthInfo): ZiweiResult | null {
  if (!birthInfo.birthDate) return null;

  const [year, month, day] = birthInfo.birthDate.split("-").map(Number);
  const [hour] =
    !birthInfo.timeUnknown && birthInfo.birthTime
      ? birthInfo.birthTime.split(":").map(Number)
      : [12];

  const { timeIndex, dayOffset } = birthInfo.timeUnknown
    ? { timeIndex: 6, dayOffset: 0 } // 정오(11-13시) 시진으로 대체, 시주/명궁 정확도는 낮아짐
    : resolveTimeIndex(hour, birthInfo.jasiRule);

  const [y, m, d] = addDays(year, month, day, dayOffset);
  const dateStr = `${y}-${m}-${d}`;
  const gender = GENDER_LABEL[birthInfo.gender];

  const astrolabe =
    birthInfo.calendarType === "lunar"
      ? astro.byLunar(dateStr, timeIndex, gender, false, true, "ko-KR")
      : astro.bySolar(dateStr, timeIndex, gender, true, "ko-KR");

  const json = astrolabe.toJSON();

  return {
    soul: json.soul,
    body: json.body,
    fiveElementsClass: json.fiveElementsClass,
    sign: json.sign,
    zodiac: json.zodiac,
    palaces: json.palaces.map((p) => ({
      name: p.name,
      majorStars: p.majorStars.map((s) => s.name),
      minorStars: p.minorStars.map((s) => s.name),
    })),
    timeUnknown: birthInfo.timeUnknown,
  };
}

export function buildZiweiPromptBlock(ziwei: ZiweiResult): string {
  const palaceLines = ziwei.palaces
    .map((p) => {
      const stars = [...p.majorStars, ...p.minorStars].join(", ") || "(주요 성 없음)";
      const label = p.name.endsWith("궁") ? p.name : `${p.name}궁`;
      return `  - ${label}: ${stars}`;
    })
    .join("\n");

  return [
    `- 명궁 주성(soul): ${ziwei.soul} / 신궁 주성(body): ${ziwei.body}`,
    `- 오행국: ${ziwei.fiveElementsClass}`,
    ziwei.timeUnknown ? "- 태어난 시간 모름: 명궁·신궁 위치의 정확도가 낮을 수 있음을 감안해서 해석" : "",
    "- 12궁 성 배치:",
    palaceLines,
  ]
    .filter(Boolean)
    .join("\n");
}
