import { adminDb } from "@/lib/firebase/admin";

export type FlaggedReading = {
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
      if (data.charged === false) {
        noChargeCount += 1;
        flagged.push({
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
