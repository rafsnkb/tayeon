// 친구랑 동업🤝 잘될까 망할까? — 기획 doc/사주구상.md 의 `business-partnership` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ 기획의 첫 결과 항목 `동업 궁합 한 줄 총평` 은 **뺐다**(2026-09-26, 사용자 확인) —
// 총평은 마지막 페이지 하나로 통일한다. 이유는 new-year-fortune.ts 주석 참고.
import type { SajuProduct } from "./index";

export const BUSINESS_PARTNERSHIP: SajuProduct = {
  slug: "business-partnership",
  categories: ["궁합", "건강·인간관계"],
  tag: "동업",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "친구랑 동업🤝 잘될까 망할까?",
  subtitle: "같이하면 대박일까, 싸움만 남을까? 동업 전 꼭 보는 궁합.",
  description: "두 사람의 생년월일시를 바탕으로 역할·결정·돈에 대한 균형과 함께 일할 때의 강점·주의점을 살펴드립니다.",
  userInputPrompt: "계획 중인 업종, 각자 맡을 역할, 현재 가장 걱정되는 문제를 적어주세요. 협업 구조에 맞춘 해석을 더해드립니다.",
  purpose: "두 사람이 함께 일할 때 역할·결정·돈·관계의 균형은 어떻게 만들면 좋은가?",

  // 섹션 9개 — 기획 결과 항목 10개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "joint-strengths", title: "함께 일할 때의 강점" },
    { id: "role-split", title: "자연스러운 역할 분담" },
    { id: "decision-style", title: "의사결정 방식" },
    { id: "pace-execution-gap", title: "속도와 실행력의 차이" },
    { id: "money-risk-attitude", title: "돈·위험에 대한 태도" },
    { id: "external-relations", title: "고객·외부 관계 대응" },
    { id: "conflict-points", title: "갈등이 생기기 쉬운 지점" },
    { id: "review-timing", title: "사업 흐름을 점검할 시기" },
    { id: "operating-principles", title: "오래 협업하기 위한 운영 원칙" },
  ],

  sajuFocus: "비겁·재성·식상·관성의 협업과 수익 구조, 오행 보완, 대운·세운의 사업·이동 흐름.",
  ziweiFocus: "관록궁·재백궁·교우궁·천이궁, 권한·수익·외부 네트워크를 보는 주성·사화 및 대한·유년.",
  crossPoints: "역할 분담·결정권·금전 관리에서의 공통 강점과 위험, 계약·정산·권한을 사전에 명확히 할 지점.",

  image: null,
  needsPartner: true,
  persona: "pragmatic-strategist",
};
