// 구조화된 근거 참조(`SajuRef`/`ZiweiRef`)를 **화면이 그릴 칸**으로 옮긴다.
//
// `ReaderChart.tsx` 가 블록 3종(전체판·카드쌍·띠)을 만들면서 남겨 둔 자리다 — "어느 칸을
// 그릴지는 생성 쪽이 정하고, 그 값이 나오면 얇은 어댑터 하나만 있으면 된다". 이 파일이 그
// 어댑터이고, **얇게 유지하는 것이 요점**이다: 여기서 근거를 고르거나 보태지 않는다.
//
// ## 블록 종류는 개수로 정한다 (설계「근거 블록 종류 선택」)
//
//   0개 → 아무것도 안 그린다
//   1개 → 띠(C), 항목 하나
//   2개 → 카드쌍(B) — 정확히 두 칸이 있어야 성립하는 컴포넌트라 딱 맞다
//   3개+ → 띠(C), 체계별로 줄을 나눈다
//
// **상품 설정으로 고르지 않는다.** 그러면 "편마다 수제"가 되고, 그게 이 리포트가 없애려는
// 패턴이다(19개 상품 × 157장을 사람이 일일이 고를 수 없다).
import type { SajuRef, ZiweiRef } from "@/lib/saju/generate/outline";
import type { SajuChartView, SajuPersonChartView } from "@/lib/saju/view";
import type { ChartCellItem } from "./ReaderChart";

const PILLAR_LABEL = { year: "연주", month: "월주", day: "일주", hour: "시주" } as const;

/** 근거가 가리키는 사람의 명식. `person` 이 없으면 내담자다(`SajuRef` 의 기본값). */
function personOf(chart: SajuChartView, person: SajuRef["person"]): SajuPersonChartView {
  return person === "partner" && chart.partner ? chart.partner : chart.self;
}

/** 인물 칩에 적을 말. 궁합 상품이 아니면 **안 적는다** — 한 사람뿐인 리포트에서 매 칸에
 *  "나"가 붙으면 잡음일 뿐이다(`ChartCellItem.who` 주석). */
function whoLabel(chart: SajuChartView, person: SajuRef["person"], partnerNickname: string | null): string | undefined {
  if (!chart.partner) return undefined;
  return person === "partner" ? (partnerNickname || "상대방") : "나";
}

/**
 * 사주 근거 한 칸 → 표시용 항목.
 *
 * `value` 가 **간지가 아니라 십신**이다. 목업의 띠가 「월주 정재 · 겁재」로 적고, 본문이 대는
 * 근거도 "식신이 있어서…"처럼 십신이기 때문이다 — 간지(`병인`)는 그 칸을 **식별**하는 값이고
 * 십신은 그 칸을 **해석**하는 값이라, 근거 띠에 필요한 건 후자다. 간지는 카드쌍의 `sub` 로
 * 따로 나간다(`sajuRefPair`).
 *
 * 없는 칸(시주 미상)은 `null` 을 돌려준다 — 빈 값을 그리면 "근거가 있는데 안 보이는" 꼴이 된다.
 */
export function sajuRefCell(
  chart: SajuChartView,
  ref: SajuRef,
  partnerNickname: string | null
): ChartCellItem | null {
  const saju = personOf(chart, ref.person).saju;
  if (!saju) return null;
  const tenGod = saju.tenGods[ref.pillar];
  if (!tenGod) return null;
  return {
    who: whoLabel(chart, ref.person, partnerNickname),
    label: PILLAR_LABEL[ref.pillar],
    value: `${tenGod.stem} · ${tenGod.branch}`,
    // 본문이 실제로 인용한 칸이라 강조한다. 명식 전체판과 달리 여기 오는 칸은 **전부** 본문이
    // 인용한 것이므로 조건이 따로 없다.
    highlightValue: true,
  };
}

export function ziweiRefCell(
  chart: SajuChartView,
  ref: ZiweiRef,
  partnerNickname: string | null
): ChartCellItem | null {
  const ziwei = personOf(chart, ref.person).ziwei;
  if (!ziwei) return null;
  // 궁 이름은 계산 결과에 「복덕」으로 올 수도 「복덕궁」으로 올 수도 있다(`ReaderChart` 의
  // `ZiweiPalaces` 가 같은 보정을 한다) — 두 곳이 다르게 적으면 같은 궁이 다른 이름으로 보인다.
  const label = ref.palace.endsWith("궁") ? ref.palace : `${ref.palace}궁`;
  return {
    who: whoLabel(chart, ref.person, partnerNickname),
    label: `자미두수 ${label}`,
    value: ref.star,
    highlightValue: true,
  };
}

/** 카드쌍의 한 칸 — 띠와 달리 **간지를 크게** 보여주고 십신을 아래 줄에 둔다(목업 QnA·Section
 *  공통). 띠와 위계가 반대인 이유: 카드쌍은 "이 장의 핵심 근거 두 자리"를 세우는 자리라
 *  자리 자체가 먼저 읽혀야 하고, 띠는 이미 아는 자리의 값을 확인하는 자리다. */
export function sajuRefPairCell(
  chart: SajuChartView,
  ref: SajuRef
): { label: string; value: string; sub?: string } | null {
  const saju = personOf(chart, ref.person).saju;
  if (!saju) return null;
  const ganji = saju.pillars[ref.pillar];
  if (!ganji) return null;
  const tenGod = saju.tenGods[ref.pillar];
  return {
    label: PILLAR_LABEL[ref.pillar],
    value: ganji,
    // 일주는 일간 그 자체라 십신이 "일간"으로만 나온다 — `ReaderChart` 의 `SajuPillars` 와
    // 같은 보정이다. 두 곳이 다르게 적으면 같은 칸이 화면마다 다르게 보인다.
    sub: ref.pillar === "day" ? "일간 기준" : tenGod ? `${tenGod.stem} · ${tenGod.branch}` : undefined,
  };
}

export function ziweiRefPairCell(
  chart: SajuChartView,
  ref: ZiweiRef
): { label: string; value: string; sub?: string } | null {
  const ziwei = personOf(chart, ref.person).ziwei;
  if (!ziwei) return null;
  const label = ref.palace.endsWith("궁") ? ref.palace : `${ref.palace}궁`;
  return { label, value: ref.star };
}

/** 근거 블록 하나를 그리기 위해 화면이 알아야 할 전부. 화면은 이 판별 유니온을 보고 부품을
 *  고르기만 한다 — **개수를 세는 일은 여기서 끝난다.** */
export type ChartEvidence =
  | { kind: "none" }
  | { kind: "pair"; cells: [
      { label: string; value: string; sub?: string },
      { label: string; value: string; sub?: string },
    ] }
  | { kind: "strip"; rows: ChartCellItem[][] };

/**
 * 근거 목록 → 블록 하나.
 *
 * **명식에 없는 칸은 조용히 빠진다**(`sajuRefCell` 이 `null`). 그래서 개수 판정은 원래
 * `refs.length` 가 아니라 **실제로 그릴 수 있는 칸 수**로 한다 — 모델이 시주를 근거로 댔는데
 * 시간 미상이면 카드쌍의 한 칸이 비게 되고, 그건 "＋" 기호만 덩그러니 남는 모양이다.
 */
export function chartEvidenceOf(args: {
  chart: SajuChartView;
  partnerNickname: string | null;
  sajuRefs: SajuRef[];
  ziweiRefs: ZiweiRef[];
}): ChartEvidence {
  const { chart, partnerNickname, sajuRefs, ziweiRefs } = args;

  const sajuCells = sajuRefs.map((r) => sajuRefCell(chart, r, partnerNickname)).filter((c) => c !== null);
  const ziweiCells = ziweiRefs.map((r) => ziweiRefCell(chart, r, partnerNickname)).filter((c) => c !== null);
  const total = sajuCells.length + ziweiCells.length;
  if (total === 0) return { kind: "none" };

  if (total === 2) {
    // 두 칸이 어느 체계에서 왔든 상관없다 — 사주 2개든, 사주 1 + 자미두수 1이든 카드쌍이다.
    // (설계: "나·일주 vs 상대방·일주"도 `sajuRefs.length === 2` 라 자연히 카드쌍이 된다.)
    const pairCells = [
      ...sajuRefs.map((r) => sajuRefPairCell(chart, r)),
      ...ziweiRefs.map((r) => ziweiRefPairCell(chart, r)),
    ].filter((c) => c !== null);
    if (pairCells.length === 2) {
      return { kind: "pair", cells: [pairCells[0]!, pairCells[1]!] };
    }
    // 카드쌍용 변환에서 하나가 빠졌다(간지가 없는 칸). 띠로 떨어뜨린다 — 반쪽 카드쌍보다 낫다.
  }

  // 체계별로 줄을 나눈다. 한 줄에 몰면 통합 모드에서 다섯 칸이 한 줄에 붙는다.
  const rows = [sajuCells, ziweiCells].filter((row) => row.length > 0);
  return { kind: "strip", rows };
}
