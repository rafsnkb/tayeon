// 내 인생🚶‍➡️ 도대체 언제 풀릴까?🤔 — 기획 doc/사주구상.md 의 `life-overview` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// 마지막 섹션 제목이 `두 체계가 공통으로 강조하는…` 이었다. 통합 모드 전용 문구라 사주 단일·
// 자미두수 단일에서는 **제목이 거짓말이 된다**(§4.1은 세 모드 모두 판다). 2026-09-26 에
// `전체를 관통하는…` 으로 고쳤다.
//
// **타입에 모드별 제목 분기를 만들지 않았다.** 19개 상품이 전부 그 모양을 알아야 하는데 실제로
// 필요한 자리는 셋뿐이었다(19개 전수 감사 결과) — 체계 이름을 안 쓰면 세 모드에서 다 맞는다.
//
// `crossPoints` 도 같은 문제였다(2026-09-26 두 번째 감사, `buildSystemBlock` 이 단일 모드에서
// 안 쓰는 체계 이름을 프롬프트에 꽂던 버그를 고치며 발견) — "한 체계가 더 강하게 드러내는"은
// 두 체계를 실제로 비교해야만 성립하는 말인데, 이 값은 **모드와 무관하게 프롬프트에 늘 들어간다**
// (`generate/outline.ts` 의 `buildSystemBlock`). 사주 단일로 산 사람에게 "자미두수와 비교해
// 더 강한 영역"을 짚으라는 지시가 나갈 뻔했다. 체계 비교 없이도 같은 뜻(어느 삶의 영역이 유독
// 뚜렷한가)이 서게 다시 썼다.
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
    { id: "life-task-synthesis", title: "전체를 관통하는 인생 과제와 종합 제안" },
  ],

  sajuFocus: "원국의 오행 균형, 격국·용신, 십성 구조, 대운의 전환과 세운의 촉발 요인.",
  ziweiFocus: "명궁·신궁 및 12궁의 배치, 주성·보조성, 사화, 대한별 궁위 이동과 유년 보조.",
  crossPoints: "10년 단위 흐름의 전환점, 직업·관계·자산에서 공통으로 나타나는 강점, 유독 뚜렷하게 드러나는 삶의 영역.",

  image: null,
  needsPartner: false,
  persona: "calm-mentor",
};
