import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "대화방을 선택해주세요." }, { status: 400 });
  }

  const snap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
    .doc(roomId)
    .collection("readings")
    .orderBy("createdAt", "asc")
    .get();

  const readings = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      question: data.question,
      spread: data.spread,
      cards: data.cards,
      includeSaju: Boolean(data.includeSaju),
      includeZiwei: Boolean(data.includeZiwei),
      includeCompatibility: Boolean(data.includeCompatibility),
      partnerNickname: data.partnerNickname ?? null,
      interpretation: data.interpretation,
      charged: data.charged ?? true,
      guidanceOnly: Boolean(data.guidanceOnly),
      flaggedForAbuse: Boolean(data.flaggedForAbuse),
    };
  });

  return NextResponse.json({ readings });
}
