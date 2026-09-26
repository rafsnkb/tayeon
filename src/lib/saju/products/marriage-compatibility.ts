// 이 사람과 결혼하면 행복할까, 후회할까?🤵👰 — 기획 doc/사주구상.md 의 `marriage-compatibility` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ 기획의 첫 결과 항목 `결혼 궁합 총평` 은 **뺐다**(2026-09-26, 사용자 확인) —
// 총평은 마지막 페이지 하나로 통일한다. 이유는 new-year-fortune.ts 주석 참고.
import type { SajuProduct } from "./index";

export const MARRIAGE_COMPATIBILITY: SajuProduct = {
  slug: "marriage-compatibility",
  categories: ["연애", "궁합", "결혼·가족"],
  tag: "배우자",
  pricesWon: { saju: 9900, ziwei: 11900, integrated: 19900 },
  title: "이 사람과 결혼하면 행복할까, 후회할까?🤵👰",
  subtitle: "사랑을 넘어 현실까지, 이 사람과의 결혼생활 미리 보기.",
  description: "두 사람의 생년월일시를 비교해 생활·경제·가족·소통 등 결혼 후의 현실적인 궁합을 살펴드립니다.",
  userInputPrompt: "교제·약혼·결혼 준비 상황, 특히 걱정되는 생활 문제를 적어주세요. 두 사람의 현실에 맞춘 해석을 더해드립니다.",
  purpose: "이 관계가 결혼 생활에서 보일 강점과 조정 과제는 무엇인가?",

  // 섹션 11개 — 기획 결과 항목 12개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "after-marriage", title: "연애와 결혼 후 달라지는 점" },
    { id: "living-and-home", title: "생활 습관과 주거 기반" },
    { id: "money-and-roles", title: "경제관념과 역할 분담" },
    { id: "talk-conflict", title: "대화·갈등 해결 방식" },
    { id: "in-laws", title: "가족·부모와의 관계" },
    { id: "children-view", title: "자녀관" },
    { id: "mutual-strength", title: "서로에게 힘이 되는 부분" },
    { id: "long-risk", title: "장기 리스크" },
    { id: "marriage-guide", title: "안정적인 결혼생활 가이드" },
  ],

  sajuFocus: "일지·배우자궁, 오행의 상생상극, 재성·관성·인성 구조, 장기 운의 변화.",
  ziweiFocus: "부처·전택·복덕·부모·자녀궁, 사화 및 대한에서의 가정 변화.",
  crossPoints: "생활·경제·가족이라는 현실 축의 공통 강점과 갈등, 장기 변화의 조건, 합의가 먼저 필요한 의제.",

  image: null,
  needsPartner: true,
  persona: "fair-mediator",
};
