// 읽던 위치 저장(§6 미해결 ③). 리포트가 최대 21장이라 한 번에 다 읽지 않는다 —
// 다시 들어왔을 때 덮던 자리에서 이어져야 한다.
//
// 이 라우트는 **실패해도 조용히 넘어가도 되는** 유일한 자리다. 위치 기록이 안 됐다고 읽기를
// 막으면 손해가 더 크다. 그래서 화면은 응답을 기다리지 않고 쏘기만 하면 된다.
import { NextRequest, NextResponse } from "next/server";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { getSajuReading, updateLastReadPage } from "@/lib/saju/storage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { pageNumber?: unknown };
  const pageNumber = Number(body.pageNumber);

  // 0 은 목차 페이지라 유효한 값이다. 상한은 섹션 수 + 이미지 + 총평이라 굳이 여기서 세지
  // 않고, **음수와 정수 아님만** 막는다 — 이 값은 화면 이동의 기록일 뿐이라 틀려도
  // 다음 이동이 덮어쓴다.
  if (!Number.isInteger(pageNumber) || pageNumber < 0) {
    return NextResponse.json({ error: "bad_page" }, { status: 400 });
  }

  // `update` 는 문서가 없으면 던진다. 없는 리포트에 위치를 기록하려는 건 화면의 버그이므로
  // 500 으로 삼키지 말고 404 로 보이게 한다.
  const reading = await getSajuReading(uid, id);
  if (!reading) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await updateLastReadPage(uid, id, pageNumber);
  return NextResponse.json({ lastReadPage: pageNumber });
}
