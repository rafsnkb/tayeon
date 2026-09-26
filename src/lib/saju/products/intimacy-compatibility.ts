// 후방주의👀 우리 둘만 아는 속궁합🔥 — 기획 doc/사주구상.md 의 `intimacy-compatibility` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// **성인 전용이 아니다**(2026-09-26 사용자 결정). 한동안 `adultOnly: true` 였는데 근거가 없었다 —
// 청소년보호법의 「청소년유해매체물」은 심의기관이 결정·고시한 것만이고 이 상품은 해당이 없다.
// 실제 이유는 설계 §1 이 적어 둔 "카드사 심사 중 결제 상품 목록 변경 리스크"였고 그 전제가 없어졌다.
// 대신 성인 전용으로 읽히던 문구(`성인 간`·`성적`·`욕구`)를 함께 고쳤다.
//
// ⚠️ 기획의 첫 결과 항목 `속궁합 한 줄 총평` 은 **뺐다**(2026-09-26, 사용자 확인) —
// 총평은 마지막 페이지 하나로 통일한다. 이유는 new-year-fortune.ts 주석 참고.
import type { SajuProduct } from "./index";

export const INTIMACY_COMPATIBILITY: SajuProduct = {
  slug: "intimacy-compatibility",
  categories: ["궁합", "연애"],
  tag: "속궁합",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "후방주의👀 우리 둘만 아는 속궁합🔥",
  subtitle: "우리의 애정을 더욱 깊고 뜨겁게 만들어 주는 속궁합을 자세하게.",
  description: "나와 상대방의 생년월일시를 함께 놓고 비교하여, 지금의 관계를 더욱 뜨겁고 가깝게 만드는데 도움을 드립니다.",
  userInputPrompt: "상대와 현재 어떤 관계이고, 가장 궁금한 내용이 무엇인지 적어주세요. 적어주신 내용을 기반으로 더욱 깊은 해석을 해 드릴 수 있어요.",
  purpose: "두 사람이 느끼는 끌림과 스킨십의 속도·주도성·선호 분위기는 어디에서 잘 맞으며, 더 만족스러운 관계를 위해 어떤 대화가 필요할까?",

  // 섹션 8개 — 기획 결과 항목 9개에서 첫 항목(총평)을 뺀 수다. 빠진 게 아니라
  // 마지막 closing 페이지로 옮겨간 것이다. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "attraction-tension", title: "서로에게 느끼는 끌림과 텐션" },
    { id: "touch-pace", title: "나와 상대방이 스킨십을 시작하고 받아들이는 속도" },
    { id: "lead-harmony", title: "주도성·리드 방식의 조화" },
    { id: "mood-immersion", title: "서로가 선호하는 분위기와 감정적 몰입도" },
    { id: "desire-satisfaction", title: "서로가 원하는 스킨쉽을 표현하고 만족을 느끼는 포인트" },
    { id: "mismatch-moments", title: "엇갈리기 쉬운 순간" },
    { id: "chemistry-over-time", title: "관계가 깊어질수록 달라지는 둘만의 스킨쉽 케미" },
    { id: "intimacy-talk-guide", title: "더 뜨겁고 가까워지는 대화 가이드" },
  ],

  sajuFocus: "음양·오행의 조화, 일지와 관계성, 정서·표현에 영향을 주는 십성의 균형.",
  ziweiFocus: "부처궁·복덕궁 중심의 친밀감 욕구와 정서 안정, 관련 별의 조합.",
  crossPoints: "정서적 안전감과 표현 속도의 일치, ‘잘 맞음’보다 합의가 필요한 차이, 관계 만족을 높일 대화 방식.",

  image: null,
  needsPartner: true,
  persona: "warm-playful-flirt",
};
