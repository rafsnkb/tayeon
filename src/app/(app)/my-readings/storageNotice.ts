/** 보관함 하단 안내 두 줄(목업 `MyFortuneStorage_Dark/Light`).
 *
 *  **문장은 여기 없다.** 같은 두 문장을 결제 화면의 환불 안내가 함께 쓰므로, 원문은
 *  `fortune/[slug]/refundNotice.ts` 의 `STORAGE_NOTICE` 한 곳에 있고 여기서는 그대로 내보낸다.
 *
 *  예전엔 `REFUND_NOTICE` 를 훑어 문자열 매칭으로 골랐다(그때는 그쪽에 이름 붙은 export 가
 *  없었다). 2026-09-26 에 그쪽이 `STORAGE_NOTICE` 를 내보내면서 이 파일이 한 줄로 줄었다 —
 *  이 파일 주석이 예고해 둔 그대로다. 매칭 키워드가 문구 변경을 못 따라가는 약한 연결이
 *  사라졌다. */
export { STORAGE_NOTICE } from "../fortune/[slug]/refundNotice";
