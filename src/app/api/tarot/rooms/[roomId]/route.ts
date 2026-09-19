import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, ROOMS, READINGS } from "@/lib/firestore/collections";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { roomId } = await params;
  const roomRef = adminDb.collection(USERS).doc(uid).collection(ROOMS).doc(roomId);

  const readingsSnap = await roomRef.collection(READINGS).get();
  const batch = adminDb.batch();
  readingsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(roomRef);
  await batch.commit();

  return NextResponse.json({ ok: true });
}

/** 피그마 "Screen / More"(TopBar 정보 버튼 드롭다운)의 "이름 변경" — 기존엔 없던 기능. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { title } = (await req.json()) as { title?: string };
  if (!title || !title.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }

  const { roomId } = await params;
  const roomRef = adminDb.collection(USERS).doc(uid).collection(ROOMS).doc(roomId);
  await roomRef.update({ title: title.trim().slice(0, 40), updatedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
