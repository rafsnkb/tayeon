// 결제된 주문 하나를 리포트로 연다 — 계산 + 골격(약 29초).
//
// ## 왜 결제 확정(`fulfill`)이 아니라 여기인가
//
// 골격까지 29초다. 그걸 결제 확정 웹훅 안에서 돌리면 **웹훅이 29초를 잡는다.** 타임아웃과
// 재시도가 겹쳐 같은 결제가 두 번 이행될 수 있고, 결제에서 그건 제일 비싼 종류의 사고다.
// 그래서 `fulfill` 은 "주문이 성립했다"까지만 쓰고(주문 마커), 여는 건 여기서 한다.
//
// 29초를 누가 기다리나 — **방금 결제하고 로딩을 보고 있는 사용자**다. 기다림이 예상 범위 안에
// 있는 유일한 구간이고, 워커나 큐를 새로 들이지 않고 끝난다(§6 이 페이지 온디맨드에서 내린
// 결론과 같은 모양이다).
//
// ## 왜 GET 이 아닌가
//
// 이 라우트 묶음의 규칙이다 — **돈이 나가는 일은 POST.** 골격 한 번이 섹션 한 장보다 비싸다.
// `GET readings/{id}` 에 이걸 넣으면 브라우저 prefetch·크롤러·실수로 연 탭이 전부 골격을 돌린다.
//
// **멱등하다.** 두 번 불러도 리포트는 하나다(`openSajuReading` 이 주문 마커의 `readingId` 로
// 보장한다). 그래서 화면이 실패 시 그냥 다시 불러도 된다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { refundUnopenableSajuOrder } from "@/lib/payment/refundUnopenable";
import { openSajuReading } from "@/lib/saju/open";

type Params = { params: Promise<{ paymentId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { paymentId } = await params;
  const result = await openSajuReading(uid, paymentId);

  if (result.outcome === "not_paid") {
    // 남의 주문 번호를 넣어도 여기로 온다 — 마커가 `users/{uid}` 아래라 그냥 없는 문서가 된다.
    return NextResponse.json({ error: "not_paid" }, { status: 404 });
  }

  if (result.outcome === "refundable") {
    // §9 의 전액 환불 경계 안이다(계산 실패·골격 3회 실패 — 사용자가 아직 아무것도 읽지 않았다).
    //
    // **환불을 이 라우트가 직접 실행하지는 않는다.** 포트원을 부르고 쿠폰을 복원하고 마커를
    // 내리는 일은 결제 계층의 책임이고, 읽기 라우트가 그 일을 직접 하기 시작하면 "이 라우트가
    // 결제에 대해 무엇까지 할 수 있는가"의 경계가 사라진다. 여기서는 **범위가 이름에 박힌
    // 함수 하나**를 부른다 — 열 수 없는 주문을 환불한다, 그 이상은 하지 않는다.
    const refund = await refundUnopenableSajuOrder(uid, paymentId, result.reason);

    // 취소가 실패하면 **돈이 묶인다.** 그 경우의 urgent 알림은 그 함수가 이미 보냈으므로
    // 여기서 또 부르지 않는다 — 같은 사고에 알림이 두 번 오면 둘 다 덜 읽히게 된다.
    // 사용자에게는 "환불이 지연되고 있다"로 보여야 하므로 코드를 갈라 준다.
    return NextResponse.json(
      {
        error: refund.kind === "cancel_failed" ? "refund_pending" : "refunded",
        reason: result.reason,
      },
      { status: 409 }
    );
  }

  // `opened` 와 `already` 를 굳이 갈라 돌려준다. 화면은 둘 다 같게 다루면 되지만, 로그에서
  // "재시도가 실제로 겹쳤는가"를 볼 수 있어야 29초 구간의 동시 요청을 나중에 셀 수 있다.
  return NextResponse.json({ readingId: result.readingId, opened: result.outcome === "opened" });
}
