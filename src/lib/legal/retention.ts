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

/** 구매한 사주·자미두수 리포트를 보관하는 기간. 구매 화면과 운세 보관함이 이 숫자를 문장으로
 *  보여준다("30일 간 보관됩니다 / 30일이 초과하여 소실된 경우에는 복구가 불가능합니다").
 *
 *  ⚠️ **이 값을 고쳐도 이미 팔린 리포트는 움직이지 않는다.** 만료 시각은 리포트를 만들 때 문서에
 *  박아 두기 때문이다(`src/lib/saju/storage.ts` 의 `expiresAt`). 그래야 하는 이유: 사용자는 구매
 *  시점에 "30일"을 보고 샀는데, 나중에 기간을 줄이면 **이미 판 약속이 소급해서 깎인다.** 늘리는
 *  경우도 마찬가지로 소급 적용하지 않는다 — 판 시점의 약속을 그대로 지키는 게 기준이다(§7 의
 *  `birthSnapshot` 을 얼리는 것과 같은 원칙). 여기 값은 **앞으로 팔 리포트**에만 적용된다. */
export const SAJU_REPORT_RETENTION_DAYS = 30;
