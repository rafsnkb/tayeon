import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { executeRefund } from "@/lib/refundExecute";

// 환불 정책은 UI 조건이 아니라 서버에서 강제한다 — 실제 검사와 실행은 executeRefund 안에 있고,
// 2영업일 뒤 자동 승인(refund-requests/auto-approve)도 같은 함수를 쓴다.
export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const { paymentId, reason } = (await req.json()) as { paymentId?: string; reason?: string };
  if (!paymentId || !reason?.trim()) {
    return NextResponse.json({ error: "paymentId와 reason이 필요해요." }, { status: 400 });
  }

  const result = await executeRefund({ uid, paymentId, reason, approvedBy: adminUid });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ cancellation: result.cancellation });
}
