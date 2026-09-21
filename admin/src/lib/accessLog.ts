// 보관 데이터 열람 감사 로그.
//
// 탈퇴자 결제기록(paymentArchive)과 고객센터 문의(supportInquiries)는 "본인이 지워달라고 한
// 개인정보를 법령상 의무 때문에 남겨둔 것"이라, 개인정보처리방침 제3조가 이를 "계정과 분리하여
// 보관"한다고 약속하고 있다. 분리 보관이라고 해놓고 누가 언제 열람했는지 아무 기록이 없으면
// 그 약속이 사실상 비어 있게 되므로, 조회 자체를 남긴다.
//
// 로그는 최상위 adminAccessLogs 컬렉션에 쌓이며, 운영자가 지울 수 없도록 어드민 UI에서 삭제
// 경로를 제공하지 않는다(Firestore 규칙이 클라이언트 접근을 전면 차단하고 있어 서버 경유만 가능).
import { adminDb } from "@/lib/firebase/admin";

const ADMIN_ACCESS_LOGS = "adminAccessLogs";

export type AccessTarget = "paymentArchive" | "supportInquiries";

/**
 * @param adminUid 조회한 관리자 UID
 * @param target 열람한 보관 데이터 종류
 * @param detail 조회 조건(검색어·페이지 등)과 반환 건수 — 무엇을 봤는지 재구성할 수 있을 정도만.
 */
export async function logRetainedDataAccess(
  adminUid: string,
  target: AccessTarget,
  detail: { query?: string | null; resultCount: number }
): Promise<void> {
  await adminDb.collection(ADMIN_ACCESS_LOGS).add({
    adminUid,
    target,
    query: detail.query ?? null,
    resultCount: detail.resultCount,
    accessedAt: new Date().toISOString(),
  });
}
