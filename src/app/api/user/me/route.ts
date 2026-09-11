import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { DEFAULT_TONE } from "@/lib/tarot/tone";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data();

  let activeTimePass = data?.activeTimePass as
    | { passId: string; minutes: number; includesOptions: boolean; startedAt: string; expiresAt: string }
    | null
    | undefined;
  if (activeTimePass && new Date(activeTimePass.expiresAt).getTime() <= Date.now()) {
    // Lazy cleanup: the pass ran out since it was started. This is display bookkeeping only —
    // /api/tarot/reading independently re-checks expiresAt against "now" on every request, so
    // billing correctness never depends on this write actually happening.
    await Promise.all([
      userRef.update({ activeTimePass: null }),
      userRef.collection("timePasses").doc(activeTimePass.passId).update({ status: "expired" }),
    ]);
    activeTimePass = null;
  }

  const timePassesSnap = await userRef
    .collection("timePasses")
    .where("status", "==", "unused")
    .get();
  const timePasses = timePassesSnap.docs.map((doc) => ({
    id: doc.id,
    minutes: doc.data().minutes,
    includesOptions: doc.data().includesOptions,
  }));

  return NextResponse.json({
    nickname: data?.nickname ?? null,
    termsAgreedAt: data?.termsAgreedAt ?? null,
    coins: data?.coins ?? 0,
    tone: data?.tone ?? DEFAULT_TONE,
    useReversedCards: data?.useReversedCards ?? true,
    birthInfo: data?.birthInfo ?? null,
    partner: data?.partner ?? null,
    activeTimePass: activeTimePass ?? null,
    timePasses,
  });
}
