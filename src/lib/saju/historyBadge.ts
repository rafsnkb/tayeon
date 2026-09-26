// 결제 내역(`/api/user/purchase-history`)이 사주 리포트 결제를 보여줄 때 쓰는 배지 판정.
//
// 순수 함수로 여기 뺀 이유는 하나다 — 그 라우트 파일(`route.ts`)은 `next/server`를 import해서
// 플레인 노드 테스트 러너로 직접 import할 수 없다("next/server" 모듈이 Next 런타임 밖에서는
// 안 풀린다). 판정 로직을 라우트 밖으로 빼야 Firestore도 Next도 없이 테스트할 수 있다.
import { SAJU_REPORT_RETENTION_DAYS } from "@/lib/legal/retention";

/**
 * 사주 리포트(`fulfilled` 상태) 결제 한 건의 배지. 세 갈래(아직 안 열림 / 읽는 중 / 보관 만료)뿐이다
 * — 환불된 건은 여기 오지 않는다(호출부의 `status === "refunded"` 분기가 먼저 잡는다).
 *
 * 만료 판정은 `paidAt + SAJU_REPORT_RETENTION_DAYS` **근사값**이다 — 진짜 만료 시각
 * (`sajuReadings/{id}.expiresAt`)을 보려면 결제 건마다 리포트 문서를 한 번 더 읽어야 해서
 * (N+1), 배지 하나를 위해 그 비용을 치르지 않는다. 실제 접근 차단은 리포트를 열 때
 * `pageGateReason`이 정확한 값으로 한다 — 이 배지가 늦게 바뀌어도 그쪽이 진실이다.
 */
export function sajuHistoryBadge(
  order: { readingId?: string | null } | null,
  paidAtIso: string | null | undefined,
  now: Date = new Date()
): "아직 안 열림" | "읽는 중" | "보관 만료" {
  if (!order?.readingId) return "아직 안 열림";
  const paidAtMs = Date.parse(paidAtIso ?? "");
  // paidAt 이 깨졌으면 만료로 보지 않는다 — `isSajuReadingExpired`(storage.ts)와 같은 원칙,
  // 파싱 실패로 읽던 걸 잠그지 않는다.
  if (!Number.isFinite(paidAtMs)) return "읽는 중";
  const approxExpiresAtMs = paidAtMs + SAJU_REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() > approxExpiresAtMs ? "보관 만료" : "읽는 중";
}
