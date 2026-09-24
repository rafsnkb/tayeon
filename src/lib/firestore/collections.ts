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

/** users/{uid} 서브컬렉션. */
export const PAYMENTS = "payments";
export const COUNT_PASSES = "countPasses";
export const TIME_PASSES = "timePasses";
export const ROOMS = "rooms";
export const PENDING_REWARDS = "pendingRewards";
export const BIRTHDAY_COUPON_GRANTS = "birthdayCouponGrants";

/** users/{uid}/rooms/{roomId} 서브컬렉션. */
export const READINGS = "readings";

/** referralGrants/{referrerUid} 서브컬렉션. */
export const REFERRAL_GRANT_FRIENDS = "friends";
