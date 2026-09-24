// 운영자에게 "지금 봐야 하는 일"을 알린다 — 지금은 환불 요청/자동 승인 결과가 유일한 사용처.
//
// 채널을 하나로 고정하지 않는다. 설정된 곳으로 전부 보내고, 한 곳이 실패해도 나머지는 나간다.
// 나중에 텔레그램·카카오("나에게 보내기")를 붙일 때도 sendX 함수 하나와 환경변수 하나만 더
// 추가하면 된다.
//
// **Discord 가 주 채널이고 메일은 예외 상황용이다.** Resend 무료 플랜이 하루 100통이고 그
// 할당량을 고객센터 문의 전달이 같이 쓰기 때문에, 일상적인 알림까지 메일로 보내면 정작
// 문의가 안 나가는 날이 생긴다. Discord 웹훅은 한도도 만료도 없다.
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { OWNER_ALERTS } from "@/lib/firestore/collections";
import { SUPPORT_EMAIL } from "@/lib/company";

/** 하루에 운영 알림으로 쓸 수 있는 메일 수. Resend 무료 한도 100통 중 나머지는 고객센터 몫. */
const DAILY_EMAIL_BUDGET = 60;

export type AlertLevel =
  /** 정상 흐름. Discord 만 간다. */
  | "info"
  /** 사람이 봐야 한다(자동 승인 보류 등). 메일도 간다. */
  | "warn"
  /** 방치하면 돈이 새거나 법정 기한을 넘긴다. 메일도 간다. */
  | "urgent";

/** 알림을 어느 디스코드 채널로 보낼지. 환불과 고객문의가 한 채널에 섞이면 둘 다 놓친다.
 *  해당 채널이 설정돼 있지 않으면 기본 채널로 떨어진다. */
export type AlertChannel = "default" | "support";

const CHANNEL_ENV: Record<AlertChannel, string> = {
  default: "DISCORD_WEBHOOK_URL",
  support: "DISCORD_SUPPORT_WEBHOOK_URL",
};

export type OwnerAlert = {
  /** 중복 발송 방지 키. 같은 키로 다시 부르면 보내지 않는다 — 스케줄러가 매시 도는데
   *  같은 건을 매번 알리면 알림이 무의미해진다. */
  key: string;
  level: AlertLevel;
  title: string;
  /** [라벨, 값] 목록. Discord 는 표로, 메일은 줄 단위로 그린다. */
  fields: [string, string][];
  /** 이상 징후처럼 눈에 띄어야 하는 블록. */
  note?: string;
  link?: { label: string; url: string };
  channel?: AlertChannel;
};

const COLOR: Record<AlertLevel, number> = {
  info: 0x5865f2,   // 디스코드 기본 블루
  warn: 0xf5a524,   // 주황
  urgent: 0xe5484d, // 빨강
};
const PREFIX: Record<AlertLevel, string> = { info: "🔔", warn: "⚠️", urgent: "🚨" };

/** 디스코드 메시지 안에서 줄을 바꾸는 문자. 소스의 줄바꿈과 헷갈리지 않게 상수로 둔다. */
const nlEsc = "\n";

/**
 * 알림 키를 Firestore 문서 id 로 바꾼다.
 *
 * 우리 키는 `refund-requested/{paymentId}` 처럼 슬래시로 종류와 대상을 나눈다. 그런데
 * Firestore 는 문서 id 안의 `/` 를 **경로 구분자로 읽고 예외를 던진다**. 그 예외를 notifyOwner
 * 의 try/catch 가 삼키는 바람에, 알림이 한 건도 나가지 않는데 에러도 안 보이는 상태였다
 * (2026-09-24). `__foo__` 형태도 Firestore 예약이라 같이 피한다.
 */
export function alertDocId(key: string): string {
  const safe = key.replace(/\//g, "~").replace(/^\.+$/, "_");
  return /^__.*__$/.test(safe) ? `k.${safe}` : safe;
}

function todayKey(now: Date): string {
  // 발송 예산은 한국 기준 하루로 센다(운영자가 보는 시간대).
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

async function sendDiscord(alert: OwnerAlert): Promise<boolean> {
  const url =
    process.env[CHANNEL_ENV[alert.channel ?? "default"]] || process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  // embed 의 fields 는 폭이 남으면 2~3열 그리드로 접히고 라벨과 값이 같은 크기·색이라 구분이
  // 안 된다. description 에 직접 그려서 세로로 세우고, 라벨은 굵게(흰색), 값은 `-#`(subtext —
  // 더 작고 흐림)로 내려 층을 만든다. 항목 사이는 빈 줄 하나.
  const rows = alert.fields
    .map(([name, value]) => `**${name}**${nlEsc}-# ${value || "-"}`)
    .join(`${nlEsc}${nlEsc}`);
  const description = [alert.note, rows].filter(Boolean).join(`${nlEsc}${nlEsc}`);
  const body = {
    embeds: [
      {
        title: `${PREFIX[alert.level]} ${alert.title}`,
        color: COLOR[alert.level],
        description,
        timestamp: new Date().toISOString(),
      },
    ],
    // 서버 설정에서 만든(=애플리케이션 소유가 아닌) 웹훅은 **링크 버튼만** 보낼 수 있고,
    // 그마저 with_components=true 가 없으면 조용히 무시된다. 눌러서 동작하는 버튼을 쓰려면
    // 디스코드 앱(봇)과 인터랙션 엔드포인트가 필요하다 — 지금은 링크로 충분하다고 판단.
    ...(alert.link
      ? { components: [{ type: 1, components: [{ type: 2, style: 5, label: alert.link.label, url: alert.link.url }] }] }
      : {}),
  };
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}with_components=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("[notify] Discord 발송 실패", response.status, await response.text().catch(() => ""));
    return false;
  }
  return true;
}

async function sendEmail(alert: OwnerAlert): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const text = [
    ...alert.fields.map(([name, value]) => `${name}: ${value}`),
    ...(alert.note ? ["", alert.note] : []),
    ...(alert.link ? ["", `${alert.link.label}: ${alert.link.url}`] : []),
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // 같은 알림이 두 번 나가지 않도록 — 고객센터 문의와 같은 방식.
      "Idempotency-Key": `owner-alert/${alert.key}`,
    },
    body: JSON.stringify({
      from,
      to: [process.env.RESEND_ADMIN_EMAIL ?? SUPPORT_EMAIL],
      subject: `${PREFIX[alert.level]} [타연] ${alert.title}`,
      text,
    }),
  });
  if (!response.ok) {
    console.error("[notify] 메일 발송 실패", response.status, await response.text().catch(() => ""));
    return false;
  }
  return true;
}

/**
 * 같은 키로는 한 번만 보낸다. 보냈으면 true.
 *
 * 스케줄러가 매시 도는 구조라 이게 없으면 "마감 임박" 같은 알림이 하루에 24번 온다.
 * 트랜잭션으로 잡아서 두 인스턴스가 동시에 보내는 것도 막는다.
 */
async function claim(alert: OwnerAlert, now: Date): Promise<{ send: boolean; emailAllowed: boolean }> {
  const ref = adminDb.collection(OWNER_ALERTS).doc(alertDocId(alert.key));
  const budgetRef = adminDb.collection(OWNER_ALERTS).doc(`quota-${todayKey(now)}`);
  return adminDb.runTransaction(async (tx) => {
    const [snap, budgetSnap] = await Promise.all([tx.get(ref), tx.get(budgetRef)]);
    if (snap.exists) return { send: false, emailAllowed: false };
    const used = (budgetSnap.data()?.emails as number | undefined) ?? 0;
    const wantsEmail = alert.level !== "info";
    const emailAllowed = wantsEmail && used < DAILY_EMAIL_BUDGET;
    tx.set(ref, { level: alert.level, title: alert.title, createdAt: now.toISOString() });
    if (emailAllowed) tx.set(budgetRef, { emails: FieldValue.increment(1) }, { merge: true });
    return { send: true, emailAllowed };
  });
}

/** 실패해도 호출부를 막지 않는다 — 알림이 안 갔다고 환불 처리까지 멈추면 안 된다. */
export async function notifyOwner(alert: OwnerAlert): Promise<void> {
  try {
    const now = new Date();
    const { send, emailAllowed } = await claim(alert, now);
    if (!send) return;

    const discordOk = await sendDiscord(alert).catch(() => false);
    // Discord 가 실패했으면 등급과 무관하게 메일로라도 알린다 — 채널이 죽은 걸 모르는 게
    // 제일 위험하다. 예산을 이미 쓴 경우에도 이때만은 보낸다.
    let emailOk = false;
    if (!discordOk || emailAllowed) {
      emailOk = await sendEmail(alert).catch(() => false);
    }

    // 모든 채널이 실패했으면 중복 방지 키를 놓아 준다.
    //
    // claim() 은 보내기 **전에** 키를 커밋한다(두 인스턴스가 동시에 보내는 걸 막아야 하므로).
    // 그래서 발송이 다 실패하면 아무도 알림을 못 받았는데 키는 이미 타 버려서, 매시 도는
    // 스케줄러가 다시 불러도 영영 침묵했다 — 환불 보류 같은 건이 통보 없이 법정 기한을 넘길
    // 수 있었다(2026-09-24). 키를 지워 다음 호출이 다시 시도하게 한다. 지우는 데 실패하면
    // 예전과 같은 상태(한 번 유실)가 되므로 더 나빠지지는 않는다.
    if (!discordOk && !emailOk) {
      console.error("[notify] 모든 채널 발송 실패 — 중복 방지 키를 해제해 재시도 가능하게 한다", alert.key);
      await adminDb
        .collection(OWNER_ALERTS)
        .doc(alertDocId(alert.key))
        .delete()
        .catch((error) => console.error("[notify] 중복 방지 키 해제 실패", alert.key, error));
    }
  } catch (error) {
    console.error("[notify] 알림 처리 실패", alert.key, error);
  }
}
