import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { SPREADS, type SpreadKey } from "@/lib/tarot/pricing";

const ROOM_LIMIT = 30;
const READINGS_PER_ROOM = 20;

/** 피그마 "Screen / UsingHistory" — 결제 내역과 달리 이건 실제 데이터(리딩 기록)로 만들 수 있어서
 * (포트원 결제 내역과 달리) 진짜로 구현함. 유저→방→리딩 순회는 admin의 scanReadings와 같은 이유로
 * (커스텀 인덱스 없음) collectionGroup+where 대신 이 방식을 씀. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const roomsSnap = await adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
    .orderBy("updatedAt", "desc")
    .limit(ROOM_LIMIT)
    .get();

  const entries: {
    roomTitle: string;
    spread: SpreadKey;
    spreadLabel: string;
    includeSaju: boolean;
    includeZiwei: boolean;
    includeCompatibility: boolean;
    cost: number;
    timePassApplied: boolean;
    createdAt: string;
  }[] = [];

  for (const room of roomsSnap.docs) {
    const readingsSnap = await room.ref
      .collection("readings")
      .orderBy("createdAt", "desc")
      .limit(READINGS_PER_ROOM)
      .get();
    for (const doc of readingsSnap.docs) {
      const data = doc.data();
      if (!data.charged) continue;
      entries.push({
        roomTitle: room.data()?.title ?? "새 대화",
        spread: data.spread,
        spreadLabel: SPREADS[data.spread as SpreadKey]?.label ?? data.spread,
        includeSaju: Boolean(data.includeSaju),
        includeZiwei: Boolean(data.includeZiwei),
        includeCompatibility: Boolean(data.includeCompatibility),
        cost: data.cost ?? 0,
        timePassApplied: Boolean(data.timePassApplied),
        createdAt: data.createdAt,
      });
    }
  }

  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ entries: entries.slice(0, 50) });
}
