// 이번 시험🏫, 붙을 사람은 따로 있다?🤓 — 기획 doc/사주구상.md 의 `exam-fortune` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
import type { SajuProduct } from "./index";

export const EXAM_FORTUNE: SajuProduct = {
  slug: "exam-fortune",
  categories: ["인생", "직업·재물"],
  tag: "시험",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "이번 시험🏫, 붙을 사람은 따로 있다?🤓",
  subtitle: "이번 시험, 운보다 중요한 내 공부 리듬과 집중 포인트.",
  description: "생년월일시를 바탕으로 학습 강점·압박에 흔들리는 패턴·컨디션 흐름을 살펴, 준비 방향을 정리해드립니다.",
  userInputPrompt: "준비 중인 시험, 남은 기간, 현재 가장 어려운 과목이나 고민을 적어주세요. 합격을 단정하기보다 준비 효율을 높일 포인트를 더해드립니다.",
  purpose: "목표 시험을 준비할 때 나의 학습 강점과 흔들리는 패턴은 무엇이며, 어떻게 컨디션을 관리할까?",

  // 기획 결과 항목 9개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "current-flow", title: "현재 시험 준비 흐름" },
    { id: "study-strength", title: "학습 강점" },
    { id: "focus-drop", title: "집중력이 흔들리는 패턴" },
    { id: "study-method", title: "잘 맞는 공부 방식" },
    { id: "prep-timing", title: "준비 과정에서 정비할 시기" },
    { id: "exam-day", title: "시험 전 컨디션과 당일의 마음가짐" },
    { id: "result-flow", title: "결과 발표 전후의 흐름" },
    { id: "next-choice", title: "결과와 무관하게 준비할 다음 선택지" },
  ],

  sajuFocus: "인성·식상·관성의 균형, 운의 집중력·압박 변화, 생활 리듬.",
  ziweiFocus: "명궁·관록궁·복덕궁·질액궁, 유년 학습·평가 환경의 흐름.",
  crossPoints: "시험 결과의 확정 예측보다 준비 효율과 컨디션 관리, 집중이 잘 되는 환경과 보완 행동의 공통점.",

  image: null,
  needsPartner: false,
  persona: "energetic-coach",
};
