import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

export async function GET(req: NextRequest) {
  const uid = await getAdminUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ uid });
}
