import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, PAYMENTS, PAYMENT_ARCHIVE } from "@/lib/firestore/collections";
import { addMonthsClamped } from "@/lib/util/dateMath";

// 전자상거래법 시행령 제6조: 대금결제 기록 5년 보존 의무(같은 시행령 제5조의2가 개인정보
// 보호법 제21조 파기 원칙의 명시적 예외로 지정) — 탈퇴로 이 기록이 사라지면 안 된다.
const PAYMENT_RECORD_RETENTION_MONTHS = 60;

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);

  // recursiveDelete가 users/{uid}/payments 서브컬렉션까지 통째로 지우기 전에, 결제 기록을
  // 유저 문서 트리 밖의 최상위 아카이브 컬렉션으로 먼저 복사해 둔다. 탈퇴 안 한 살아있는
  // 계정 기준 조회(purchase-history/refund-requests/bonus-reward 등)는 지금처럼
  // users/{uid}/payments를 그대로 원본으로 쓴다 — 이 아카이브는 탈퇴 이후 보존용.
  const paymentsSnap = await userRef.collection(PAYMENTS).get();
  if (!paymentsSnap.empty) {
    const archivedAt = new Date().toISOString();
    const batch = adminDb.batch();
    for (const doc of paymentsSnap.docs) {
      const data = doc.data();
      const issuedAt = typeof data.paidAt === "string" ? data.paidAt : archivedAt;
      batch.set(adminDb.collection(PAYMENT_ARCHIVE).doc(doc.id), {
        ...data,
        uid,
        archivedAt,
        retainUntil: addMonthsClamped(issuedAt, PAYMENT_RECORD_RETENTION_MONTHS),
      });
    }
    await batch.commit();
  }

  // doc.delete()는 서브컬렉션(rooms/readings, coinGrants, suspensionLog, timePasses)을
  // 지우지 않으므로 recursiveDelete로 전부 함께 삭제한다.
  await adminDb.recursiveDelete(userRef);
  await adminAuth.deleteUser(uid);

  return NextResponse.json({ ok: true });
}
