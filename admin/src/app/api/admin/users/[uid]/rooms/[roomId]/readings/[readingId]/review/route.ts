import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { reviewReading } from "@/lib/moderation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; roomId: string; readingId: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid, roomId, readingId } = await params;
  const adminUser = await adminAuth.getUser(adminUid);
  await reviewReading(uid, roomId, readingId, adminUid, adminUser.email ?? null);

  return NextResponse.json({ ok: true });
}
