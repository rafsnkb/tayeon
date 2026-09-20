import { adminAuth, adminDb } from "@/lib/firebase/admin";

/** 운영자가 지급한("admin-grant") 미사용 이용권만 회수할 수 있다 — 구매분/이미 쓴 이용권은
 * 대상이 아니다(구매분 환불은 refund-payment 라우트를 통해 별도로 처리). */
export async function revokeGrantedPass(
  uid: string,
  collection: "countPasses" | "timePasses",
  passId: string,
  adminUid: string,
  reason: string
): Promise<{ error: string; status: number } | null> {
  const passRef = adminDb.collection("users").doc(uid).collection(collection).doc(passId);
  const passSnap = await passRef.get();
  if (!passSnap.exists) return { error: "존재하지 않는 이용권입니다.", status: 404 };

  const pass = passSnap.data()!;
  if (pass.source !== "admin-grant") return { error: "운영자가 지급한 이용권만 회수할 수 있어요.", status: 409 };
  if (pass.status !== "unused") return { error: "미사용 이용권만 회수할 수 있어요.", status: 409 };

  const adminUser = await adminAuth.getUser(adminUid);
  await passRef.update({
    status: "revoked",
    revokedAt: new Date().toISOString(),
    revokedByUid: adminUid,
    revokedByEmail: adminUser.email ?? null,
    revokeReason: reason.trim().slice(0, 200),
  });

  return null;
}
