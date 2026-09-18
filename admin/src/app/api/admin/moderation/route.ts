import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

const FREE_READING_LIMIT = 100;

function uidFromReadingPath(path: string): string | null {
  const parts = path.split("/");
  return parts[0] === "users" && parts[2] === "rooms" && parts[4] === "readings" ? parts[1] : null;
}

/**
 * 무료 처리 내역과 실제 부정 요청 탐지(flaggedForAbuse)를 분리한다.
 * charged:false에는 모델 안전 응답/안내도 포함되므로, 정지 후보에는 flaggedForAbuse만 사용한다.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const [freeSnap, abuseSnap] = await Promise.all([
      adminDb
        .collectionGroup("readings")
        .where("charged", "==", false)
        .orderBy("createdAt", "desc")
        .limit(FREE_READING_LIMIT)
        .get(),
      adminDb.collectionGroup("readings").where("flaggedForAbuse", "==", true).orderBy("createdAt", "desc").get(),
    ]);

    const uidSet = new Set<string>();
    for (const reading of [...freeSnap.docs, ...abuseSnap.docs]) {
      const uid = uidFromReadingPath(reading.ref.path);
      if (uid) uidSet.add(uid);
    }
    const userRefs = Array.from(uidSet, (uid) => adminDb.collection("users").doc(uid));
    const userSnaps = userRefs.length > 0 ? await adminDb.getAll(...userRefs) : [];
    const nicknameByUid = new Map(userSnaps.map((user) => [user.id, user.data()?.nickname ?? null]));

    // 확인 처리된 내역은 재검토 목록과 정지 후보 집계에서 제외한다. Firestore의
    // `== null` 필터는 필드가 없는 기존 문서를 놓칠 수 있으므로 응답 직전에 판별한다.
    const unresolvedFreeDocs = freeSnap.docs.filter((reading) => !reading.data().reviewedAt);
    const unresolvedAbuseDocs = abuseSnap.docs.filter((reading) => !reading.data().reviewedAt);

    const freeReadings = unresolvedFreeDocs.map((reading) => {
      const data = reading.data();
      const uid = uidFromReadingPath(reading.ref.path) ?? "";
      return {
        uid,
        nickname: nicknameByUid.get(uid) ?? null,
        id: reading.id,
        roomId: reading.ref.parent.parent?.id ?? null,
        question: data.question ?? "",
        interpretation: data.interpretation ?? "",
        createdAt: data.createdAt ?? "",
        flaggedForAbuse: data.flaggedForAbuse === true,
        guidanceOnly: data.guidanceOnly === true,
        topic: data.topic ?? null,
      };
    });

    const abuseByUid = new Map<string, { count: number; latestAt: string; latestQuestion: string }>();
    for (const reading of unresolvedAbuseDocs) {
      const uid = uidFromReadingPath(reading.ref.path);
      if (!uid) continue;
      const current = abuseByUid.get(uid);
      const data = reading.data();
      abuseByUid.set(uid, {
        count: (current?.count ?? 0) + 1,
        latestAt: current?.latestAt || data.createdAt || "",
        latestQuestion: current?.latestQuestion || data.question || "",
      });
    }
    const abuseUsers = Array.from(abuseByUid.entries())
      .filter(([, signal]) => signal.count >= 3)
      .sort(([, a], [, b]) => b.count - a.count || b.latestAt.localeCompare(a.latestAt))
      .map(([uid, signal]) => ({ uid, nickname: nicknameByUid.get(uid) ?? null, ...signal }));

    return NextResponse.json({ freeReadings, abuseUsers });
  } catch (error) {
    console.error("[admin/moderation] 조회 실패", error);
    return NextResponse.json({ error: "모더레이션 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
