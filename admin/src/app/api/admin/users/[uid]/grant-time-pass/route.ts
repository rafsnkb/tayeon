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
  const { minutes, includesOptions, priceWon, reason } = (await req.json()) as {
    minutes?: number;
    includesOptions?: boolean;
    priceWon?: number;
    reason?: string;
  };

  if (!Number.isInteger(minutes) || minutes! <= 0) {
    return NextResponse.json({ error: "minutes는 양의 정수여야 합니다." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }

  const adminUser = await adminAuth.getUser(adminUid);

  const passRef = await userRef.collection("timePasses").add({
    minutes,
    includesOptions: Boolean(includesOptions),
    priceWon: priceWon ?? null,
    status: "unused",
    startedAt: null,
    expiresAt: null,
    reason: reason?.trim() || null,
    grantedByUid: adminUid,
    grantedByEmail: adminUser.email ?? null,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ passId: passRef.id });
}
