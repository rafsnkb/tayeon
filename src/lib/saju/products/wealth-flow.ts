// 왜 나만 돈이 안 모일까?💸 — 기획 doc/사주구상.md 의 `wealth-flow` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ 기획의 첫 결과 항목 `재물 성향 총평` 은 **뺐다**(2026-09-26, 사용자 확인) —
// 총평은 마지막 페이지 하나로 통일한다. 이유는 new-year-fortune.ts 주석 참고.
import type { SajuProduct } from "./index";

export const WEALTH_FLOW: SajuProduct = {
  slug: "wealth-flow",
  categories: ["직업·재물", "인생"],
  tag: "재물",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "왜 나만 돈이 안 모일까?💸",
  subtitle: "버는 힘부터 모으는 습관까지, 내 돈의 흐름을 제대로 읽기.",
  description: "생년월일시를 바탕으로 수입을 만드는 방식과 지출·위험 성향을 살펴, 나에게 맞는 자산관리 방향을 제안합니다.",
  userInputPrompt:
    "현재 가장 고민되는 돈 문제(수입·지출·저축·부업 등)를 적어주세요. 특정 매수·매도 지시가 아닌 성향과 습관 중심으로 더 현실적인 해석을 해드립니다.",
  purpose: "나는 어떤 방식으로 돈을 만들고 지키며, 안정적인 자산관리 습관을 어떻게 설계하면 좋은가?",

  // 섹션 11개 — 기획 결과 항목 12개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "earning-and-saving", title: "돈이 들어오고 쌓이는 방식" },
    { id: "loss-patterns", title: "지출·손실로 이어지기 쉬운 패턴" },
    { id: "salary-flow", title: "직업소득 흐름" },
    { id: "business-aptitude", title: "사업·부업 적성" },
    { id: "risk-and-assets", title: "투자와 자산관리 성향" },
    { id: "money-and-people", title: "돈과 인간관계" },
    { id: "review-timing", title: "재정 점검이 필요한 시기" },
    { id: "long-term-plan", title: "장기 자산관리 방향" },
  ],

  sajuFocus: "재성의 강약·흐름, 식상생재·관성 구조, 용신과 대운·세운의 재물 환경.",
  ziweiFocus: "재백궁·관록궁·전택궁·명궁, 화록·화권·화기 등 사화와 대한 흐름.",
  crossPoints: "수입 확대·지출 통제·위험관리 중 우선순위, 재물 기회의 조건, 금융상품 매수·매도 대신 습관과 배분 원칙 제안.",

  image: null,
  needsPartner: false,
  persona: "pragmatic-strategist",
};
