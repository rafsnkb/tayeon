// 다시 보고 싶은 그 사람...😭 그 사람도 아직 날 못 잊었을까?🙏 — 기획 doc/사주구상.md 의 `reunion-reading` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const REUNION_READING: SajuProduct = {
  slug: "reunion-reading",
  categories: ["연애", "궁합"],
  tag: "재회",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "다시 보고 싶은 그 사람...😭 그 사람도 아직 날 못 잊었을까?🙏",
  subtitle: "끝난 줄 알았던 우리, 다시 이어질 가능성은 남아 있을까?",
  description: "두 사람의 생년월일시를 비교해 이별 뒤의 감정 흐름과 다시 닿을 수 있는 조건을 신중하게 살펴드립니다.",
  userInputPrompt: "헤어진 시기와 이유, 현재 연락 여부, 가장 알고 싶은 점을 적어주세요. 단정 대신 관계의 흐름과 현실적인 선택지를 더 깊게 풀어드립니다.",
  purpose: "헤어진 관계의 핵심 원인은 무엇이며, 다시 연결될 가능성과 재회 후의 과제는 무엇인가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "breakup-cause", title: "이별의 핵심 원인" },
    { id: "their-current-view", title: "상대가 현재 바라보는 관계" },
    { id: "lingering-feelings", title: "남아 있는 감정의 흔적" },
    { id: "recontact-conditions", title: "다시 연락이 닿기 쉬운 상황" },
    { id: "their-likely-response", title: "내가 연락할 때의 반응 경향" },
    { id: "contact-timing", title: "접점이 생기기 쉬운 시기" },
    { id: "reunion-obstacles", title: "재회를 방해하는 요소" },
    { id: "recurring-issues", title: "재회 후 반복될 문제" },
    { id: "post-reunion-change", title: "재회 시 관계 변화" },
    { id: "self-care-advice", title: "재회 여부와 별개로 나를 위한 제안" },
  ],

  sajuFocus: "관계의 합충과 배우자궁 변화, 현재·향후 운의 재접점 신호.",
  ziweiFocus: "부처·복덕·교우궁, 유년 사화와 관계 회복·단절의 흐름.",
  crossPoints: "재접점 가능성의 조건, 감정 회복과 관계 지속을 구분한 해석, 과거 패턴을 바꾸기 위한 대화 과제.",

  image: null,
  needsPartner: true,
};
