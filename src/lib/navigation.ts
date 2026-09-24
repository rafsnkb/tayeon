/**
 * "돌아갈 곳"을 쿼리로 들고 여는 링크.
 *
 * /charge 는 마이페이지·타로 화면·메뉴 서랍 세 군데에서 열리고, 돌아갈 곳도 그만큼 다르다.
 * 그동안은 뒤로가기가 history.back() 이었는데, 결제창(KG이니시스)이 히스토리 엔트리를 쌓아서
 * **이용권을 한 번 사고 나면** 원래 왔던 화면이 아니라 결제 과정 중간으로 돌아갔다 — 실제로는
 * 메인으로 튕겼다(2026-09-24). 히스토리를 믿지 않고 온 곳을 직접 들고 다닌다.
 */
export function withReturnTo(href: string, from: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
}

/**
 * 쿼리로 받은 "돌아갈 곳"을 검증한다.
 *
 * 주소창으로 들어오는 값이라 그대로 router.push 에 넘기면 `?from=https://...` 로 외부 사이트에
 * 보낼 수 있다. 같은 앱 안의 절대 경로만 받는다 — `//evil.com` 은 프로토콜 상대 URL 이라 `/` 로
 * 시작하는지만 봐서는 걸러지지 않는다.
 */
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}
