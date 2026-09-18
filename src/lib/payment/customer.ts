// KG이니시스 V2(PC 결제/빌링키 발급 공통)는 customer.email/phoneNumber/fullName을 전부
// 필수로 요구한다(2026-09-15, 실제 테스트+공식 문서로 확인 — opi/ko/integration/pg/v2/
// inicis-v2.md). 타연은 카카오 로그인에 전화번호 동의항목이 없고 이메일도 동의 안 한 계정이면
// 비어있을 수 있어서, 없는 값은 형식만 유효한 자리표시 값으로 대체한다 — 이니시스는 형식만
// 검증하고 실제로 메일/문자를 보내지 않는다.
export function buildPortoneCustomer(params: {
  uid: string;
  email: string | null;
  nickname: string | null;
}): { email: string; phoneNumber: string; fullName: string } {
  return {
    // uid가 "kakao:1234" 형태라 콜론이 들어있으면 이메일 로컬파트로 유효하지 않아 형식 검증에서
    // 튕겨나가므로(실제로 재현됨), 영숫자/점/대시만 남기고 나머지는 대시로 치환한다.
    email: params.email || `${params.uid.replace(/[^a-zA-Z0-9.-]/g, "-")}@users.tayeon.kr`,
    phoneNumber: "01000000000",
    // 이 값은 실제 유저 데이터(닉네임)라 자리표시가 아니라 그대로 씀.
    fullName: params.nickname || "타연 이용자",
  };
}
