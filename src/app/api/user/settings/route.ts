import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { isToneKey } from "@/lib/tarot/tone";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { tone, useReversedCards } = (await req.json()) as {
    tone?: string;
    useReversedCards?: boolean;
  };

  const update: Record<string, unknown> = {};
  if (isToneKey(tone)) update.tone = tone;
  if (typeof useReversedCards === "boolean") update.useReversedCards = useReversedCards;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "변경할 값이 없어요." }, { status: 400 });
  }

  await adminDb.collection("users").doc(uid).set(update, { merge: true });

  return NextResponse.json({ ok: true });
}
