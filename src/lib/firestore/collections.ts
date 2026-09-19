// Firestore 컬렉션 이름 상수. 14개 이상 파일에 문자열 리터럴로 반복되던 걸 모아둔 것 —
// 오타로 인한 실제 버그는 발견된 적 없음(스타일/유지보수 목적). 전수 교체는 과할 수 있어
// 결제/이용권 관련 핵심 경로부터 우선 적용했고, 나머지 리터럴은 필요할 때 마저 옮기면 된다.

/** 최상위 컬렉션. */
export const USERS = "users";
export const REFERRAL_CODES = "referralCodes";
export const REFERRAL_GRANTS = "referralGrants";
export const SIGNUP_GRANTS = "signupGrants";
export const REFUND_REQUESTS = "refundRequests";
/** 회원 탈퇴 시 users/{uid}/payments에서 복사되는 결제 기록 아카이브(전자상거래법 시행령
 * 제6조 5년 보존 의무 — src/app/api/user/delete/route.ts 참고). */
export const PAYMENT_ARCHIVE = "paymentArchive";

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
