/** 운영 알림은 본체(`src/lib/notify/owner.ts`)가 보낸다 — 어드민은 창구만 호출한다.
 *
 *  발송 로직(Discord/메일 선택, 일일 메일 예산, 중복 방지)을 여기 복사하면 두 벌이 되고,
 *  텔레그램·카카오를 붙일 때 한쪽만 고쳐질 게 뻔하다. 대신 런타임 의존이 하나 생긴다 —
 *  본체가 내려가 있으면 알림이 안 간다(콘솔 로그로는 남는다). */
export type AdminAlert = {
  key: string;
  level: "info" | "warn" | "urgent";
  title: string;
  fields: [string, string][];
  note?: string;
  link?: { label: string; url: string };
};

export async function notifyOwner(alert: AdminAlert): Promise<boolean> {
  const base = process.env.TAYEON_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!base || !secret) {
    console.warn("[notify] TAYEON_BASE_URL/INTERNAL_API_SECRET 미설정 — 알림을 건너뛴다", alert.key);
    return false;
  }
  try {
    const response = await fetch(`${base}/api/internal/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify(alert),
    });
    if (!response.ok) {
      console.error("[notify] 본체 알림 창구 실패", response.status, await response.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (error) {
    console.error("[notify] 본체 알림 창구 호출 실패", alert.key, error);
    return false;
  }
}
