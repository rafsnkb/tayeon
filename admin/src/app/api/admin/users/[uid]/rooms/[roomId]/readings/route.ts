import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

const CONTEXT_LIMIT = 20;

/** 검토 모달에서 무료처리/부정요청 리딩 하나를 볼 때, 판단에 필요한 같은 방의 이전 대화
 * 맥락(최대 CONTEXT_LIMIT건, 해당 리딩 이전분까지)을 함께 보여주기 위한 조회. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string; roomId: string }> }
) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid, roomId } = await params;
  const before = req.nextUrl.searchParams.get("before");

  let query = adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
    .doc(roomId)
    .collection("readings")
    .orderBy("createdAt", "desc");

  if (before) {
    query = query.where("createdAt", "<=", before);
  }

  const snap = await query.limit(CONTEXT_LIMIT).get();
  const readings = snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        readingId: doc.id,
        question: data.question ?? "",
        interpretation: data.interpretation ?? "",
        createdAt: data.createdAt ?? "",
        charged: data.charged !== false,
        flaggedForAbuse: data.flaggedForAbuse === true,
        spread: data.spread ?? null,
      };
    })
    .reverse();

  return NextResponse.json({ readings });
}
