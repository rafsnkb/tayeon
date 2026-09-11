import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { scanReadings } from "@/lib/moderation";

const DETAIL_PER_ROOM_LIMIT = 100;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const { recentCount, noChargeCount, flagged } = await scanReadings(
    uid,
    DETAIL_PER_ROOM_LIMIT
  );

  return NextResponse.json({
    recentCount,
    noChargeCount,
    perRoomLimit: DETAIL_PER_ROOM_LIMIT,
    flagged,
  });
}
