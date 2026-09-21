import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { logRetainedDataAccess, type AccessTarget } from "@/lib/accessLog";

const LIMIT = 100;

/** Firestore Timestamp / ISO 문자열 / 없음을 모두 ISO 문자열로 통일한다. */
function toIso(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/**
 * GET /api/admin/retained-data?target=paymentArchive|supportInquiries
 *
 * 법령상 보관 의무 때문에 탈퇴 후에도 남겨둔 기록을 조회한다. 조회할 때마다 감사 로그를 남긴다
 * (admin/src/lib/accessLog.ts 참고).
 */
export async function GET(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const target = req.nextUrl.searchParams.get("target") as AccessTarget | null;
  if (target !== "paymentArchive" && target !== "supportInquiries") {
    return NextResponse.json({ error: "target이 올바르지 않아요." }, { status: 400 });
  }

  const orderField = target === "paymentArchive" ? "archivedAt" : "createdAt";
  const snapshot = await adminDb.collection(target).orderBy(orderField, "desc").limit(LIMIT).get();

  const items = snapshot.docs.map((doc) => {
    const d = doc.data();
    if (target === "paymentArchive") {
      return {
        id: doc.id,
        uid: d.uid ?? null,
        orderName: d.orderName ?? null,
        priceWon: d.priceWon ?? null,
        status: d.status ?? null,
        paidAt: toIso(d.paidAt),
        archivedAt: toIso(d.archivedAt),
        retainUntil: toIso(d.retainUntil),
      };
    }
    return {
      id: doc.id,
      uid: d.uid ?? null,
      nickname: d.nickname ?? null,
      email: d.email ?? null,
      content: typeof d.content === "string" ? d.content : "",
      status: d.status ?? null,
      emailDeliveryStatus: d.emailDeliveryStatus ?? null,
      createdAt: toIso(d.createdAt),
      expiresAt: toIso(d.expiresAt),
    };
  });

  await logRetainedDataAccess(adminUid, target, { resultCount: items.length });

  return NextResponse.json({ items, limit: LIMIT });
}
