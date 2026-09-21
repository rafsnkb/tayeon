// 환불 요청 가능 기간(결제일로부터 N일 이내 + 미사용 상태). 실제 판단 기준은
// src/app/api/user/purchase-history/route.ts와 src/app/api/user/refund-requests/route.ts에서
// 이 값으로 계산한다. 안내 문구(charge/page.tsx, legal/content.ts 등)도 같은 값을 import해서
// 쓴다 — 이 파일은 firebase-admin 등 서버 전용 모듈을 import하지 않아 클라이언트 컴포넌트에서도
// 안전하게 쓸 수 있다(값만 export).
export const REFUND_WINDOW_DAYS = 7;

/** 환불 승인 후 환급까지의 약속 기간(영업일) — 이용약관 제N조와 환불 확인 모달이 같이 쓴다.
 *  전자상거래법 제18조제2항의 "3영업일 이내 환급" 기준. */
export const REFUND_PROCESSING_BUSINESS_DAYS = 3;
