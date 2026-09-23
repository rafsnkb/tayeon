// 사업자 정보 — 개인정보처리방침/이용약관, 앱 푸터, 고객센터 페이지에서 공유해서 쓴다.
// 정보가 바뀌면(통신판매업신고번호 등) 여기 한 곳만 고치면 전부 반영된다.

export const COMPANY_NAME_KO = "라프라움";
export const COMPANY_NAME_EN = "Rafraum";
export const CEO_NAME = "이정희";
// 개인정보 보호법상 개인정보 보호책임자는 대표와 다른 사람일 수 있음 — 타연은 실제로 다름.
export const PRIVACY_OFFICER_NAME = "이성희";
export const BUSINESS_REGISTRATION_NUMBER = "277-19-02371";
// 2026-09-23 신고 완료(송파구청). 자리표시자와 비교해 줄을 감추는 장치는 그대로 둔다 —
// 지금은 항상 참이라 줄이 보이지만, 값이 다시 비워지면 "통신판매업신고번호: 기입예정"이
// 노출되는 대신 줄이 사라진다(CompanyInfoModal 참고). 명시적 `: string` 타입도 그대로 둬야
// 한다 — 없으면 리터럴 타입으로 좁혀져서 비교 자체가 타입 오류가 된다.
export const MAIL_ORDER_NUMBER_PENDING = "기입예정";
export const MAIL_ORDER_BUSINESS_NUMBER: string = "제2026-서울송파-2640호";
export const COMPANY_ADDRESS = "서울특별시 송파구 거마로20길 18, 507호";
export const SUPPORT_EMAIL = "tayeon@rafraum.com";
export const CIVIL_COMPLAINT_OFFICER_NAME = "이성희";
export const CIVIL_COMPLAINT_PHONE = "010-8609-0037";
// ⚠️ PG(KG이니시스) 입점심사 요건은 "전화번호(휴대폰 불가)"를 요구하는데(help.portone.io/
// content/requirements), 아직 유선/인터넷전화가 없어서 사용자 스마트폰 번호로 임시 기입함
// (2026-09-15, 사용자 확정) — 심사에서 반려되면 유선/인터넷전화로 교체할 것.
//
// 2026-09-24: 010-3048-0060 → 010-8609-0037 로 통일(메인 목업 표기에 맞춤). 민원담당자 번호
// (CIVIL_COMPLAINT_PHONE)와 같은 번호가 됐지만 역할이 다르므로 상수는 둘 다 남긴다 —
// 사용자가 "차후에 한번 더 바꿀 것"이라고 했고, 그때 대표번호만 갈아끼울 수 있어야 한다.
export const COMPANY_PHONE = "010-8609-0037";

// 전자상거래법 시행규칙 제7조②가 초기 화면에 연결하도록 요구하는 공정위 사업자정보 공개페이지.
// 사업자등록번호에서 직접 만들어, 번호가 바뀌었는데 링크만 옛것으로 남는 일이 없게 한다.
export const FTC_BUSINESS_INFO_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_REGISTRATION_NUMBER.replace(/-/g, "")}`;

/** 운영자용 어드민의 환불 요청 화면. 운영 알림에 "바로 처리" 링크로 넣는다 — 별도 앱이라
 *  커스텀 도메인 없이 App Hosting 기본 주소를 쓴다(2026-09-12 결정). */
export const ADMIN_REFUND_REQUESTS_URL =
  process.env.ADMIN_BASE_URL?.replace(/\/$/, "")
    ? `${process.env.ADMIN_BASE_URL.replace(/\/$/, "")}/refund-requests`
    : "https://tayeon-admin--tayeon-d5149.asia-east1.hosted.app/refund-requests";
