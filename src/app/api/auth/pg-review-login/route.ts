import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

// KG이니시스 전자계약 사전점검의 "비회원 구매 가능 여부"(회원가입 필수 → 테스트 ID/PW 요구)
// 항목 대응. 타연은 카카오 로그인만 있어서 심사자가 쓸 수 있는 ID/PW 로그인이 없었음 — 새
// 회원가입 시스템을 만드는 대신, 정확히 이 하나의 고정 계정에만 동작하는 좁은 통로 하나만
// 추가한다(PG_REVIEW_TEST_ID/PASSWORD, .env.local). 일치하지 않으면 아이디/비번 중 뭐가 틀렸는지
// 구분해서 알려주지 않는다(계정 존재 여부를 흘리지 않기 위함).
const TEST_UID = "pgreview:tayeon";

export async function POST(req: NextRequest) {
  const testId = process.env.PG_REVIEW_TEST_ID;
  const testPassword = process.env.PG_REVIEW_TEST_PASSWORD;
  if (!testId || !testPassword) {
    return NextResponse.json({ error: "심사용 로그인이 설정되지 않았어요." }, { status: 503 });
  }

  const { id, password } = (await req.json()) as { id?: string; password?: string };
  if (id !== testId || password !== testPassword) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 일치하지 않아요." }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(TEST_UID);
  const existing = await userRef.get();
  if (!existing.exists) {
    await userRef.set({
      nickname: "심사용계정",
      provider: "pg-review",
      termsAgreedAt: new Date().toISOString(),
      coins: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const token = await adminAuth.createCustomToken(TEST_UID);
  return NextResponse.json({ token });
}
