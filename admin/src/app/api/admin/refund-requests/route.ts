import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const snapshot = await adminDb.collection("refundRequests").orderBy("requestedAt", "desc").limit(100).get();
  const refs = snapshot.docs.map((doc) => adminDb.collection("users").doc(doc.data().uid ?? ""));
  const users = refs.length ? await adminDb.getAll(...refs) : [];
  const nicknames = new Map(users.map((user) => [user.id, user.data()?.nickname ?? null]));
  return NextResponse.json({ requests: snapshot.docs.map((doc) => ({ id: doc.id, nickname: nicknames.get(doc.data().uid) ?? null, paymentMethod: doc.data().paymentMethod ?? null, ...doc.data() })) });
}
