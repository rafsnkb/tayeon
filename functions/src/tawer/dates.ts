// ⚠ 자동 복사본 — 여기서 고치지 마세요.
//
// 원본: tawer/packages/reporter/src/dates.ts (@tawer/reporter@1.0.0)
// 고칠 일이 있으면 타워에서 고치고 아래 명령으로 다시 복사합니다.
//   node scripts/sync-reporter.mjs C:/Works/tayeon/functions/src/tawer
//
// 여기서 직접 고치면 다음 복사 때 조용히 사라집니다.

// KST 달력 날짜 경계. 타워 계약(§4)의 date는 전부 KST 기준이다.
//
// 서버는 UTC로 돈다. new Date()의 getMonth()/getDate()를 그대로 쓰면 한국 시간
// 오전 0~9시 사이에 하루 전 날짜가 나온다. 타연 monthlyReferralPayout 주석에
// 같은 함정이 이미 기록돼 있다 — 거기서 쓴 방법 하나만 여기서도 쓴다:
// **+9시간 한 뒤 UTC 필드를 읽는다.** 다른 방법을 섞지 않는다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** 순간 → KST 달력 날짜("YYYY-MM-DD"). */
export function toKstDate(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) throw new Error(`날짜로 읽을 수 없는 값: ${String(instant)}`);
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}`;
}

/**
 * KST 달력 하루의 경계를 UTC 순간으로. [startIso, endIso) 반개구간이다.
 * 끝을 포함하면 자정에 찍힌 결제가 이틀에 들어가 합계가 어긋난다.
 */
export function kstDayRange(date: string): { startIso: string; endIso: string } {
  if (!DATE_RE.test(date)) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * 후행 재전송 대상 날짜(계약 규칙 2). 오늘(KST)은 아직 안 끝났으므로 빼고,
 * 어제부터 count일치를 과거→현재 순으로 돌려준다.
 *
 * 환불은 결제 며칠 뒤에 생긴다. 당일치만 보내면 과거 숫자가 영영 틀린 채 남는다.
 */
export function trailingKstDates(now: Date, count: number): string[] {
  if (!Number.isInteger(count) || count < 1) throw new Error(`trailingDays는 1 이상의 정수여야 합니다: ${count}`);
  const todayMs = Date.UTC(...kstParts(now));
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) {
    const d = new Date(todayMs - i * 24 * 60 * 60 * 1000);
    out.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
  }
  return out;
}

function kstParts(now: Date): [number, number, number] {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  return [k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()];
}
