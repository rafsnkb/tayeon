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

  // Firestore 배치는 최대 500 쓰기다. 리딩을 한 배치에 다 담으면 500개가 넘는 방(일 100회
  // 상한이니 며칠이면 닿는다)은 커밋이 거부돼 **영구히 삭제 불가**가 된다(2026-09-24).
  // recursiveDelete 를 쓰면 방 문서와 하위를 한 번에 지울 수 있지만, 여기선 쪼개서 지운다 —
  // 방 문서를 마지막에 지워야 중간에 실패해도 "리딩만 사라진 방"이 남지 않는다.
  const BATCH_LIMIT = 450;
  const readingsSnap = await roomRef.collection(READINGS).get();
  for (let i = 0; i < readingsSnap.docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const doc of readingsSnap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
    await batch.commit();
  }
  await roomRef.delete();

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
