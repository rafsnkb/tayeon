// 우리는 무슨 사이지?🤔 나만 진심일까...? — 기획 doc/사주구상.md 의 `situationship-reading` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const SITUATIONSHIP_READING: SajuProduct = {
  slug: "situationship-reading",
  categories: ["연애", "궁합"],
  tag: "썸",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "우리는 무슨 사이지?🤔 나만 진심일까...?",
  subtitle: "우리 썸, 연애로 갈까? 나만 진심인 걸까?",
  description: "두 사람의 생년월일시를 바탕으로 감정의 속도와 관계가 다음 단계로 나아갈 가능성을 비교해드립니다.",
  userInputPrompt: "두 사람이 어떻게 알게 됐는지, 최근 분위기와 가장 헷갈리는 지점을 적어주세요. 더 현실적인 관계 해석을 도와드립니다.",
  purpose: "현재 썸의 온도는 어떠하며, 연애로 발전하려면 어떤 계기와 속도가 필요한가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "current-state", title: "지금의 관계 상태" },
    { id: "their-heart", title: "상대의 마음 — 감정과 원하는 관계" },
    { id: "pace-gap", title: "속도가 어긋나는 이유" },
    { id: "matching-points", title: "잘 통하는 포인트" },
    { id: "trigger", title: "발전하기 쉬운 계기" },
    { id: "good-timing", title: "진전되기 좋은 시기" },
    { id: "risk-points", title: "틀어질 수 있는 포인트" },
    { id: "next-step", title: "다음 단계 제안" },
  ],

  sajuFocus: "상호 일간·지지의 조화와 긴장, 연애성의 흐름, 해당 시기 합충.",
  ziweiFocus: "부처·복덕·교우궁, 감정 표현과 관계 속도를 나타내는 별의 배치, 유년 영향.",
  crossPoints: "감정의 방향과 관계 속도, 진전의 계기, 서로 다르게 나타난 기대를 대화로 확인할 지점.",

  image: null,
  needsPartner: true,
  persona: "witty-bestie",
};
