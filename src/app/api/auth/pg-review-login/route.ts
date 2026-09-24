import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { USERS, LOGIN_ATTEMPTS } from "@/lib/firestore/collections";

// KG이니시스 전자계약 사전점검의 "비회원 구매 가능 여부"(회원가입 필수 → 테스트 ID/PW 요구)
// 항목 대응. 타연은 카카오 로그인만 있어서 심사자가 쓸 수 있는 ID/PW 로그인이 없었음 — 새
// 회원가입 시스템을 만드는 대신, 정확히 이 하나의 고정 계정에만 동작하는 좁은 통로 하나만
// 추가한다(PG_REVIEW_TEST_ID/PASSWORD, .env.local). 일치하지 않으면 아이디/비번 중 뭐가 틀렸는지
// 구분해서 알려주지 않는다(계정 존재 여부를 흘리지 않기 위함).
const TEST_UID = "pgreview:tayeon";

// 서비스 전체에서 유일한 아이디/비밀번호 통로라, 시도 제한이 없으면 고정 자격증명 하나를
// 무제한으로 대입할 수 있었다(2026-09-24). 심사자는 몇 번이면 들어오므로 넉넉잡아 이 정도면
// 정상 사용을 막지 않는다.
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

/** 요청자 식별 키. 원본 IP는 저장하지 않고 해시만 문서 id로 쓴다(개인정보 최소수집).
 *  NextRequest.ip 는 Next 15에서 제거돼서 프록시 헤더를 직접 읽는다 — App Hosting(Cloud Run)은
 *  로드밸런서가 x-forwarded-for 를 채워준다. 헤더가 없으면 한 바구니로 묶여 전체가 같은
 *  한도를 나눠 쓰는데, 이 엔드포인트는 심사자 한 명만 쓰므로 그래도 무방하다. */
function attemptKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/** 길이가 다르면 timingSafeEqual 이 던지기 때문에, 양쪽을 먼저 고정 길이로 해시한 뒤 비교한다.
 *  === 는 첫 불일치 문자에서 빠져나와 비교 시간이 정답 접두사 길이에 비례한다. */
function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
}

type AttemptVerdict = { blocked: true; retryAfterSeconds: number } | { blocked: false };

/** 시도 횟수를 세고 한도를 넘었는지 판정한다. 비밀번호를 맞히기 **전에** 올려야 실패한 시도가
 *  집계된다(성공하면 아래에서 지운다). 읽기-쓰기를 트랜잭션으로 묶어 동시 요청이 한도를
 *  넘겨 통과하는 것을 막는다. */
async function countAttempt(req: NextRequest): Promise<AttemptVerdict> {
  const ref = adminDb.collection(LOGIN_ATTEMPTS).doc(attemptKey(req));
  const now = Date.now();
  return adminDb.runTransaction(async (tx): Promise<AttemptVerdict> => {
    const data = (await tx.get(ref)).data();
    const windowStart = Date.parse(data?.windowStart ?? "");
    const expired = !Number.isFinite(windowStart) || now - windowStart >= ATTEMPT_WINDOW_MS;
    const count = expired ? 0 : Number(data?.count ?? 0);
    if (count >= MAX_ATTEMPTS_PER_WINDOW) {
      return {
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((windowStart + ATTEMPT_WINDOW_MS - now) / 1000)),
      };
    }
    const startedAt = expired ? now : windowStart;
    tx.set(ref, {
      windowStart: new Date(startedAt).toISOString(),
      count: count + 1,
      // TTL 정책이 읽을 수 있도록 Timestamp 로 심는다(문자열이면 아무것도 지워지지 않는다 —
      // src/lib/legal/retentionTimestamp.ts 주석 참고).
      expiresAt: Timestamp.fromDate(new Date(startedAt + ATTEMPT_WINDOW_MS)),
    });
    return { blocked: false };
  });
}

export async function POST(req: NextRequest) {
  const testId = process.env.PG_REVIEW_TEST_ID;
  const testPassword = process.env.PG_REVIEW_TEST_PASSWORD;
  if (!testId || !testPassword) {
    return NextResponse.json({ error: "심사용 로그인이 설정되지 않았어요." }, { status: 503 });
  }

  const attempt = await countAttempt(req);
  if (attempt.blocked) {
    return NextResponse.json(
      { error: "로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } }
    );
  }

  const { id, password } = (await req.json().catch(() => ({}))) as { id?: string; password?: string };
  const matched =
    typeof id === "string" &&
    typeof password === "string" &&
    constantTimeEquals(id, testId) &&
    constantTimeEquals(password, testPassword);
  if (!matched) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 일치하지 않아요." }, { status: 401 });
  }

  // 정상 로그인했으면 그 통로의 카운터를 비워서, 심사자가 반복 로그인하다 스스로 막히지 않게 한다.
  await adminDb.collection(LOGIN_ATTEMPTS).doc(attemptKey(req)).delete().catch(() => {});

  const userRef = adminDb.collection(USERS).doc(TEST_UID);
  const existing = await userRef.get();
  if (!existing.exists) {
    await userRef.set({
      nickname: "심사용계정",
      provider: "pg-review",
      termsAgreedAt: new Date().toISOString(),
      coins: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const token = await adminAuth.createCustomToken(TEST_UID);
  return NextResponse.json({ token });
}
