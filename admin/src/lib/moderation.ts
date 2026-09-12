import { adminDb } from "@/lib/firebase/admin";

/** "상세히 보기"/일괄확인이 훑는 방마다의 최근 리딩 범위 — 검색 결과 카드의 지표(SIGNAL_PER_ROOM_LIMIT,
 * search/route.ts)보다 넓게 잡아서, 일괄확인이 상세 패널에 보이는 것과 동일한 범위를 커버하게 한다. */
export const DETAIL_PER_ROOM_LIMIT = 100;

export type FlaggedReading = {
  roomId: string;
  readingId: string;
  question: string;
  interpretation: string;
  createdAt: string;
  spread: string | null;
  roomTitle: string | null;
};

// Not an auto-detector — just surfaces NO_CHARGE_MARKER'd readings (injection attempts /
// off-topic requests) so an admin can judge whether a user should be suspended.
// Scoped to each room's most recent `perRoomLimit` readings rather than true all-time history,
// to avoid needing a Firestore composite index for a charged==false + orderBy(createdAt) query.
// Readings an admin has already reviewed (reviewedAt set) are excluded from both the count and
// the list — "확인처리" is how an admin clears a reading out of this signal (2026-09-12).
export async function scanReadings(uid: string, perRoomLimit: number) {
  const roomsSnap = await adminDb.collection("users").doc(uid).collection("rooms").get();

  let recentCount = 0;
  let noChargeCount = 0;
  const flagged: FlaggedReading[] = [];

  for (const room of roomsSnap.docs) {
    const readingsSnap = await room.ref
      .collection("readings")
      .orderBy("createdAt", "desc")
      .limit(perRoomLimit)
      .get();

    for (const doc of readingsSnap.docs) {
      const data = doc.data();
      recentCount += 1;
      if (data.charged === false && !data.reviewedAt) {
        noChargeCount += 1;
        flagged.push({
          roomId: room.id,
          readingId: doc.id,
          question: data.question ?? "",
          interpretation: data.interpretation ?? "",
          createdAt: data.createdAt ?? "",
          spread: data.spread ?? null,
          roomTitle: room.data()?.title ?? null,
        });
      }
    }
  }

  flagged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { recentCount, noChargeCount, flagged };
}

/** 무료처리 리딩 하나를 "확인함"으로 표시 — 이후 scanReadings 집계/목록에서 제외된다. */
export async function reviewReading(
  uid: string,
  roomId: string,
  readingId: string,
  byUid: string,
  byEmail: string | null
) {
  const ref = adminDb
    .collection("users")
    .doc(uid)
    .collection("rooms")
    .doc(roomId)
    .collection("readings")
    .doc(readingId);
  await ref.update({
    reviewedAt: new Date().toISOString(),
    reviewedByUid: byUid,
    reviewedByEmail: byEmail,
  });
}

/** 지금 시점에 플래그된 무료처리 리딩 전부를 한 번에 "확인함" 처리한다. */
export async function reviewAllFlagged(
  uid: string,
  perRoomLimit: number,
  byUid: string,
  byEmail: string | null
) {
  const { flagged } = await scanReadings(uid, perRoomLimit);
  const now = new Date().toISOString();
  const refs = flagged.map((f) =>
    adminDb
      .collection("users")
      .doc(uid)
      .collection("rooms")
      .doc(f.roomId)
      .collection("readings")
      .doc(f.readingId)
  );

  const CHUNK = 400; // Firestore batch write limit is 500 — leave headroom
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = adminDb.batch();
    for (const ref of refs.slice(i, i + CHUNK)) {
      batch.update(ref, { reviewedAt: now, reviewedByUid: byUid, reviewedByEmail: byEmail });
    }
    await batch.commit();
  }

  return { reviewedCount: refs.length };
}
