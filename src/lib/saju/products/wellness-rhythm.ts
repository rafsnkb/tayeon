// 요즘 왜 이렇게 자꾸 아프고 지칠까?🤒 — 기획 doc/사주구상.md 의 `wellness-rhythm` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const WELLNESS_RHYTHM: SajuProduct = {
  slug: "wellness-rhythm",
  categories: ["인생", "건강·인간관계"],
  tag: "건강",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "요즘 왜 이렇게 자꾸 아프고 지칠까?🤒",
  subtitle: "자꾸 지치는 내 몸, 생활 리듬부터 다정하게 점검하기.",
  description: "생년월일시를 바탕으로 컨디션이 흔들리기 쉬운 생활 패턴과 회복을 챙길 시기를 살펴드립니다.",
  userInputPrompt: "요즘 불편한 생활 습관·피로 상황·궁금한 컨디션 흐름을 적어주세요. 질병이나 발병 시점을 단정하지 않고 생활관리 중심으로 해석해 드립니다.",
  purpose: "내 생활 리듬에서 취약해지기 쉬운 영역은 무엇이며, 어떤 시기에 회복과 관리에 더 신경 써야 하는가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "innate-stamina", title: "타고난 체력·생활 리듬" },
    { id: "stress-response", title: "스트레스 반응" },
    { id: "burnout-pattern", title: "컨디션이 무너지는 패턴" },
    { id: "body-focus", title: "관리가 필요한 신체 영역" },
    { id: "daily-routine", title: "수면·식사·활동 루틴" },
    { id: "age-care", title: "연령대별 생활관리 포인트" },
    { id: "year-condition", title: "올해 컨디션 흐름" },
    { id: "wellness-guide", title: "건강한 생활 가이드" },
  ],

  sajuFocus: "오행의 과부족과 조후, 일간의 균형, 대운·세운의 생활 리듬 변화.",
  ziweiFocus: "질액궁·명궁·복덕궁, 관련 별과 유년 질액궁의 컨디션 흐름.",
  crossPoints: "질병명·발병 시점 단정 없이 공통으로 나타난 취약 생활 영역, 휴식·검진·전문가 상담이 필요한 신호, 일상 루틴 제안.",

  image: null,
  needsPartner: false,
  persona: "gentle-caretaker",
};
