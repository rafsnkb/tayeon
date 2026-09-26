// 결제 내역(`/api/user/purchase-history`)이 사주 리포트 결제를 보여줄 때 쓰는 배지 판정.
//
// 순수 함수로 여기 뺀 이유는 하나다 — 그 라우트 파일(`route.ts`)은 `next/server`를 import해서
// 플레인 노드 테스트 러너로 직접 import할 수 없다("next/server" 모듈이 Next 런타임 밖에서는
// 안 풀린다). 판정 로직을 라우트 밖으로 빼야 Firestore도 Next도 없이 테스트할 수 있다.

/**
 * 사주 리포트(`fulfilled` 상태) 결제 한 건의 배지. **두 갈래뿐이다** — 환불된 건은 여기 오지
 * 않는다(호출부의 `status === "refunded"` 분기가 먼저 잡는다).
 *
 * 「보관 만료」 갈래가 있었는데 2026-09-27 에 없앴다 — 리포트가 타로 리딩과 같이 **회원 탈퇴
 * 시까지 무기한** 보관으로 바뀌었다. 그 갈래는 `paidAt + 보관일` 근사값으로 판정했고 그래서
 * `paidAt` 이 깨졌을 때의 처리까지 달고 있었는데, 전부 같이 사라졌다.
 */
export function sajuHistoryBadge(order: { readingId?: string | null } | null): "아직 안 열림" | "읽는 중" {
  return order?.readingId ? "읽는 중" : "아직 안 열림";
}
