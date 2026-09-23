import { TarotScreen } from "./tarot/TarotScreen";

/** 초기 화면. 대화방과 같은 껍데기를 쓰되 방이 없는 상태다(피그마 New/Main_*).
 *
 *  **진입은 항상 여기다** — 마지막으로 보던 대화방을 복원하지 않는다. 전자상거래법
 *  시행규칙 제7조①이 요구하는 사업자 신원 표시가 "초기 화면" 기준이라, 재방문자가 대화방으로
 *  바로 떨어지면 그 표시를 한 번도 못 보게 된다(2026-09-24 사용자와 확인).
 *
 *  예전엔 `src/app/page.tsx` 가 `/tarot` 으로 리다이렉트만 했는데, 그러면 `(app)` 그룹 밖이라
 *  메뉴 드로어가 없었다. 초기 화면도 드로어를 열 수 있어야 하므로 그룹 안으로 들여온다.
 *
 *  화면이 메인인지 대화방인지는 TarotScreen 이 경로에서 직접 읽는다 — 첫 질문을 보낼 때
 *  재마운트 없이 URL 만 바꾸기 때문이다(TarotScreen 주석 참고). */
export default function MainPage() {
  return <TarotScreen />;
}
