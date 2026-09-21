// 사업자 정보 — 개인정보처리방침/이용약관, 앱 푸터, 고객센터 페이지에서 공유해서 쓴다.
// 정보가 바뀌면(통신판매업신고번호 등) 여기 한 곳만 고치면 전부 반영된다.

export const COMPANY_NAME_KO = "라프라움";
export const COMPANY_NAME_EN = "Rafraum";
export const CEO_NAME = "이정희";
// 개인정보 보호법상 개인정보 보호책임자는 대표와 다른 사람일 수 있음 — 타연은 실제로 다름.
export const PRIVACY_OFFICER_NAME = "이성희";
export const BUSINESS_REGISTRATION_NUMBER = "277-19-02371";
// 아직 신고 전 — 신고 완료 후 실제 번호로 교체할 것 (doc/작업현황.md 열린 항목 참고).
// 화면에서는 이 자리표시자와 비교해 줄 자체를 감춘다(CompanyInfoModal 참고).
export const MAIL_ORDER_NUMBER_PENDING = "기입예정";
export const MAIL_ORDER_BUSINESS_NUMBER: string = MAIL_ORDER_NUMBER_PENDING;
export const COMPANY_ADDRESS = "서울특별시 송파구 거마로20길 18, 507호";
export const SUPPORT_EMAIL = "tayeon@rafraum.com";
export const CIVIL_COMPLAINT_OFFICER_NAME = "이성희";
export const CIVIL_COMPLAINT_PHONE = "010-8609-0037";
// ⚠️ PG(KG이니시스) 입점심사 요건은 "전화번호(휴대폰 불가)"를 요구하는데(help.portone.io/
// content/requirements), 아직 유선/인터넷전화가 없어서 사용자 스마트폰 번호로 임시 기입함
// (2026-09-15, 사용자 확정) — 심사에서 반려되면 유선/인터넷전화로 교체할 것.
export const COMPANY_PHONE = "010-3048-0060";

// 전자상거래법 시행규칙 제7조②가 초기 화면에 연결하도록 요구하는 공정위 사업자정보 공개페이지.
// 사업자등록번호에서 직접 만들어, 번호가 바뀌었는데 링크만 옛것으로 남는 일이 없게 한다.
export const FTC_BUSINESS_INFO_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${BUSINESS_REGISTRATION_NUMBER.replace(/-/g, "")}`;
