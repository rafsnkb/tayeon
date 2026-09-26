import { calculateFourPillars, getHeavenlyStemElement, getEarthlyBranchElement } from "manseryeok";
import type { HeavenlyStem, EarthlyBranch } from "manseryeok";
import type { BirthInfo } from "@/lib/tarot/birthInfo";
import { lookupLongitude } from "./cityLongitude";

/**
 * 신살(神殺) — 지금은 도화·역마 둘뿐이다(2026-09-27, 사용자 승인 — "신살은 내용 해석에
 * 필요하면 해"). 임의로 목록을 늘리지 않는다: 19개 상품의 `sajuFocus`·`crossPoints`·섹션
 * 제목을 읽고 실제로 본문이 근거로 대는 것만 골랐다 — 도화는 연애·궁합 상품군, 역마는
 * `life-overview` 의 "환경이 바뀌는 흐름" 장이 이미 그 이름("moves-changes")을 쓰고 있다.
 * 천을귀인·화개 등은 후보였지만 **확신이 서는 유파 기준을 찾지 못해 뺐다** — 다섯 개를
 * 반만 맞히느니 두 개를 확실히 맞히는 편이 낫다(2026-09-27 지시).
 *
 * `manseryeok` 은 신살을 제공하지 않는다(패키지 export 목록 확인, 2026-09-27) — 그래서
 * 직접 판정한다. 계산 자체는 새로 만들지 않는다 — **이미 계산된 지지 8개**를 놓고 고전
 * 삼합(三合) 표에 대조하는 것뿐이다.
 */
export type SpecialStar = "도화" | "역마";

/** 이 신살이 실제로 있을 때만 담는다(없으면 그 신살 자체가 배열에 없다 — "0개"를 빈 문자열
 *  값으로 표현하지 않는다, `SajuReadingPage` 의 실패 자리표와 같은 원칙). */
export type SpecialStarHit = {
  star: SpecialStar;
  /** 실제로 그 신살에 해당하는 지지 한 글자. */
  branch: string;
  /** 어느 기둥(들)에 있는지 — 같은 지지가 두 기둥에 겹칠 수 있다(예: 연지·월지가 같은 경우). */
  positions: ("year" | "month" | "day" | "hour")[];
};

/**
 * 도화·역마 판정 기준: **일지(day branch) 기준.**
 *
 * 신살은 유파마다 기준이 갈린다 — 년지 기준(고전, 씨족·조상 중심)과 일지 기준(현대 개인 사주
 * 상담에서 널리 씀, 일간을 "나"로 보는 것과 같은 축)이 둘 다 실제로 쓰인다. 이 저장소는 이미
 * 일간·일지를 "나"의 중심으로 다룬다(§ `SajuPillars` 화면이 일주만 따로 강조하는 것과 같은
 * 이유) — 그래서 년지가 아니라 **일지**를 기준으로 잡는다. 년지 기준 결과는 계산하지 않는다.
 *
 * 삼합(三合) 표(사유축→금, 신자진→수, 인오술→화, 해묘미→목)의 생지 대응:
 * - 인오술(寅午戌) 그룹 → 도화 묘(卯), 역마 신(申)
 * - 사유축(巳酉丑) 그룹 → 도화 오(午), 역마 해(亥)
 * - 신자진(申子辰) 그룹 → 도화 유(酉), 역마 인(寅)
 * - 해묘미(亥卯未) 그룹 → 도화 자(子), 역마 사(巳)
 *
 * 진도화(眞桃花)·가도화(假桃花) 같은 위치별 세부 구분은 넣지 않는다 — 그 구분까지 확신이
 * 서지 않아 "있다/없다"만 판정한다(위 머리말 "확신이 안 서는 신살은 넣지 마세요").
 */
const SPECIAL_STAR_GROUPS: { members: string[]; peachBlossom: string; travelingHorse: string }[] = [
  { members: ["인", "오", "술"], peachBlossom: "묘", travelingHorse: "신" },
  { members: ["사", "유", "축"], peachBlossom: "오", travelingHorse: "해" },
  { members: ["신", "자", "진"], peachBlossom: "유", travelingHorse: "인" },
  { members: ["해", "묘", "미"], peachBlossom: "자", travelingHorse: "사" },
];

function branchOf(ganji: string): string {
  return ganji.charAt(1);
}

// exported for calculate.test.mjs — 실제 사주 데이터 없이 지지 조합만으로 판정을 검증하려면
// 이 함수를 직접 불러야 한다.
export function calculateSpecialStars(pillars: SajuResult["pillars"]): SpecialStarHit[] {
  const dayBranch = branchOf(pillars.day);
  const group = SPECIAL_STAR_GROUPS.find((g) => g.members.includes(dayBranch));
  if (!group) return []; // 이론상 12지지가 네 그룹에 다 들어가 있어 여기 오지 않는다 — 방어적으로만 둔다.

  const positions: { pos: "year" | "month" | "day" | "hour"; branch: string }[] = [
    { pos: "year", branch: branchOf(pillars.year) },
    { pos: "month", branch: branchOf(pillars.month) },
    { pos: "day", branch: dayBranch },
    ...(pillars.hour ? [{ pos: "hour" as const, branch: branchOf(pillars.hour) }] : []),
  ];

  const hits: SpecialStarHit[] = [];
  const peachPositions = positions.filter((p) => p.branch === group.peachBlossom).map((p) => p.pos);
  if (peachPositions.length > 0) hits.push({ star: "도화", branch: group.peachBlossom, positions: peachPositions });
  const horsePositions = positions.filter((p) => p.branch === group.travelingHorse).map((p) => p.pos);
  if (horsePositions.length > 0) hits.push({ star: "역마", branch: group.travelingHorse, positions: horsePositions });
  return hits;
}

export type FiveElement = "목" | "화" | "토" | "금" | "수";

/** 오행 개수 — 네 기둥의 천간·지지를 센다. 시간을 모르면 시주 두 글자가 빠져 6개만 센다.
 *  숫자를 직접 표로 만들지 않는다 — `manseryeok` 의 `getHeavenlyStemElement`/
 *  `getEarthlyBranchElement` 를 그대로 쓴다(2026-09-27 지시 — 표를 다시 적으면 틀릴 여지가
 *  생긴다). */
export function calculateElementCounts(pillars: SajuResult["pillars"]): Record<FiveElement, number> {
  const counts: Record<FiveElement, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const ganjis = [pillars.year, pillars.month, pillars.day, pillars.hour].filter((g): g is string => g !== null);
  for (const ganji of ganjis) {
    // 값 자체는 manseryeok 이 만든 진짜 간지 문자열에서 꺼낸 것이라 항상 유효한 천간·지지
    // 글자다 — `charAt` 의 반환 타입이 리터럴 유니온으로 좁혀지지 않을 뿐이다.
    counts[getHeavenlyStemElement(ganji.charAt(0) as HeavenlyStem) as FiveElement] += 1;
    counts[getEarthlyBranchElement(ganji.charAt(1) as EarthlyBranch) as FiveElement] += 1;
  }
  return counts;
}

export type SajuResult = {
  pillars: { year: string; month: string; day: string; hour: string | null };
  tenGods: {
    year: { stem: string; branch: string };
    month: { stem: string; branch: string };
    day: { stem: string; branch: string };
    hour: { stem: string; branch: string } | null;
  };
  voidBranches: string[];
  /** 있는 신살만 담는다 — 도화 역마 둘 다 없으면 빈 배열이다. */
  specialStars: SpecialStarHit[];
  /** 오행별 개수. 8개(시간 모르면 6개) 총합이 항상 이 값들의 합과 같다. */
  elementCounts: Record<FiveElement, number>;
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
  const pillars = {
    year: obj.year,
    month: obj.month,
    day: obj.day,
    hour: birthInfo.timeUnknown ? null : obj.hour,
  };

  return {
    pillars,
    tenGods: {
      year: result.tenGods.year,
      month: result.tenGods.month,
      day: result.tenGods.day,
      hour: birthInfo.timeUnknown ? null : result.tenGods.hour,
    },
    voidBranches: result.voidBranches,
    specialStars: calculateSpecialStars(pillars),
    elementCounts: calculateElementCounts(pillars),
    timeUnknown: birthInfo.timeUnknown,
  };
}

const PILLAR_LABEL_KO = { year: "연주", month: "월주", day: "일주", hour: "시주" } as const;

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

  // "이 둘 외엔 계산 안 한다"는 도화·역마가 있든 없든 항상 말해야 한다 — 둘 다 없는 사람에게
  // 모델이 천을귀인·화개 같은 다른 신살을 지어낼 여지가 여기서도 그대로 열려 있다.
  const specialStarsText =
    saju.specialStars.length > 0
      ? saju.specialStars
          .map((hit) => `${hit.star}(${hit.branch}, ${hit.positions.map((p) => PILLAR_LABEL_KO[p]).join("·")})`)
          .join(", ")
      : "없음";
  lines.push(`- 신살(일지 기준 삼합 판정, 도화·역마만 계산함 — 이 둘 외의 신살은 언급하지 말 것): ${specialStarsText}`);

  const elementOrder: FiveElement[] = ["목", "화", "토", "금", "수"];
  lines.push(`- 오행 개수: ${elementOrder.map((e) => `${e}${saju.elementCounts[e]}`).join(" ")}`);

  return lines.join("\n");
}
