import { calculateFourPillars } from "manseryeok";
import type { BirthInfo } from "@/lib/tarot/birthInfo";

/* 사주의 **시간축** — 대운(大運)·세운(歲運)·월운(月運).
 *
 * `calculate.ts` 는 태어난 순간의 고정된 판(팔자·십신·공망)만 낸다. 그것만으로는 "언제쯤
 * 풀릴까", "몇 월이 좋을까" 같은 질문에 사주 쪽이 댈 근거가 하나도 없다. 타로는 카드가 흐름을
 * 맡아 줘서 티가 안 났을 뿐이고, 실제로 `prompt.ts` 는 이미 "월운·세운을 근거로 시기를 말할 땐
 * 오늘 날짜를 기준으로 판단하라"고 지시하면서 정작 그 월운·세운을 준 적이 없었다(2026-09-26).
 *
 * 새로 계산하는 알고리즘은 없다 — manseryeok 이 이미 주는 값을 꺼내 쓰는 게 전부다. */

export type SajuFortune = {
  /** 대운. 성별이 "unspecified" 면 manseryeok 이 방향을 못 정해 계산 자체를 생략한다 → null */
  luck: {
    forward: boolean;
    pillars: { age: number; korean: string }[];
    /** 지금 지나고 있는 대운의 시작 나이. 목록에서 이 값을 가진 항목이 현재 대운이다. */
    currentAge: number | null;
  } | null;
  /** 작년·올해·내년의 연주 */
  annual: { year: number; pillar: string }[];
  /** 올해 열두 달의 월주 */
  monthly: { month: number; pillar: string }[];
};

/** 절기 경계에 걸리지 않도록 달 한가운데를 기준 삼아 그 달/해의 간지를 뽑는다. */
function pillarsOf(year: number, month: number) {
  return calculateFourPillars({
    year,
    month,
    day: 15,
    hour: 12,
    minute: 0,
    dayBoundary: "midnight",
  }).toObject();
}

/** 대운은 태어난 뒤 startYears년 startMonths개월 startDays일 지나 시작하고 10년마다 바뀐다.
 *  만 나이로 어림하지 않고 그 전환일을 실제로 짚어야 경계에 선 사람이 틀리지 않는다. */
function currentLuckStartAge(
  birthDate: Date,
  today: Date,
  info: { startYears: number; startMonths: number; startDays: number; pillars: { age: number }[] }
): number | null {
  let current: number | null = null;
  for (const pillar of info.pillars) {
    const at = new Date(birthDate);
    at.setFullYear(at.getFullYear() + info.startYears + (pillar.age - info.pillars[0].age));
    at.setMonth(at.getMonth() + info.startMonths);
    at.setDate(at.getDate() + info.startDays);
    if (at <= today) current = pillar.age;
  }
  return current;
}

export function calculateSajuFortune(birthInfo: BirthInfo, today: Date): SajuFortune | null {
  if (!birthInfo.birthDate) return null;

  const [year, month, day] = birthInfo.birthDate.split("-").map(Number);
  const [hour, minute] =
    !birthInfo.timeUnknown && birthInfo.birthTime
      ? birthInfo.birthTime.split(":").map(Number)
      : [12, 0];

  let luck: SajuFortune["luck"] = null;
  try {
    const result = calculateFourPillars({
      year,
      month,
      day,
      hour,
      minute,
      isLunar: birthInfo.calendarType === "lunar",
      isLeapMonth: birthInfo.calendarType === "lunar" ? birthInfo.isLeapMonth : undefined,
      dayBoundary: birthInfo.jasiRule,
      gender: birthInfo.gender === "unspecified" ? undefined : birthInfo.gender,
    });
    const info = result.luckPillars;
    if (info && info.pillars.length > 0) {
      luck = {
        forward: info.forward,
        pillars: info.pillars.map((p) => ({ age: p.age, korean: p.korean })),
        currentAge: currentLuckStartAge(new Date(year, month - 1, day), today, info),
      };
    }
  } catch {
    luck = null;
  }

  const thisYear = today.getFullYear();
  const annual: SajuFortune["annual"] = [];
  const monthly: SajuFortune["monthly"] = [];
  try {
    for (const y of [thisYear - 1, thisYear, thisYear + 1]) {
      annual.push({ year: y, pillar: pillarsOf(y, 6).year });
    }
    for (let m = 1; m <= 12; m++) {
      monthly.push({ month: m, pillar: pillarsOf(thisYear, m).month });
    }
  } catch {
    // 간지 계산이 실패하면 시간축만 빠지고 원국 해석은 그대로 나간다.
  }

  if (!luck && annual.length === 0) return null;
  return { luck, annual, monthly };
}

export function buildSajuFortunePromptBlock(fortune: SajuFortune, today: Date): string {
  const lines: string[] = [];

  if (fortune.luck) {
    const list = fortune.luck.pillars
      .map((p) => `${p.age}세 ${p.korean}${p.age === fortune.luck?.currentAge ? "(지금 이 대운)" : ""}`)
      .join(" / ");
    lines.push(`- 대운(${fortune.luck.forward ? "순행" : "역행"}): ${list}`);
  } else {
    lines.push("- 대운: 성별 정보가 없어 계산하지 않음 (대운을 근거로 시기를 말하지 말 것)");
  }

  if (fortune.annual.length > 0) {
    lines.push(`- 세운: ${fortune.annual.map((a) => `${a.year}년 ${a.pillar}`).join(" / ")}`);
  }
  if (fortune.monthly.length > 0) {
    lines.push(
      `- ${today.getFullYear()}년 월운: ${fortune.monthly.map((m) => `${m.month}월 ${m.pillar}`).join(", ")}`
    );
  }

  return lines.join("\n");
}
