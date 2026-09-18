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
  const { suspended, reason, durationDays } = (await req.json()) as {
    suspended?: boolean;
    reason?: string;
    durationDays?: number | null;
  };

  if (typeof suspended !== "boolean") {
    return NextResponse.json({ error: "suspended는 true/false여야 합니다." }, { status: 400 });
  }
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  if (suspended && (!trimmedReason || trimmedReason.length > 200)) {
    return NextResponse.json({ error: "정지 사유를 1~200자로 입력해주세요." }, { status: 400 });
  }
  if (suspended && durationDays !== null && durationDays !== undefined && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650)) {
    return NextResponse.json({ error: "기간 정지는 1일 이상 3,650일 이하여야 합니다." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }

  const adminUser = await adminAuth.getUser(adminUid);
  const now = new Date().toISOString();
  const suspendedUntil = suspended && durationDays ? new Date(Date.now() + durationDays * 86_400_000).toISOString() : null;

  await userRef.update(
    suspended
      ? { suspended: true, suspendedAt: now, suspendedUntil, suspendedReason: trimmedReason }
      : { suspended: false, suspendedAt: null, suspendedUntil: null, suspendedReason: null }
  );

  await userRef.collection("suspensionLog").add({
    suspended,
    reason: suspended ? trimmedReason : null,
    durationDays: suspended ? durationDays ?? null : null,
    suspendedUntil,
    byUid: adminUid,
    byEmail: adminUser.email ?? null,
    createdAt: now,
  });

  return NextResponse.json({ suspended, suspendedUntil });
}
