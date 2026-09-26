// 알콩달콩 우리 커플❤️, 결혼까지 갈 수 있을까? — 기획 doc/사주구상.md 의 `couple-compatibility` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const COUPLE_COMPATIBILITY: SajuProduct = {
  slug: "couple-compatibility",
  categories: ["연애", "궁합"],
  tag: "커플",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "알콩달콩 우리 커플❤️, 결혼까지 갈 수 있을까?",
  subtitle: "지금의 설렘, 오래가는 사랑으로 만들 수 있을까?",
  description: "두 사람의 생년월일시를 함께 살펴 서로 끌리는 이유와 다투기 쉬운 지점, 관계를 단단하게 하는 방법을 전합니다.",
  userInputPrompt: "교제 기간, 요즘 자주 부딪히는 문제 또는 궁금한 미래를 적어주세요. 두 사람에게 맞는 관계 포인트를 더 깊게 봐드립니다.",
  purpose: "우리는 왜 끌리고 어디에서 부딪히며, 장기적으로 건강한 관계를 만들려면 무엇이 필요한가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "base-fit", title: "두 사람의 기본 궁합" },
    { id: "attraction", title: "서로에게 끌리는 이유" },
    { id: "mutual-influence", title: "서로에게 주는 영향" },
    { id: "affection-style", title: "애정 표현 방식" },
    { id: "conflict-points", title: "갈등이 생기는 지점" },
    { id: "over-time", title: "시간이 지나며 달라지는 부분" },
    { id: "long-term-flow", title: "결혼·장기 관계 흐름" },
    { id: "relationship-guide", title: "관계 유지 가이드" },
  ],

  sajuFocus: "일간·일지와 배우자궁의 상호 관계, 오행 보완·과다, 대운에서의 관계 변화.",
  ziweiFocus: "명·부처·복덕궁의 조합, 사화와 관계 별의 작용, 대한·유년의 갈등·안정 신호.",
  crossPoints: "보완과 충돌의 공통 원인, 장기 안정에 유리한 생활 방식, 관계를 점검할 시기.",

  image: null,
  needsPartner: true,
  persona: "warm-romantic-friend",
};
