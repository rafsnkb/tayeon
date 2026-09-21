// 개인정보처리방침 제3조가 약속한 보관기간. **값만** 둔다.
//
// 이 파일은 약관 본문(src/lib/legal/content.ts)이 import하고, 그 약관은 /signup의 동의 모달 같은
// 클라이언트 컴포넌트에서도 쓰인다. 그래서 firebase-admin 같은 서버 전용 모듈을 여기서 import하면
// 클라이언트 번들로 끌려 들어가 빌드가 깨진다(2026-09-21에 실제로 깨뜨렸다 —
// retention.ts → content.ts → signup/page.tsx 경로로 firebase-admin이 딸려갔다).
// Timestamp 변환이 필요하면 서버 전용인 retentionTimestamp.ts를 쓸 것.
//
// 보관기간을 한 곳에 모아둔 이유: 방침에 "N년 보관"이라고 써두고 실제로는 영구 보관하면 그것도
// 위반이라, 약속한 값과 집행하는 값이 갈라지지 않아야 한다.

/** 대금결제·재화공급 기록 5년 — 전자상거래법 시행령 제6조. */
export const PAYMENT_RECORD_RETENTION_MONTHS = 60;

/** 소비자 불만·분쟁처리 기록 3년 — 같은 시행령 제6조. 고객센터 문의와 환불 요청이 여기 해당한다. */
export const DISPUTE_RECORD_RETENTION_MONTHS = 36;

/** 부정가입 방지 마커 6개월 — 개인정보 보호법 제15조1항6호(정당한 이익) 근거.
 *  실제 사용처는 src/lib/referral/code.ts. */
export const GRANT_MARKER_RETENTION_MONTHS = 6;
