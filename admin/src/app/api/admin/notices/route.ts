import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

const TITLE_MAX_LENGTH = 100;
const BODY_MAX_LENGTH = 10_000;

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snapshot = await adminDb.collection("notices").orderBy("createdAt", "desc").limit(30).get();
  return NextResponse.json({
    notices: snapshot.docs.map((notice) => {
      const data = notice.data();
      return { id: notice.id, title: data.title ?? "", body: data.body ?? "", createdAt: data.createdAt ?? "" };
    }),
  });
}

export async function POST(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { title, body } = (await req.json().catch(() => ({}))) as { title?: unknown; body?: unknown };
  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedBody = typeof body === "string" ? body.trim() : "";
  if (!trimmedTitle || !trimmedBody) {
    return NextResponse.json({ error: "제목과 본문을 모두 입력해주세요." }, { status: 400 });
  }
  if (trimmedTitle.length > TITLE_MAX_LENGTH || trimmedBody.length > BODY_MAX_LENGTH) {
    return NextResponse.json({ error: `제목은 ${TITLE_MAX_LENGTH}자, 본문은 ${BODY_MAX_LENGTH.toLocaleString("ko-KR")}자 이하여야 합니다.` }, { status: 400 });
  }

  const createdAt = new Date().toISOString();
  const ref = await adminDb.collection("notices").add({
    title: trimmedTitle,
    body: trimmedBody,
    status: "published",
    createdAt,
    updatedAt: createdAt,
    createdByUid: adminUid,
  });
  return NextResponse.json({ id: ref.id, title: trimmedTitle, body: trimmedBody, createdAt }, { status: 201 });
}

