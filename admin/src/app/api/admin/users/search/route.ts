import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { scanReadings } from "@/lib/moderation";
import type { DocumentSnapshot } from "firebase-admin/firestore";

const SIGNAL_PER_ROOM_LIMIT = 20;

function toResult(snap: DocumentSnapshot) {
  const data = snap.data();
  if (!data) return null;
  return {
    uid: snap.id,
    nickname: data.nickname ?? null,
    coins: data.coins ?? 0,
    provider: data.provider ?? null,
    kakaoId: data.kakaoId ?? null,
    termsAgreedAt: data.termsAgreedAt ?? null,
    suspended: Boolean(data.suspended),
    suspendedReason: data.suspendedReason ?? null,
  };
}

export async function GET(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "검색어를 입력해주세요." }, { status: 400 });
  }

  const results = new Map<string, NonNullable<ReturnType<typeof toResult>>>();

  const byUid = await adminDb.collection("users").doc(q).get();
  const byUidResult = toResult(byUid);
  if (byUidResult) results.set(byUidResult.uid, byUidResult);

  const byNickname = await adminDb
    .collection("users")
    .where("nickname", "==", q)
    .limit(20)
    .get();
  for (const doc of byNickname.docs) {
    const result = toResult(doc);
    if (result) results.set(result.uid, result);
  }

  const users = await Promise.all(
    Array.from(results.values()).map(async (user) => {
      const { recentCount, noChargeCount, flagged } = await scanReadings(
        user.uid,
        SIGNAL_PER_ROOM_LIMIT
      );
      return {
        ...user,
        moderation: { recentCount, noChargeCount, recentFlagged: flagged.slice(0, 3) },
      };
    })
  );

  return NextResponse.json({ users });
}
