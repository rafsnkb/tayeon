import { NextRequest, NextResponse } from "next/server";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { getUserPage, searchUsers } from "@/lib/userDirectory";

/** 전체 사용자 목록 — 한 페이지 100명, 커서는 직전 마지막 UID.
 * q가 있으면 UID/닉네임 정확 일치 검색 결과를 대신 반환한다(페이지네이션 없음). */
export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (q) {
    try {
      return NextResponse.json({ users: await searchUsers(q), nextCursor: null });
    } catch (error) {
      console.error("[admin/users] 사용자 검색 실패", error);
      return NextResponse.json({ error: "검색에 실패했습니다." }, { status: 500 });
    }
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

