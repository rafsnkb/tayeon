import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // doc.delete()는 서브컬렉션(rooms/readings, coinGrants, suspensionLog, timePasses)을
  // 지우지 않으므로 recursiveDelete로 전부 함께 삭제한다.
  await adminDb.recursiveDelete(adminDb.collection("users").doc(uid));
  await adminAuth.deleteUser(uid);

  return NextResponse.json({ ok: true });
}
