/**
 * "돌아갈 곳"을 쿼리로 들고 여는 링크.
 *
 * /charge 는 마이페이지·타로 화면·메뉴 서랍 세 군데에서 열리고, 돌아갈 곳도 그만큼 다르다.
 * 그동안은 뒤로가기가 history.back() 이었는데, 결제창(KG이니시스)이 히스토리 엔트리를 쌓아서
 * **이용권을 한 번 사고 나면** 원래 왔던 화면이 아니라 결제 과정 중간으로 돌아갔다 — 실제로는
 * 메인으로 튕겼다(2026-09-24). 히스토리를 믿지 않고 온 곳을 직접 들고 다닌다.
 */
export function withReturnTo(href: string, from: string): string {
  lastInAppOrigin = from;
  return `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
}

/** 이 문서 안에서 withReturnTo 로 마지막에 떠난 곳. 모듈 변수라 **같은 문서 안의 화면 전환**에서만
 *  살아남고, 새로고침이나 결제 리다이렉트로 문서가 다시 로드되면 사라진다 — 그게 정확히 우리가
 *  알고 싶은 것이다(아래 canReturnByHistory 참고). */
let lastInAppOrigin: string | null = null;

/**
 * "뒤로가기를 히스토리로 처리해도 되는가".
 *
 * 돌아갈 곳을 **push** 하면 히스토리가 줄지 않고 늘어난다. 그러면 돌아간 화면의 뒤로가기가
 * (히스토리 기반이라) 방금 떠난 화면으로 다시 들어가고, 그 화면의 뒤로가기가 또 push 하면서
 * 두 화면이 영원히 왕복한다 — 마이페이지 ↔ 이용권 구입에서 실제로 그랬다(2026-09-25).
 *
 * 그렇다고 항상 history.back() 을 쓸 수도 없다. 결제창(KG이니시스)이 히스토리에 엔트리를 쌓아서,
 * 결제를 한 번 거치고 나면 뒤로가기가 결제 과정 중간으로 돌아간다(2026-09-24에 고친 것).
 *
 * 가르는 기준은 "이 화면에 온 뒤로 문서가 다시 로드됐는가"다. 결제는 리다이렉트로 돌아오므로
 * 문서가 새로 뜨고 모듈 변수가 비어 있다 — 그때는 히스토리를 믿지 않고 온 곳으로 직접 보낸다.
 * 앱 안에서 그냥 눌러 들어온 경우에는 직전 엔트리가 바로 그 화면이라 back() 이 정확하다.
 */
export function canReturnByHistory(returnTo: string | undefined): boolean {
  if (!returnTo || lastInAppOrigin !== returnTo) return false;
  return typeof window !== "undefined" && window.history.length > 1;
}

/** 테스트용 초기화 — 문서가 새로 로드된 상태(결제 리다이렉트 직후 등)를 흉내 낸다. */
export function resetInAppOrigin(): void {
  lastInAppOrigin = null;
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
