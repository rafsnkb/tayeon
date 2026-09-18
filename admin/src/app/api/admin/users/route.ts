import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { getUserPage } from "@/lib/userDirectory";

/** 전체 사용자 목록 — 한 페이지 100명, 커서는 직전 마지막 UID. */
export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  try {
    return NextResponse.json(await getUserPage(cursor));
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CURSOR") {
      return NextResponse.json({ error: "유효하지 않은 페이지 커서입니다." }, { status: 400 });
    }
    console.error("[admin/users] 사용자 목록 조회 실패", error);
    return NextResponse.json({ error: "사용자 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

