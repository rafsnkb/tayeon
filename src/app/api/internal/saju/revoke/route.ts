// 어드민(별도 앱)이 사주 리포트를 **환불로 잠글 때** 쓰는 내부 창구.
//
// `src/app/api/internal/notify` 와 같은 이유로 있다. 어드민의 `@/*` 는 `admin/src/*` 라
// 메인 앱의 `@/lib/saju/storage` 를 import 할 수 없고, 그렇다고 잠그는 로직을 어드민에
// 복사하면 **두 벌이 된다** — 이 저장소에서 이미 아픈 자리다(`functions/` 의 상수가 두 벌이라
// 한쪽만 고쳐진 적이 있다).
//
// ## 왜 잠가야 하나
//
// 환불은 두 순서로 온다. 메인 앱의 `revoke.ts`(결제 취소 웹훅)는 둘 다 처리하지만 어드민
// 환불 경로(`admin/src/lib/refundExecute.ts`)는 `productType` 이 타로 3종으로 닫혀 있어
// **아무 일도 하지 않는다** — 환불받고도 리포트가 계속 읽힌다.
//
// - **환불이 열기보다 뒤**: 리포트가 이미 있다 → `status: "failed"` 로 잠근다. 게이트가
//   `reading_failed` 로 뒤 페이지 생성까지 막는다.
// - **환불이 열기보다 먼저**(결제 직후 취소): 잠글 리포트가 아직 없다. 마커를 `refunded` 로
//   내려야 **그 뒤에 들어온 열기 요청이 환불된 결제로 리포트를 만들어 주는 걸** 막는다.
//
// 그래서 둘 다, 한 트랜잭션에서 한다.
import { NextRequest, NextResponse } from "next/server";
import { constantTimeEquals } from "@/lib/auth/constantTime";
import { adminDb } from "@/lib/firebase/admin";
import {
  markSajuOrderRefunded,
  markSajuReadingFailed,
  sajuOrderRef,
  type SajuOrder,
} from "@/lib/saju/storage";

export async function POST(req: NextRequest) {
  // 호출자가 사람이 아니라 서버(어드민)라 Firebase ID 토큰이 없다. 공유 시크릿으로 막는다.
  // 시크릿이 없으면 **열어 두지 않고 닫는다** — 열린 채로 두면 아무나 남의 리포트를 잠근다.
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal/saju/revoke] INTERNAL_API_SECRET 미설정 — 호출을 거부한다");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!constantTimeEquals(req.headers.get("x-internal-secret"), secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    uid?: unknown;
    paymentId?: unknown;
    reason?: unknown;
  } | null;
  const uid = typeof body?.uid === "string" ? body.uid : null;
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : null;
  if (!uid || !paymentId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "환불로 회수됨";

  const result = await adminDb.runTransaction(async (tx) => {
    const orderSnap = await tx.get(sajuOrderRef(uid, paymentId));
    // 사주 주문이 아니면 할 일이 없다. 어드민은 결제 종류를 모르고 부를 수 있으므로
    // **없는 것을 오류로 만들지 않는다** — 타로 환불마다 400 이 뜨면 호출부가 무시하게 된다.
    if (!orderSnap.exists) return { locked: false, readingId: null as string | null };

    const readingId = (orderSnap.data() as SajuOrder).readingId ?? null;
    markSajuOrderRefunded(tx, uid, paymentId);
    if (readingId) markSajuReadingFailed(uid, readingId, reason, tx);
    return { locked: true, readingId };
  });

  // 멱등하다. 같은 건을 두 번 불러도 같은 답이 온다 — 환불 재시도는 흔하고, 두 번째 호출이
  // 실패로 보이면 호출부가 사람을 부른다.
  return NextResponse.json({ ok: true, ...result });
}
