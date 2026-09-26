// 올해 대박 나는 달 따로 있다?!😲 — 기획 doc/사주구상.md 의 `new-year-fortune` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ 기획의 첫 결과 항목 `올해의 한 줄 총평` 은 **뺐다**(2026-09-26, 사용자 확인). 총평은 3단이
// 본문을 받아 만드는 마지막 페이지(closing) 하나로 통일하기로 했고(설계 §1 "총평은 마지막이다"),
// 그대로 두면 1페이지와 마지막에 두 번 나온다. 그래서 아래는 기획의 12개가 아니라 11개다.
import type { SajuProduct } from "./index";

export const NEW_YEAR_FORTUNE: SajuProduct = {
  slug: "new-year-fortune",
  categories: ["인생"],
  tag: "신년",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "올해 대박 나는 달 따로 있다?!😲",
  subtitle: "새해의 기회는 잡고, 조심할 흐름은 미리 알아보는 1년 운세.",
  description: "태어난 생년월일시를 바탕으로 사주·자미두수 흐름을 살펴, 한 해의 기회와 점검할 시기를 자세하게 전합니다.",
  userInputPrompt: "올해 꼭 이루고 싶은 목표나 특히 궁금한 분야(연애·일·돈·건강 등)를 적어주세요. 더 현실적인 한 해의 흐름을 해석해 드릴 수 있어요.",
  purpose: "시작되는 한 해의 전체 흐름은 어떠하며, 무엇을 잡고 무엇을 조심해야 하는가?",

  // 섹션 11개 — 기획 결과 항목 12개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "year-keywords", title: "올해의 핵심 키워드" },
    { id: "first-half", title: "상반기 흐름" },
    { id: "second-half", title: "하반기 흐름" },
    { id: "money-flow", title: "재물·소비 흐름" },
    { id: "work-opportunity", title: "직장·사업 기회" },
    { id: "love-flow", title: "연애·인연 흐름" },
    { id: "health-care", title: "건강·컨디션 관리" },
    { id: "helpers-collab", title: "귀인과 협업 기회" },
    { id: "caution-relations", title: "주의할 관계·상황" },
    { id: "decisive-timing", title: "올해의 결정적 시기" },
    { id: "year-guide", title: "올해를 잘 보내는 방법" },
  ],

  sajuFocus: "세운과 월운, 원국과의 합·충·형·파, 용희신 작용, 재성·관성·인성 등 십성의 활성.",
  ziweiFocus: "유년 명반, 유년 사화, 명·관록·재백·부처·질액궁의 흐름, 대한과 유년의 중첩.",
  crossPoints: "기회·정비 시기의 겹침, 직업·재물·관계 중 공통 강조 영역, 두 체계가 다르게 보는 달의 조건부 해석.",

  image: null,
  needsPartner: false,
};
