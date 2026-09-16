// 포트원 V2 서버 SDK 클라이언트 — 결제 단건조회, 결제취소, 빌링키 발급/결제 등 서버 전용 API를
// 호출할 때 이 클라이언트 하나만 재사용한다(요청마다 새로 만들지 않음).
//
// PORTONE_API_SECRET은 포트원 관리자 콘솔(https://admin.portone.io) > 결제 연동 > 연동 정보에서
// "V2 API Secret"을 발급받아 .env.local에 채워넣는다. 절대 클라이언트 번들에 노출되면 안 되므로
// NEXT_PUBLIC_ 접두사를 붙이지 않는다.
import { PaymentClient } from "@portone/server-sdk";

if (!process.env.PORTONE_API_SECRET) {
  // 빌드는 계속 진행하되(계정 미가입 상태에서도 나머지 기능 개발을 막지 않기 위해), 실제 호출
  // 시점에 SDK가 401을 반환하며 실패하므로 로그로 원인을 명확히 남긴다.
  console.warn(
    "[portone] PORTONE_API_SECRET이 설정되지 않았어요. .env.local을 확인해주세요."
  );
}

export const portone = PaymentClient({
  secret: process.env.PORTONE_API_SECRET ?? "",
});
