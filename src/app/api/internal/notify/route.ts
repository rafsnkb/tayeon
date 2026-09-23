import { NextRequest, NextResponse } from "next/server";
import { notifyOwner, type OwnerAlert } from "@/lib/notify/owner";

/**
 * 어드민(별도 앱)이 운영 알림을 보낼 때 쓰는 내부 창구.
 *
 * 알림 발송 로직(등급별 채널 선택, 일일 메일 예산, 중복 방지)을 어드민에도 복사하는 대신
 * 여기 하나만 두고 부르게 한다 — 나중에 텔레그램·카카오를 붙일 때도 한 곳만 고치면 된다.
 *
 * 사용자 토큰이 아니라 **공유 시크릿**으로 막는다. 호출자가 사람이 아니라 서버(어드민,
 * 스케줄러)라서 Firebase ID 토큰을 들고 있지 않기 때문이다. 시크릿이 설정돼 있지 않으면
 * 아무도 못 부르게 닫아 둔다 — 열린 채로 두면 아무나 운영자에게 알림을 밀어 넣을 수 있다.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("[internal/notify] INTERNAL_API_SECRET 미설정 — 호출을 거부한다");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (req.headers.get("x-internal-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const alert = (await req.json().catch(() => null)) as OwnerAlert | null;
  if (!alert?.key || !alert.title || !Array.isArray(alert.fields)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  await notifyOwner({
    key: alert.key,
    level: alert.level === "urgent" || alert.level === "warn" ? alert.level : "info",
    title: alert.title,
    fields: alert.fields,
    note: alert.note,
    link: alert.link,
  });
  return NextResponse.json({ ok: true });
}
