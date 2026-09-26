// 내 결혼💍, 진짜 올해야? — 기획 doc/사주구상.md 의 `marriage-timing` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// ⚠️ **10개다. 11개가 아니다.** 기획 결과 항목의 마지막 `미래 배우자의 예상 모습` 은 텍스트
// 섹션이 아니라 이미지라서 아래 `image` 로 갔다 — single-love.ts 와 같은 함정이다(설계 §10).
import type { SajuProduct } from "./index";

export const MARRIAGE_TIMING: SajuProduct = {
  slug: "marriage-timing",
  categories: ["인생", "결혼·가족", "연애"],
  tag: "결혼",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "내 결혼💍, 진짜 올해야?",
  subtitle: "내 결혼 타이밍, 막연한 기다림 대신 흐름으로 준비하기.",
  description: "생년월일시를 바탕으로 인연이 안정되고 결혼을 준비하기 좋은 흐름과 관계의 조건을 살펴드립니다.",
  userInputPrompt: "현재 연애 여부, 결혼을 생각하는 시기, 가장 궁금한 부분을 적어주세요. 당신의 상황을 반영해 더 구체적으로 해석해 드립니다.",
  purpose: "결혼을 준비하기 좋은 흐름은 언제이며, 어떤 관계·환경이 결혼으로 이어지기 쉬운가?",

  // 기획 결과 항목 10개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "marriage-tendency", title: "결혼에 대한 기본 성향" },
    { id: "pace-pattern", title: "결혼을 서두르거나 신중해지는 패턴" },
    { id: "spouse-timing", title: "배우자 인연이 강해지는 시기" },
    { id: "stabilizing-timing", title: "관계를 안정시키기 좋은 시기" },
    { id: "meeting-trigger", title: "만남의 계기" },
    { id: "spouse-character", title: "배우자 성격" },
    { id: "spouse-lifestyle", title: "배우자의 생활·경제관" },
    { id: "dating-to-marriage", title: "연애에서 결혼으로 가는 과정" },
    { id: "married-life", title: "결혼 후 생활의 특징" },
    { id: "preparation-guide", title: "준비를 위한 현실 가이드" },
  ],

  sajuFocus: "배우자성·배우자궁, 대운·세운의 관계 활성과 합충, 가정 관련 십성.",
  ziweiFocus: "부처궁·명궁·전택궁·복덕궁, 대한·유년의 혼인·가정 흐름.",
  crossPoints: "인연과 안정의 시기를 구분, 배우자상·만남 환경의 공통점, 운세를 준비 행동과 연결.",

  // `subject` 에 누구를 그리는지 문장으로 못 박는다 — 안 쓰면 모델이 내담자 본인을 그린다
  // (설계 §5 프롬프트 주의 3번). `elements` 는 기획 6.5 표의 이 상품 행 그대로다.
  image: {
    subject:
      "내담자 본인이 아니라, 앞으로 만날 배우자(예상 배우자) 한 사람의 모습. 해석에서 읽힌 배우자상과 관계의 분위기를 시각화하는 것이지 특정 실존 인물을 맞히는 것이 아니다.",
    elements: ["배우자상", "안정감", "관계의 분위기", "화풍"],
  },
  needsPartner: false,
};
