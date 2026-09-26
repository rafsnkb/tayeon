// 내 편인 줄 알았는데…😢 진짜 귀인은 누구? — 기획 doc/사주구상.md 의 `relationship-destiny` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const RELATIONSHIP_DESTINY: SajuProduct = {
  slug: "relationship-destiny",
  categories: ["인생", "건강·인간관계"],
  tag: "인연",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "내 편인 줄 알았는데…😢 진짜 귀인은 누구?",
  subtitle: "내 편인 사람과 나를 소모시키는 관계, 이제는 구별할 시간.",
  description: "생년월일시를 바탕으로 인간관계 성향과 귀인을 만나는 흐름, 경계가 필요한 관계 패턴을 살펴드립니다.",
  userInputPrompt:
    "요즘 고민되는 관계, 상대와의 상황, 가장 알고 싶은 점을 적어주세요. 누군가를 단정하거나 낙인찍지 않고 건강한 거리와 선택의 관점에서 깊게 해석해 드립니다.",
  purpose: "어떤 사람이 나를 돕고 어떤 관계에서 소모되기 쉬우며, 앞으로 인맥은 어떻게 변화할까?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "social-tendency", title: "인간관계 성향" },
    { id: "first-impression", title: "첫인상과 관계 방식" },
    { id: "compatible-types", title: "잘 맞는 사람 유형" },
    { id: "helper-types", title: "나를 돕는 귀인 유형" },
    { id: "helper-environments", title: "귀인을 만나는 환경" },
    { id: "helper-timing", title: "귀인운이 열리는 시기" },
    { id: "friction-types", title: "갈등하기 쉬운 사람 유형" },
    { id: "recurring-problems", title: "반복되는 관계 문제" },
    { id: "worth-keeping-close", title: "가까이하면 좋은 관계" },
    { id: "social-change-guide", title: "인간관계 변화와 행동 가이드" },
  ],

  sajuFocus: "비겁·인성·관성·식상의 관계 양상, 합충, 대운·세운의 귀인·대인 변화.",
  ziweiFocus: "명궁·형제궁·교우궁·천이궁·복덕궁, 귀인성·사화 및 유년 교우 흐름.",
  crossPoints: "귀인 유형·만남 환경·시기의 공통점, 경계가 필요한 관계 패턴, ‘피해야 할 사람’의 낙인 대신 건강한 거리 두기 행동.",

  image: null,
  needsPartner: false,
  persona: "calm-mentor",
};
