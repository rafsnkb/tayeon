import { NextRequest, NextResponse } from "next/server";
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
  const { suspended, reason } = (await req.json()) as {
    suspended?: boolean;
    reason?: string;
  };

  if (typeof suspended !== "boolean") {
    return NextResponse.json({ error: "suspended는 true/false여야 합니다." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }

  const adminUser = await adminAuth.getUser(adminUid);
  const now = new Date().toISOString();

  await userRef.update(
    suspended
      ? { suspended: true, suspendedAt: now, suspendedReason: reason?.trim() || null }
      : { suspended: false, suspendedAt: null, suspendedReason: null }
  );

  await userRef.collection("suspensionLog").add({
    suspended,
    reason: reason?.trim() || null,
    byUid: adminUid,
    byEmail: adminUser.email ?? null,
    createdAt: now,
  });

  return NextResponse.json({ suspended });
}
