import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { computeStatsSummary } from "@/lib/stats";

export async function GET(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const summary = await computeStatsSummary();
  return NextResponse.json(summary);
}
