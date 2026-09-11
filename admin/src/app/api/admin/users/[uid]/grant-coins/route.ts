import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const { amount, reason } = (await req.json()) as { amount?: number; reason?: string };

  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "amount는 0이 아닌 정수여야 합니다." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }

  const adminUser = await adminAuth.getUser(adminUid);

  await userRef.update({ coins: FieldValue.increment(amount!) });
  await userRef.collection("coinGrants").add({
    amount,
    reason: reason?.trim() || null,
    grantedByUid: adminUid,
    grantedByEmail: adminUser.email ?? null,
    createdAt: new Date().toISOString(),
  });

  const updated = await userRef.get();
  return NextResponse.json({ coins: updated.data()?.coins ?? 0 });
}
