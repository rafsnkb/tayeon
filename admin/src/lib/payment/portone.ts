// 포트원 V2 서버 SDK 클라이언트 — admin 앱은 타연 본체와 완전히 분리된 별도 앱이라 자체
// node_modules/설정을 가지므로, 같은 설명의 클라이언트를 여기 별도로 둔다(src/lib/payment/portone.ts
// 참고).
//
// PORTONE_API_SECRET은 포트원 관리자 콘솔(https://admin.portone.io) > 결제 연동 > 연동 정보에서
// "V2 API Secret"을 발급받아 admin/.env.local에 채워넣는다(타연 본체와 같은 값).
import { PaymentClient } from "@portone/server-sdk";

if (!process.env.PORTONE_API_SECRET) {
  console.warn(
    "[portone] PORTONE_API_SECRET이 설정되지 않았어요. admin/.env.local을 확인해주세요."
  );
}

export const portone = PaymentClient({
  secret: process.env.PORTONE_API_SECRET ?? "",
});
