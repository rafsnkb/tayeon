import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUid = await getAdminUidFromRequest(req); if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params; const { reason } = await req.json().catch(() => ({}));
  if (typeof reason !== "string" || !reason.trim()) return NextResponse.json({ error: "거절 사유를 입력해주세요." }, { status: 400 });
  const ref = adminDb.collection("refundRequests").doc(id); const snap = await ref.get();
  if (!snap.exists || snap.data()?.status !== "pending") return NextResponse.json({ error: "처리할 수 없는 요청입니다." }, { status: 409 });
  await ref.update({ status: "rejected", rejectedAt: new Date().toISOString(), rejectedByUid: adminUid, rejectionReason: reason.trim().slice(0, 1000) });
  return NextResponse.json({ ok: true });
}
