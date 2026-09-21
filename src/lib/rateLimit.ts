// 고정 윈도우(fixed window) 방식의 범용 요청 제한.
//
// 리딩 라우트(src/app/api/tarot/reading/route.ts)가 users/{uid} 문서 안에 직접 카운터를 두고
// 같은 방식으로 자체 구현하고 있는데, 그쪽은 동시요청 락과 한 트랜잭션으로 묶여 있어 분리하지
// 않았다. 여기는 그 외의 엔드포인트(고객센터 문의 등)가 쓰는 독립 카운터다.
//
// 고정 윈도우라 윈도우 경계에서 이론상 최대 2배까지 몰릴 수 있지만, 목적이 정확한 쿼터 집행이
// 아니라 "무제한 남용을 막는 것"이라 충분하다.
import { adminDb } from "@/lib/firebase/admin";
import type { NextRequest } from "next/server";

/** 카운터 문서가 모이는 최상위 컬렉션. 문서 ID가 곧 제한 대상 키다. */
const RATE_LIMITS = "rateLimits";

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * @param key 제한 대상 식별자. 서로 다른 용도가 섞이지 않게 `용도:대상` 형태로 넘긴다.
 * @param limit 윈도우당 허용 횟수
 * @param windowMs 윈도우 길이(ms)
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  // 문서 ID에 "/"가 들어가면 경로가 깨지고, IP나 UID가 그대로 노출될 필요도 없다.
  const docId = encodeURIComponent(key).replace(/%/g, "_");
  const ref = adminDb.collection(RATE_LIMITS).doc(docId);

  return adminDb.runTransaction(async (tx): Promise<RateLimitResult> => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data();
    const windowStart = typeof data?.windowStart === "number" ? data.windowStart : 0;
    const count = typeof data?.count === "number" ? data.count : 0;
    const expired = now - windowStart >= windowMs;

    if (!expired && count >= limit) {
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)) };
    }

    tx.set(ref, {
      windowStart: expired ? now : windowStart,
      count: expired ? 1 : count + 1,
      // 윈도우가 끝나면 문서를 남겨둘 이유가 없다. Firestore TTL 정책(expiresAt)으로 정리한다.
      expiresAt: new Date(now + windowMs * 2),
    });
    return { ok: true };
  });
}

/**
 * 프록시(App Hosting) 뒤에 있으므로 x-forwarded-for의 첫 번째 주소가 클라이언트 IP다.
 * 헤더는 위조될 수 있어서 인증 대용으로는 쓸 수 없고, 남용 완화 용도로만 쓴다.
 */
export function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || null;
}
