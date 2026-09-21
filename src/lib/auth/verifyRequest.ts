import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export async function getUidFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    // checkRevoked: 탈퇴(deleteUser)나 강제 로그아웃으로 무효화된 계정의 기존 ID 토큰이
    // 만료 전까지(최대 1시간) 계속 통과하는 걸 막는다. Firebase Auth를 한 번 더 조회하는
    // 비용이 들지만, 탈퇴 직후 남은 토큰으로 API를 계속 쓸 수 있는 편이 더 위험하다.
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    return null;
  }
}
