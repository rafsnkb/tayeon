// 내 인생🚶‍➡️ 도대체 언제 풀릴까?🤔 — 기획 doc/사주구상.md 의 `life-overview` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// 마지막 섹션 제목에 `두 체계가` 가 박혀 있다 — 통합 모드 전용 문구라 사주 단일·자미두수 단일
// 모드에서는 제목이 틀린 말이 된다(설계 §4.1은 세 모드 모두 판매).
//
// **지금은 고치지 않는다**(2026-09-26 판단). 모드별 제목 분기는 화면 설계와 함께 정할 일이고,
// 타입에 분기 필드를 먼저 만들면 화면이 정해지기 전에 모양이 굳는다. 화면 작업에서 같이 볼 것.
import type { SajuProduct } from "./index";

export const LIFE_OVERVIEW: SajuProduct = {
  slug: "life-overview",
  categories: ["인생"],
  tag: "운세",
  pricesWon: { saju: 9900, ziwei: 11900, integrated: 19900 },
  title: "내 인생🚶‍➡️ 도대체 언제 풀릴까?🤔",
  subtitle: "내 인생의 큰 흐름과, 나답게 빛나는 시기를 한 번에.",
  description: "타고난 기질부터 연령대별 흐름까지 생년월일시를 바탕으로, 삶의 강점과 변곡점을 입체적으로 풀어드립니다.",
  userInputPrompt: "지금 가장 고민되는 나이대·삶의 영역 또는 앞으로 궁금한 시기를 적어주세요. 그 질문을 중심으로 더 깊게 짚어드립니다.",
  purpose: "타고난 성향부터 연령대별 변곡점까지, 내 인생의 큰 흐름과 활용할 강점은 무엇인가?",

  // 기획 결과 항목 18개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "innate-temperament", title: "타고난 기질과 성향" },
    { id: "inner-desires", title: "숨겨진 내면과 욕구" },
    { id: "strengths-gaps", title: "강점과 보완점" },
    { id: "life-arc", title: "인생 전체 흐름" },
    { id: "age-10s-20s", title: "10대·20대" },
    { id: "age-30s", title: "30대" },
    { id: "age-40s", title: "40대" },
    { id: "age-50s", title: "50대" },
    { id: "age-60s-plus", title: "60대 이후" },
    { id: "career-achievement", title: "직업·사회적 성취" },
    { id: "wealth-tendency", title: "재물과 자산관리 성향" },
    { id: "love-marriage", title: "연애·배우자·결혼" },
    { id: "family-children", title: "가족·부모·자녀" },
    { id: "relations-helpers", title: "인간관계·귀인" },
    { id: "health-rhythm", title: "건강·생활 리듬" },
    { id: "moves-changes", title: "이동·환경 변화" },
    { id: "turning-points", title: "주요 변곡점" },
    { id: "life-task-synthesis", title: "두 체계가 공통으로 강조하는 인생 과제와 종합 제안" },
  ],

  sajuFocus: "원국의 오행 균형, 격국·용신, 십성 구조, 대운의 전환과 세운의 촉발 요인.",
  ziweiFocus: "명궁·신궁 및 12궁의 배치, 주성·보조성, 사화, 대한별 궁위 이동과 유년 보조.",
  crossPoints: "10년 단위 흐름과 대한의 교차, 직업·관계·자산에서 공통 강점, 한 체계가 더 강하게 드러내는 삶의 영역.",

  image: null,
  needsPartner: false,
};
