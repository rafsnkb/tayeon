import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { SPREADS, type SpreadKey } from "@/lib/tarot/pricing";
import { USERS, ROOMS, READINGS } from "@/lib/firestore/collections";

const USAGE_HISTORY_ROOM_SCAN_LIMIT = 30;
const READINGS_PER_ROOM = 20;
const ENTRY_LIMIT = 50;

type UsageEntry = {
  kind: "usage";
  roomTitle: string;
  spread: SpreadKey;
  spreadLabel: string;
  includeSaju: boolean;
  includeZiwei: boolean;
  includeCompatibility: boolean;
  cost: number;
  timePassApplied: boolean;
  countPassApplied: boolean;
  createdAt: string;
};

/** 피그마 "Screen / UsingHistory"("이용 내역") — 리딩에 실제로 소모된 이용권/코인 내역만 보여준다.
 * 받은(지급된) 이용권 이력은 "받은 이용권 내역"(/received-passes)으로 완전히 이동했다(2026-09-18,
 * 마이페이지 메뉴가 "코인·이용권 구입"/"결제 내역"/"받은 이용권 내역" 3행으로 정리되면서 이 화면은
 * 더 이상 메뉴에서 직접 연결되진 않지만, 순수 이용 내역 조회 자체는 계속 유효해 라우트는 남겨둠).
 * 유저→방→리딩 순회는 admin의 scanReadings와 같은 이유로(커스텀 인덱스 없음) collectionGroup+where
 * 대신 이 방식을 씀. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const roomsSnap = await userRef
    .collection(ROOMS)
    .orderBy("updatedAt", "desc")
    .limit(USAGE_HISTORY_ROOM_SCAN_LIMIT)
    .get();

  const entries: UsageEntry[] = [];
  for (const room of roomsSnap.docs) {
    const readingsSnap = await room.ref
      .collection(READINGS)
      .orderBy("createdAt", "desc")
      .limit(READINGS_PER_ROOM)
      .get();
    for (const doc of readingsSnap.docs) {
      const data = doc.data();
      if (!data.charged) continue;
      entries.push({
        kind: "usage",
        roomTitle: room.data()?.title ?? "새 대화",
        spread: data.spread,
        spreadLabel: SPREADS[data.spread as SpreadKey]?.label ?? data.spread,
        includeSaju: Boolean(data.includeSaju),
        includeZiwei: Boolean(data.includeZiwei),
        includeCompatibility: Boolean(data.includeCompatibility),
        cost: data.cost ?? 0,
        timePassApplied: Boolean(data.timePassApplied),
        countPassApplied: Boolean(data.countPassId),
        createdAt: data.createdAt,
      });
    }
  }

  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ entries: entries.slice(0, ENTRY_LIMIT) });
}
