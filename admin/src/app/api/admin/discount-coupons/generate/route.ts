// 아직 쓰이지 않은 랜덤 쿠폰 코드를 하나 돌려준다.
//
// 중복 판정을 **서버에서** 하는 이유: 어드민 목록은 최근 100건만 불러오므로, 화면이 가진
// 목록과 대조해서는 그보다 오래된 코드와 겹치는 것을 잡지 못한다. 문서를 직접 읽어야 한다.
//
// 여기서 자리를 맡아 두지는 않는다(빈 문서를 미리 만들지 않는다). 발급 자체가 트랜잭션 안에서
// 존재 여부를 다시 보므로, 두 사람이 같은 코드를 동시에 받더라도 실제로 만들어지는 건 하나다.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { generateCouponCode } from "@/lib/discountCouponRules";

const DISCOUNT_COUPONS = "discountCoupons";
/** 25글자 10자리면 경우의 수가 10^14 쯤이라 몇 번 안에 빈 코드가 나온다. 그래도 한도를 두어
 *  Firestore 를 무한히 두드리지 않게 한다. */
const MAX_ATTEMPTS = 10;

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ?check=CODE — 직접 입력한 코드가 이미 쓰였는지만 본다. 발급을 눌러야 알 수 있게 두면
  // 날짜·이름까지 다 채운 뒤에야 "이미 존재하는 코드"를 보게 된다.
  const check = req.nextUrl.searchParams.get("check");
  if (check !== null) {
    const code = check.trim().toUpperCase();
    if (!code) return NextResponse.json({ code: "", taken: false });
    const snap = await adminDb.collection(DISCOUNT_COUPONS).doc(code).get();
    return NextResponse.json({ code, taken: snap.exists });
  }

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = generateCouponCode();
    const snap = await adminDb.collection(DISCOUNT_COUPONS).doc(code).get();
    if (!snap.exists) return NextResponse.json({ code });
  }

  console.error("[coupon] 랜덤 코드 생성 실패 — 시도 한도 초과");
  return NextResponse.json({ error: "코드를 만들지 못했습니다. 다시 시도해주세요." }, { status: 503 });
}
