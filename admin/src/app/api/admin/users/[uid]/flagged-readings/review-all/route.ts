import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { reviewAllFlagged, DETAIL_PER_ROOM_LIMIT } from "@/lib/moderation";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const adminUser = await adminAuth.getUser(adminUid);
  const { reviewedCount } = await reviewAllFlagged(
    uid,
    DETAIL_PER_ROOM_LIMIT,
    adminUid,
    adminUser.email ?? null
  );

  return NextResponse.json({ reviewedCount });
}
