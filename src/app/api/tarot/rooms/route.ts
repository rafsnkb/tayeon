import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { DEFAULT_ROOM_TITLE } from "@/lib/tarot/room";
import { ROOM_LIMIT } from "@/lib/tarot/limits";
import { USERS, ROOMS } from "@/lib/firestore/collections";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb
    .collection(USERS)
    .doc(uid)
    .collection(ROOMS)
    .orderBy("updatedAt", "desc")
    .get();

  const rooms = snap.docs.map((doc) => ({
    id: doc.id,
    title: doc.data().title,
    updatedAt: doc.data().updatedAt,
  }));

  return NextResponse.json({ rooms });
}



export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { confirmDeleteOldest } = (await req.json().catch(() => ({}))) as { confirmDeleteOldest?: boolean };

  const roomsRef = adminDb.collection(USERS).doc(uid).collection(ROOMS);
  const countSnap = await roomsRef.count().get();
  if (countSnap.data().count >= ROOM_LIMIT) {
    if (!confirmDeleteOldest) {
      return NextResponse.json(
        { error: "대화방 갯수가 한도에 도달했습니다.", code: "ROOM_LIMIT" },
        { status: 409 }
      );
    }
    const oldestSnap = await roomsRef.orderBy("createdAt", "asc").limit(1).get();
    const oldest = oldestSnap.docs[0];
    if (oldest) {
      await adminDb.recursiveDelete(oldest.ref);
    }
  }

  const now = new Date().toISOString();
  const roomRef = await roomsRef.add({ title: DEFAULT_ROOM_TITLE, createdAt: now, updatedAt: now });

  return NextResponse.json({ id: roomRef.id, title: DEFAULT_ROOM_TITLE, updatedAt: now });
}
