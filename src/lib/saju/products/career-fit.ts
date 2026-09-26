// 이 회사🏢 너무 들어가고 싶어!🧑‍💼 — 기획 doc/사주구상.md 의 `career-fit` 상품 블록을 옮긴 것이다.
//
// 한국어 문장은 전부 기획 원문 그대로다(화면·프롬프트로 바로 나가는 값이라 다듬지 않는다).
// 카테고리·태그·가격은 사용자 상품표(2026-09-26) 기준이고, 섹션 `id` 만 여기서 새로 지었다.
//
// `지원 회사와의 궁합` 섹션이 있지만 상대는 사람이 아니라 회사다 — `needsPartner` 는 false 다.
import type { SajuProduct } from "./index";

export const CAREER_FIT: SajuProduct = {
  slug: "career-fit",
  categories: ["직업·재물", "인생"],
  tag: "취업",
  pricesWon: { saju: 8900, ziwei: 10900, integrated: 17900 },
  title: "이 회사🏢 너무 들어가고 싶어!🧑‍💼",
  subtitle: "나에게 맞는 회사와 직무, 합격 가능성을 높이는 방향 찾기.",
  description: "생년월일시를 바탕으로 직업 성향과 조직 적합도를 살피고, 지원·면접에서 집중할 포인트를 전합니다.",
  userInputPrompt: "지원 중인 직무·회사 유형, 경력 또는 면접에서 가장 걱정되는 점을 적어주세요. 준비 방향에 맞춘 해석을 더해드립니다.",
  purpose: "나에게 맞는 일과 조직은 무엇이며, 지원·면접·입사 준비에서 집중할 지점은 무엇인가?",

  // 기획 결과 항목 11개. `title` 이 화면 페이지 제목으로 바로 쓰인다.
  sections: [
    { id: "work-tendency", title: "직업 성향" },
    { id: "fitting-roles", title: "잘 맞는 직무" },
    { id: "fitting-orgs", title: "잘 맞는 조직 환경" },
    { id: "current-job-flow", title: "현재 취업 흐름" },
    { id: "application-strengths", title: "지원 과정의 강점" },
    { id: "resume-points", title: "서류에서 살릴 점" },
    { id: "interview-cautions", title: "면접에서 주의할 점" },
    { id: "company-fit", title: "지원 회사와의 궁합" },
    { id: "opportunity-timing", title: "기회가 열리는 시기" },
    { id: "onboarding", title: "입사 후 적응" },
    { id: "next-career-step", title: "다음 커리어 방향" },
  ],

  sajuFocus: "관성·인성·식상 및 용신, 대운·세운의 취업·이동 신호, 원국의 업무 스타일.",
  ziweiFocus: "관록궁·명궁·천이궁·교우궁, 유년 관록과 사화, 조직 내 역할을 나타내는 별.",
  crossPoints: "직무·조직 적합도의 공통 결론, 지원 활동이 유리한 구간, 운세를 이력서·포트폴리오·면접 준비로 연결하는 행동.",

  image: null,
  needsPartner: false,
};
