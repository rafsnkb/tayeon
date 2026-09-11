import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { FREE_SIGNUP_COINS } from "@/lib/tarot/pricing";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { nickname } = (await req.json()) as { nickname?: string };
  const trimmed = nickname?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "닉네임을 입력해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const existing = await userRef.get();
  const alreadySignedUp = Boolean(existing.data()?.termsAgreedAt);

  await userRef.set(
    {
      nickname: trimmed,
      termsAgreedAt: new Date().toISOString(),
      ...(alreadySignedUp ? {} : { coins: FREE_SIGNUP_COINS }),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
