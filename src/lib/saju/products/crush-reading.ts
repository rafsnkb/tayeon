// 그 사람도 날 좋아할까?😳 — 기획 doc/사주구상.md 의 `crush-reading` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const CRUSH_READING: SajuProduct = {
  slug: "crush-reading",
  categories: ["연애", "궁합"],
  tag: "짝사랑",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "그 사람도 날 좋아할까?😳",
  subtitle: "그 사람의 마음, 혼자만의 착각인지 흐름으로 확인해 보세요.",
  description: "두 사람의 생년월일시를 함께 비교해 관계의 온도와 가까워질 가능성이 열리는 흐름을 살펴드립니다.",
  userInputPrompt: "상대와의 현재 관계, 최근 있었던 연락·행동, 가장 궁금한 점을 적어주세요. 상황에 맞춘 해석을 더해드립니다.",
  purpose: "상대는 나를 어떻게 보고 있으며, 관계를 표현하거나 가까워지기 좋은 흐름은 언제인가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "how-they-see-me", title: "상대가 보는 나" },
    { id: "current-temperature", title: "현재 관계 온도" },
    { id: "attraction-signals", title: "이성적 호감의 신호" },
    { id: "their-hesitation", title: "상대가 망설이는 이유" },
    { id: "basic-compatibility", title: "두 사람의 기본 궁합" },
    { id: "closeness-trigger", title: "가까워질 계기" },
    { id: "confession-timing", title: "표현·고백에 좋은 흐름" },
    { id: "obstacles", title: "관계를 방해하는 요소" },
    { id: "future-potential", title: "앞으로의 관계 가능성" },
    { id: "low-pressure-actions", title: "부담을 줄이는 행동 가이드" },
  ],

  sajuFocus: "두 명식의 일간 관계, 배우자성·합충, 시기 운에서의 관계 활성.",
  ziweiFocus: "양측 명·부처·복덕궁의 상호 작용, 유년 관계궁의 변화.",
  crossPoints: "호감과 속도의 공통 판단, 접점이 자연스러운 시기, 압박보다 대화가 필요한 조건.",

  image: null,
  needsPartner: true,
};
