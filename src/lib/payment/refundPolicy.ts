// 환불 요청 가능 기간(결제일로부터 N일 이내 + 미사용 상태). 실제 판단 기준은
// src/app/api/user/purchase-history/route.ts와 src/app/api/user/refund-requests/route.ts에서
// 이 값으로 계산한다. 안내 문구(charge/page.tsx, legal/content.ts 등)도 같은 값을 import해서
// 쓴다 — 이 파일은 firebase-admin 등 서버 전용 모듈을 import하지 않아 클라이언트 컴포넌트에서도
// 안전하게 쓸 수 있다(값만 export).
export const REFUND_WINDOW_DAYS = 7;
