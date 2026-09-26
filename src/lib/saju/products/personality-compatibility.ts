// 우린 왜 만나기만 하면 싸울까?🤯 — 기획 doc/사주구상.md 의 `personality-compatibility` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ 기획의 첫 결과 항목 `성격 궁합 한 줄 총평` 은 **뺐다**(2026-09-26, 사용자 확인) —
// 총평은 마지막 페이지 하나로 통일한다. 이유는 new-year-fortune.ts 주석 참고.
import type { SajuProduct } from "./index";

export const PERSONALITY_COMPATIBILITY: SajuProduct = {
  slug: "personality-compatibility",
  categories: ["궁합", "연애", "건강·인간관계"],
  tag: "성격",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "우린 왜 만나기만 하면 싸울까?🤯",
  subtitle: "잘 맞는 줄 알았는데 왜 자꾸 부딪힐까? 우리만의 관계 언어 찾기.",
  description: "두 사람의 생년월일시를 비교해 성격·감정·소통 방식의 차이와 맞춰갈 방법을 찾아드립니다.",
  userInputPrompt: "두 사람의 관계(친구·연인·가족·직장 등), 자주 생기는 갈등과 궁금한 점을 적어주세요. 상황에 맞는 소통 포인트를 더해드립니다.",
  purpose: "두 사람의 성격·감정·소통 방식은 어디에서 잘 맞고, 어떤 차이를 이해해야 편안한 관계가 되는가?",

  // 섹션 9개 — 기획 결과 항목 10개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "each-temperament", title: "각자의 기본 기질" },
    { id: "emotion-expression", title: "감정 표현 방식" },
    { id: "thinking-deciding", title: "사고·결정 방식" },
    { id: "conversation-fit", title: "대화가 잘 통하는 지점" },
    { id: "draining-points", title: "서로를 지치게 하는 지점" },
    { id: "conflict-pattern", title: "갈등이 생기는 패턴" },
    { id: "complementary-strengths", title: "관계에서 보완되는 강점" },
    { id: "distance-moments", title: "거리를 조절해야 하는 순간" },
    { id: "comfort-guide", title: "더 편안하게 지내는 방법" },
  ],

  sajuFocus: "일간과 오행의 조화, 십성의 표현 방식, 일지·지지의 합충과 상호 보완.",
  ziweiFocus: "양측 명궁·복덕궁·형제궁의 성향과 정서, 주요 별·사화가 만드는 대인 패턴.",
  crossPoints: "기질·표현·갈등에서 공통으로 나타난 조화와 차이, ‘잘 맞는다’는 결론보다 서로가 이해해야 할 관계의 언어.",

  image: null,
  needsPartner: true,
  persona: "fair-mediator",
};
