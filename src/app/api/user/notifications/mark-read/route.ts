import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS } from "@/lib/firestore/collections";

/** 알림 목록 화면을 열었을 때 호출 — hasUnreadNotifications(/api/user/me) 배지를 끈다. */
export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await adminDb.collection(USERS).doc(uid).set({ notificationsSeenAt: new Date().toISOString() }, { merge: true });
  return NextResponse.json({ ok: true });
}
