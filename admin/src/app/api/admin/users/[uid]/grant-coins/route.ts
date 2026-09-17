import { NextResponse } from "next/server";

// 코인 지급은 횟수제 이용권 지급으로 전환됐다. 이전 URL을 호출해도 금전성 잔액을
// 변경하지 않도록 명시적으로 종료한다.
export async function POST() {
  return NextResponse.json(
    { error: "코인 지급 기능은 종료되었습니다. 횟수제 이용권 지급을 사용해주세요." },
    { status: 410 }
  );
}
