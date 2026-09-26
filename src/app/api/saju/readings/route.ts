// 「운세 보관함」이 부르는 목록 — 이 사람이 산 리포트 전부.
//
// 이 라우트가 있어야 하는 이유가 제품 쪽에 있다. 결제 화면의 환불 안내가 *"해석 결과는
// 마이 페이지→운세 보관함에서 재열람이 가능하며"* 라고 약속하는데, 그 경로가 없으면
// **산 리포트를 다시 찾아갈 길이 없다.** 주소를 기억한 사람만 다시 볼 수 있는 상품이 된다.
//
// `GET` 이고 공짜다 — 저장된 문서만 읽고 모델을 부르지 않는다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { isSajuReadingExpired, listSajuReadings } from "@/lib/saju/storage";
import { toReadingSummary } from "@/lib/saju/view";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const readings = await listSajuReadings(uid);

  // **읽을 수 없게 된 건은 목록에서 뺀다**(2026-09-26 사용자 결정).
  //
  // 보관함은 "읽을 수 있는 것"의 목록이다 — 화면 하단 안내가 "재열람이 가능하며"라고 말한다.
  // 탭해도 안 열리는 카드를 거기 두면 그 말이 거짓이 되고, 사용자는 고장으로 읽는다.
  //
  // **기록이 사라지는 게 아니다.** 결제 문서는 전자상거래법 시행령 제6조제1항제2호("계약 또는
  // 청약철회 등에 관한 기록: 5년")로 보존 의무가 있고, 사용자에게는 결제 내역 화면이 이미
  // 「환불완료」 배지로 보여준다. 보관함과 결제 내역은 서로 다른 질문에 답하는 화면이다.
  //
  // 거르는 자리를 **여기 한 곳**으로 두는 이유: 화면마다 거르게 하면 새 화면이 생길 때
  // 빠뜨린다. 대신 리포트 **하나**를 직접 여는 `readings/[id]` 는 계속 돌려준다 — 주소를
  // 기억하거나 북마크한 사람에게 404 를 주면 "왜 없어졌지"가 되고, 뷰어가 "환불 처리된
  // 리포트예요" / "보관 기간이 지났어요"를 제대로 말해 줘야 한다.
  const now = new Date();
  const readable = readings.filter(
    (r) => r.status !== "failed" && !isSajuReadingExpired(r, now)
  );

  return NextResponse.json({ readings: readable.map(toReadingSummary) });
}
