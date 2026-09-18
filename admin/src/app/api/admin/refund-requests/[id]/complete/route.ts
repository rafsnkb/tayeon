import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { const uid = await getAdminUidFromRequest(req); if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 }); const { id } = await params; const ref = adminDb.collection("refundRequests").doc(id); const snap = await ref.get(); if (!snap.exists || snap.data()?.status !== "pending") return NextResponse.json({ error: "처리할 수 없는 요청입니다." }, { status: 409 }); await ref.update({ status: "approved", approvedAt: new Date().toISOString(), approvedByUid: uid }); return NextResponse.json({ ok: true }); }
