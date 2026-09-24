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
 * 주소창으로 들어오는 값이라 그대로 router.push 에 넘기면 `?from=https://evil.com` 으로 외부
 * 사이트에 보낼 수 있다(열린 리다이렉트). 같은 앱 안의 절대 경로만 받는다.
 *
 * `/` 로 시작하는지만 보면 부족하다 — **두 번째 글자까지** 봐야 한다:
 *   `//evil.com`  프로토콜 상대 URL
 *   `/\evil.com`  브라우저가 역슬래시를 `/` 로 고쳐 읽어 위와 같아진다
 */
export function safeReturnTo(value: string | null | undefined): string | undefined {
  if (!value || !value.startsWith("/")) return undefined;
  if (value[1] === "/" || value[1] === "\\") return undefined;
  return value;
}
