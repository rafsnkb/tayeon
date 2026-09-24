// ⚠ 자동 복사본 — 여기서 고치지 마세요.
//
// 원본: tawer/packages/reporter/src/send.ts (@tawer/reporter@1.0.0)
// 고칠 일이 있으면 타워에서 고치고 아래 명령으로 다시 복사합니다.
//   node scripts/sync-reporter.mjs C:/Works/tayeon/functions/src/tawer
//
// 여기서 직접 고치면 다음 복사 때 조용히 사라집니다.

// 전송. 재시도는 하되 **틀린 걸 고집하지는 않는다** — 400(계약 위반)과 401(키 문제)은
// 몇 번을 보내도 같은 답이 온다. 그런 건 바로 포기하고 로그를 남기는 게 맞다.

export type SendResult =
  | { ok: true; status: number; body: unknown; attempts: number }
  | { ok: false; status: number | null; error: string; attempts: number; retriable: boolean };

export type SendOptions = {
  endpoint: string;
  apiKey: string;
  maxAttempts?: number;
  /** 검사에서 시간을 흘려보내기 위한 구멍. 운영에서는 건드리지 않는다. */
  sleep?: (ms: number) => Promise<void>;
  fetchImpl?: typeof fetch;
};

/** 다시 보내서 달라질 수 있는 실패인가. */
export function isRetriable(status: number | null): boolean {
  if (status === null) return true; // 네트워크 실패 — 다음엔 될 수 있다
  if (status === 429) return true;
  return status >= 500;
}

export async function sendReport(payload: unknown, opts: SendOptions): Promise<SendResult> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const doFetch = opts.fetchImpl ?? fetch;

  let attempts = 0;
  let last: SendResult = { ok: false, status: null, error: "시도 없음", attempts: 0, retriable: false };

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await doFetch(opts.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) return { ok: true, status: res.status, body, attempts };
      const retriable = isRetriable(res.status);
      last = { ok: false, status: res.status, error: describe(body) ?? `HTTP ${res.status}`, attempts, retriable };
      if (!retriable) return last;
    } catch (err) {
      last = { ok: false, status: null, error: err instanceof Error ? err.message : String(err), attempts, retriable: true };
    }
    if (attempts < maxAttempts) await sleep(backoffMs(attempts));
  }
  return last;
}

/** 1초, 2초, 4초… 8초에서 멈춘다. 지수적으로 늘리되 한도를 둔다. */
export function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function describe(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { error?: unknown; details?: unknown };
  const parts: string[] = [];
  if (typeof b.error === "string") parts.push(b.error);
  if (Array.isArray(b.details)) parts.push(b.details.map(String).join("; "));
  return parts.length > 0 ? parts.join(" — ") : null;
}
