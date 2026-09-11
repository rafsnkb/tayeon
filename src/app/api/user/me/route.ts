import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { DEFAULT_TONE } from "@/lib/tarot/tone";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const snap = await adminDb.collection("users").doc(uid).get();
  const data = snap.data();

  return NextResponse.json({
    nickname: data?.nickname ?? null,
    termsAgreedAt: data?.termsAgreedAt ?? null,
    coins: data?.coins ?? 0,
    tone: data?.tone ?? DEFAULT_TONE,
    useReversedCards: data?.useReversedCards ?? true,
    birthInfo: data?.birthInfo ?? null,
    partner: data?.partner ?? null,
  });
}
