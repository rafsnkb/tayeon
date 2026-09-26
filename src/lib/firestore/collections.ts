// Firestore 컬렉션 이름 상수. 14개 이상 파일에 문자열 리터럴로 반복되던 걸 모아둔 것 —
// 오타로 인한 실제 버그는 발견된 적 없음(스타일/유지보수 목적). 전수 교체는 과할 수 있어
// 결제/이용권 관련 핵심 경로부터 우선 적용했고, 나머지 리터럴은 필요할 때 마저 옮기면 된다.

/** 최상위 컬렉션. */
export const USERS = "users";
export const REFERRAL_CODES = "referralCodes";
export const REFERRAL_GRANTS = "referralGrants";
export const SIGNUP_GRANTS = "signupGrants";
/** 친구 초대 **가입 보상을 이미 받은 사람**의 마커(문서 id = 그 사람의 uid).
 *  referralGrants/{추천인}/friends/{친구} 는 추천인-친구 **쌍**의 멱등 키라, 추천인만 바꿔서
 *  탈퇴→재가입을 반복하면 계속 새로 지급됐다 — 그걸 막으려고 받는 사람 기준으로 따로 둔다.
 *  users/{uid} 서브트리 밖이라 recursiveDelete 로 지워지지 않는다(2026-09-24). */
export const REFERRAL_SIGNUP_GRANTS = "referralSignupGrants";
export const REFUND_REQUESTS = "refundRequests";
/** 회원 탈퇴 시 users/{uid}/payments에서 복사되는 결제 기록 아카이브(전자상거래법 시행령
 * 제6조 5년 보존 의무 — src/app/api/user/delete/route.ts 참고). */
export const PAYMENT_ARCHIVE = "paymentArchive";
/** 운영 알림 발송 기록 — 중복 발송 방지 키와 일일 메일 사용량을 담는다. */
export const OWNER_ALERTS = "ownerAlerts";
/** 아이디/비밀번호 로그인(심사용 계정 하나뿐)의 시도 횟수 — 무제한 대입을 막는다.
 *  문서 id는 요청자 IP의 해시라 원본 IP는 저장하지 않는다. TTL 정책 대상. */
export const LOGIN_ATTEMPTS = "loginAttempts";
/** 결제창을 열기 직전에 prepare 가 적어 두는 **주문 내역**(문서 id = paymentId).
 *
 *  "이 결제는 얼마여야 하는가"의 유일한 근거다. 예전에는 아무것도 저장하지 않고 지급 시점에
 *  productId 로 상품표 정가를 다시 꺼내 대조했는데, 그러면 **정가가 아닌 금액은 전부 위조로
 *  보인다** — 할인쿠폰이 붙는 순간 정상 결제가 거부된다. 그렇다고 대조를 풀면 100 원을 결제해
 *  11 만원 상품을 받는 구멍이 되므로, 기대 금액을 서버가 미리 적어 두고 그것과 대조한다.
 *
 *  paymentId 는 서버가 randomUUID 로 채번하므로 남이 맞힐 수 없다. TTL 정책 대상. */
export const PAYMENT_INTENTS = "paymentIntents";
/** 운영자가 발급하는 **할인쿠폰**(문서 id = 코드 자체, 대문자 정규화).
 *
 *  생일 기념 무료 이용권(`BIRTHDAY_COUPON_GRANTS`)과는 다른 것이다 — 그쪽은 "무료 이용권 지급"이고
 *  이쪽은 "구매 금액 할인"이다. 이름이 겹치니 코드에서는 반드시 discount 를 붙여 부른다.
 *
 *  유효기간은 **쿠폰의 것**이지 사용자별로 따로 도는 시계가 아니다. 그리고 기간이 겹치게
 *  발급하지 않는 것이 운영 원칙이라(어드민이 막는다), 어느 시점에도 한 사용자가 **쓸 수 있는
 *  쿠폰은 최대 한 장**이 된다 — "여러 장 중 무엇을 적용하나" 라는 문제가 설계에서 사라진다. */
export const DISCOUNT_COUPONS = "discountCoupons";

/** users/{uid} 서브컬렉션. */
export const PAYMENTS = "payments";
export const COUNT_PASSES = "countPasses";
export const TIME_PASSES = "timePasses";
export const ROOMS = "rooms";
export const PENDING_REWARDS = "pendingRewards";
/** **"생일 기념 무료 이용권"** 지급 원장(중복 지급 방지 키).
 *
 *  이름이 `birthdayCoupon*` 인 것은 옛 명칭("생일 쿠폰")의 흔적이다 — 2026-09-25 에 할인쿠폰이
 *  생기면서 "쿠폰"이 두 가지를 뜻하게 돼 사용자에게 보이는 말만 바꿨다. 컬렉션 이름과 함수
 *  이름(`dailyBirthdayCouponPayout`)은 **그대로 둔다**: 이미 쌓인 문서의 경로이고, 함수 이름을
 *  바꾸면 배포 때 새 함수가 생기고 옛 함수가 남는다. 화면·약관에는 새 이름만 쓴다. */
export const BIRTHDAY_COUPON_GRANTS = "birthdayCouponGrants";
/** 사용자가 **등록한** 할인쿠폰(문서 id = 코드). 최상위 `DISCOUNT_COUPONS` 의 조건을 등록
 *  시점에 복사해 둔다 — 구매할 때 최상위를 다시 읽지 않아도 되고, 발급 뒤 조건을 고쳐도 이미
 *  받은 사람의 조건이 소급해 바뀌지 않는다. 문서가 있다는 것 자체가 "이미 등록함"이라,
 *  같은 코드 재등록은 이 문서의 존재만으로 걸러진다. */
export const USER_DISCOUNT_COUPONS = "discountCoupons";

/** 사주 리포트 **주문 마커**(문서 id = paymentId). users/{uid} 서브컬렉션.
 *
 *  리포트 문서와 따로 두는 이유가 둘 있다.
 *  - **멱등 키**: 결제 확정·열기 요청이 재시도로 두 번 들어와도 이 문서 하나가 "이미 열었다"를
 *    말해 준다. 컬렉션을 훑거나 인덱스를 만들 필요가 없다.
 *  - **"결제는 됐는데 아직 안 열림"의 자리**: 리포트 문서는 골격이 있어야만 생기는데(그 앞의
 *    빈 문서를 만들지 않는 게 `createSajuReading` 의 전제다), 결제와 골격 사이에는 29초가 있다.
 *    그 구간의 상태를 여기서 표현한다.
 *
 *  문서 id 를 paymentId 로 하면서도 **리포트 id 와는 묶지 않는다** — 결제 식별자가 화면 주소에
 *  박히면 히스토리·공유 링크·분석 경로에 다 남고 되돌릴 수 없다(2026-09-26 판단). 구매 시점
 *  스냅샷도 여기 담기므로 users 서브트리 안이어야 한다(탈퇴 시 recursiveDelete 대상). */
export const SAJU_ORDERS = "sajuOrders";

/** 사주·자미두수 **유료 리포트 한 편**(문서 id = 주문 id). 타로의 `ROOMS`/`READINGS` 와는
 *  완전히 별개다 — 대화가 이어지는 방이 아니라 한 번 팔고 끝나는 결과물이라, 방 개념이 없다.
 *  이름에 saju 를 붙인 것은 같은 사용자 밑에 `readings` 가 이미 다른 뜻으로 있기 때문이다. */
export const SAJU_READINGS = "sajuReadings";

/** users/{uid}/rooms/{roomId} 서브컬렉션. */
export const READINGS = "readings";

/** users/{uid}/sajuReadings/{id} 서브컬렉션 — 섹션 본문 한 페이지.
 *
 *  문서 id 는 페이지 번호의 문자열이지만 **정렬에 쓰지 않는다**: 문자열 정렬이면 "10" 이 "2"
 *  앞에 오기 때문이다. 목록을 만들 때는 문서 안의 `pageNumber`(숫자)로 orderBy 한다. */
export const SAJU_PAGES = "pages";

/** users/{uid}/sajuReadings/{id} 서브컬렉션 — 페이지가 아닌 부속물. 지금은 이미지 하나뿐이다.
 *
 *  **`SAJU_PAGES` 에 넣지 말 것.** 총평을 만들 수 있는지 판단할 때 `pages` 의 문서 수를
 *  섹션 수와 비교하는데(`produce.ts`), 거기에 이미지가 끼면 그 수가 틀어진다. */
export const SAJU_ASSETS = "assets";

/** referralGrants/{referrerUid} 서브컬렉션. */
export const REFERRAL_GRANT_FRIENDS = "friends";
