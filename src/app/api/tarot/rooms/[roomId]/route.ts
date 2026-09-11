import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const roomRef = adminDb.collection("users").doc(uid).collection("rooms").doc(roomId);

  const readingsSnap = await roomRef.collection("readings").get();
  const batch = adminDb.batch();
  readingsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(roomRef);
  await batch.commit();

  return NextResponse.json({ ok: true });
}
