import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { USERS, PAYMENTS, PAYMENT_ARCHIVE, REFUND_REQUESTS } from "@/lib/firestore/collections";
// 전자상거래법 시행령 제6조: 대금결제 기록 5년 보존 의무(같은 시행령 제5조의2가 개인정보
// 보호법 제21조 파기 원칙의 명시적 예외로 지정) — 탈퇴로 이 기록이 사라지면 안 된다.
// 반대로 5년이 지나면 실제로 파기돼야 해서, TTL이 읽을 수 있는 Timestamp로 만료 시각을 심는다.
import { PAYMENT_RECORD_RETENTION_MONTHS } from "@/lib/legal/retention";
import { retentionExpiresAt } from "@/lib/legal/retentionTimestamp";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);

  // 처리 중인 환불이 있으면 탈퇴를 막는다.
  //
  // refundRequests 는 최상위 컬렉션이라 recursiveDelete 에 지워지지 않고 남는데, 정작 환불을
  // 실행하는 쪽(admin/src/lib/refundExecute.ts)은 users/{uid}/payments/{paymentId} 를 읽어서
  // 판단한다. 그 문서가 사라지면 승인도 거절도 불가능해지고, 요청은 영원히 대기 상태로 남으며
  // 돌려줘야 할 돈이 돌아가지 못한다 — 운영자가 포트원 콘솔에서 손으로 취소하는 수밖에 없다
  // (2026-09-24). 자동 승인이 2영업일 안에 끝내주므로 기다리는 시간은 길지 않다.
  const pendingRefund = await adminDb
    .collection(REFUND_REQUESTS)
    .where("uid", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pendingRefund.empty) {
    return NextResponse.json(
      {
        error: "환불 처리 중에는 탈퇴할 수 없어요. 환불이 완료된 뒤에 다시 시도해주세요.",
        code: "REFUND_PENDING",
      },
      { status: 409 }
    );
  }

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
        retainUntil: retentionExpiresAt(issuedAt, PAYMENT_RECORD_RETENTION_MONTHS),
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
