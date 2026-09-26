/** 환불된 사주 리포트를 잠그는 일은 본체가 한다 — 어드민은 창구만 호출한다.
 *
 *  `notifyOwner.ts` 와 같은 구조이고 같은 이유다: 잠그는 로직(주문 마커를 내리고 리포트를
 *  `failed` 로 만드는 것, 그 둘을 한 트랜잭션으로 묶는 것)을 여기 복사하면 두 벌이 되고,
 *  본체의 취소 웹훅 경로(`src/lib/payment/revoke.ts`)와 어긋나는 날이 온다. 그러면 **어느
 *  경로로 환불했는지에 따라 리포트가 잠기거나 안 잠긴다.**
 *
 *  어드민은 잠글 리포트의 id 를 모른다 — 리포트는 결제 뒤 "열기" 단계에서 만들어지고 그 id 는
 *  주문 마커에만 있다. 그래서 `{ uid, paymentId }` 만 보내고 나머지는 본체가 찾는다.
 *
 *  ⚠️ 이 호출의 실패는 알림 실패와 **무게가 다르다.** 알림은 못 가도 그만이지만, 이건
 *  **환불된 리포트가 계속 읽히는** 상태로 남는다 — 돈은 돌려주고 물건은 그대로 준 셈이다.
 *  그래서 호출부는 실패를 조용히 넘기지 않고 운영자를 urgent 로 부른다(refundExecute.ts). */
export type RevokeSajuResult =
  /**
   * 창구가 답했다. `locked: false` 는 **실패가 아니다** — 사주 주문이 아니거나(타로 환불이
   * 그냥 불러도 되게 창구가 400 을 주지 않는다) 아직 열지 않은 건이다. 후자는 잠글 리포트가
   * 없는 게 정상이고, 그때 창구는 주문 마커만 내려 **그 뒤의 열기 요청을 막는다.**
   *
   * 그래서 운영자를 부를 조건은 `ok: false`(HTTP 자체가 실패) 하나뿐이다. `locked: false` 로
   * 알림을 띄우면 타로 환불마다 울리고, 그러면 호출부가 알림을 무시하게 되고, 정작 진짜
   * 실패가 묻힌다.
   */
  | { ok: true; locked: boolean; readingId: string | null }
  | { ok: false; reason: string };

export async function revokeSajuReading(
  uid: string,
  paymentId: string,
  reason?: string
): Promise<RevokeSajuResult> {
  const base = process.env.TAYEON_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.INTERNAL_API_SECRET;
  if (!base || !secret) {
    return { ok: false, reason: "TAYEON_BASE_URL/INTERNAL_API_SECRET 미설정" };
  }
  try {
    const response = await fetch(`${base}/api/internal/saju/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ uid, paymentId, ...(reason ? { reason } : {}) }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, reason: `창구 응답 ${response.status} ${body}`.trim() };
    }
    const data = (await response.json().catch(() => null)) as
      | { locked?: boolean; readingId?: string | null }
      | null;
    return { ok: true, locked: data?.locked === true, readingId: data?.readingId ?? null };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
