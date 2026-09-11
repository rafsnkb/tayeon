import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
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

  const now = new Date().toISOString();
  const roomRef = await adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
    .add({ title: "새 대화", createdAt: now, updatedAt: now });

  return NextResponse.json({ id: roomRef.id, title: "새 대화", updatedAt: now });
}
