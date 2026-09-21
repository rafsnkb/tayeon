// QA 환경에서 "허용된 사람만 로그인"을 강제하는 게이트.
//
// QA는 프로덕션과 동일한 코드를 별도 Firebase 프로젝트에 배포한 것이라, URL만 알면 누구나
// 들어와 가입할 수 있다. 실데이터가 없다고는 해도 Anthropic 호출 비용이 그대로 발생하고
// 테스트 중인 미완성 화면이 외부에 노출되므로 로그인 자체를 막는다.
//
// 설계상 중요한 점: 환경 구분(APP_ENV)과 허용 목록(LOGIN_ALLOWED_EMAILS)을 분리하고,
// **QA에서 목록이 비어 있으면 전원 거부**한다(fail-closed). 목록 변수 하나로만 판단하면
// QA에 그 변수를 넣는 걸 잊었을 때 조용히 무제한 개방된다.
const APP_ENV = process.env.APP_ENV === "qa" ? "qa" : "production";

/** QA에서만 로그인 제한이 걸린다. 프로덕션은 이 함수가 항상 통과시킨다. */
export const isLoginRestricted = APP_ENV === "qa";

const allowedEmails = new Set(
  (process.env.LOGIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

/**
 * @param email 카카오 계정 이메일. 동의항목 미획득이면 null로 들어온다 — QA에서는 신원을
 *   확인할 수 없으므로 거부한다.
 */
export function isLoginAllowed(email: string | null | undefined): boolean {
  if (!isLoginRestricted) return true;
  if (!email) return false;
  return allowedEmails.has(email.trim().toLowerCase());
}
