import { NextResponse } from "next/server";

// 빌링키 결제는 이용권 소진 시 서버 내부에서만 실행한다. 클라이언트가 금액과 주문명을 보내던
// 개발용 엔드포인트를 남기면 임의 결제를 만들 수 있어 운영에서는 명시적으로 종료한다.
export async function POST() {
  return NextResponse.json({ error: "이 경로는 더 이상 사용할 수 없어요." }, { status: 410 });
}
