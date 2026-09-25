import type { BirthInfo } from "@/lib/tarot/birthInfo";
import { buildAstrolabe } from "./calculate";

/* 자미두수의 **시간축** — 대한(大限)·유년(流年)과 사화(四化).
 *
 * `calculate.ts` 는 태어난 순간의 명반(명궁·12궁·성 배치)만 낸다. 자미두수에서 "지금 어떤가"를
 * 말하려면 그 위에 대한과 유년이 얹혀야 하고, 무엇보다 **사화가 없으면 어느 별이 지금 힘을 받는지
 * 알 수 없다.** 그동안 타로 프롬프트에 사화가 통째로 빠져 있었다(2026-09-26).
 *
 * iztro 의 `horoscope(date)` 가 이미 다 주는 값이라 새로 계산하는 건 없다. */

export type ZiweiHoroscope = {
  decadal: { stem: string; branch: string; palaceNames: string[]; mutagen: string[] };
  yearly: { stem: string; branch: string; palaceNames: string[]; mutagen: string[] };
};

export function calculateZiweiHoroscope(birthInfo: BirthInfo, today: Date): ZiweiHoroscope | null {
  const astrolabe = buildAstrolabe(birthInfo);
  if (!astrolabe) return null;

  try {
    const h = astrolabe.horoscope(today);
    return {
      decadal: {
        stem: h.decadal.heavenlyStem,
        branch: h.decadal.earthlyBranch,
        palaceNames: h.decadal.palaceNames,
        mutagen: h.decadal.mutagen,
      },
      yearly: {
        stem: h.yearly.heavenlyStem,
        branch: h.yearly.earthlyBranch,
        palaceNames: h.yearly.palaceNames,
        mutagen: h.yearly.mutagen,
      },
    };
  } catch {
    // 시간축이 빠져도 원국 해석은 그대로 나간다.
    return null;
  }
}

/** 사화는 [화록, 화권, 화과, 화기] 순서로 온다 — 이름을 붙여 주지 않으면 모델이 순서를 뒤섞는다. */
function mutagenLine(mutagen: string[]): string {
  const labels = ["화록(祿, 얻음·인연)", "화권(權, 주도·확장)", "화과(科, 명예·드러남)", "화기(忌, 막힘·집착)"];
  return mutagen.map((star, i) => `${star}=${labels[i] ?? "?"}`).join(", ");
}

export function buildZiweiHoroscopePromptBlock(h: ZiweiHoroscope, today: Date): string {
  return [
    `- 현재 대한(10년 단위): ${h.decadal.stem}${h.decadal.branch}`,
    `  - 대한 사화: ${mutagenLine(h.decadal.mutagen)}`,
    `  - 대한 궁 배치(명궁부터 순서대로): ${h.decadal.palaceNames.join(", ")}`,
    `- ${today.getFullYear()}년 유년: ${h.yearly.stem}${h.yearly.branch}`,
    `  - 유년 사화: ${mutagenLine(h.yearly.mutagen)}`,
    `  - 유년 궁 배치(명궁부터 순서대로): ${h.yearly.palaceNames.join(", ")}`,
  ].join("\n");
}
