import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { revokeGrantedPass } from "@/lib/revokePass";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; passId: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid, passId } = await params;
  const { reason, force } = (await req.json().catch(() => ({}))) as {
    reason?: string;
    /** 사용중인 이용권까지 거둬들인다. 운영자가 화면에서 한 번 더 확인한 경우에만 true. */
    force?: boolean;
  };
  if (!reason?.trim()) return NextResponse.json({ error: "회수 사유를 입력해주세요." }, { status: 400 });

  const failure = await revokeGrantedPass(uid, "timePasses", passId, adminUid, reason, force === true);
  if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });

  return NextResponse.json({ ok: true });
}
