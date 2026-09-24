// 환불 가능 기간 판정만 떼어낸 것. 순수 함수라 포트원도 Firestore 도 모른다.
//
// 이 계산이 틀리면 돈을 못 돌려주거나(교착) 기간이 지난 건을 돌려주게 되므로, 실행 경로
// (refundExecute.ts)에 인라인으로 두지 않고 테스트로 고정한다(refundWindow.test.mjs).

/** 환불 가능 기간(결제일로부터). 본체 `src/lib/payment/refundPolicy.ts` 의 REFUND_WINDOW_DAYS
 *  와 손으로 맞춘다 — admin 은 별도 앱이라 그 파일을 import 할 수 없다. */
export const REFUND_WINDOW_DAYS = 7;
export const REFUND_WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * 환불을 집행해도 되는가.
 *
 * **기산점은 사용자가 청약철회를 행사한 시각이지, 운영자가 버튼을 누른 시각이 아니다.**
 *
 * 예전엔 집행 시점에도 `Date.now()` 로 쟀다. 그러면 신청은 받아 놓고 승인은 거부하는 구간이
 * 생긴다 — 신청 접수는 결제 후 7일까지 열려 있는데 자동 승인은 접수로부터 2영업일 뒤에 돌기
 * 때문이다. 금요일(4일차)에 신청하면 화요일(8일차)에 집행이 시도되고 여기서 막힌다. 그러면
 * 이용권은 refund_pending 에 영구히 갇혀 쓰지도, 다시 사지도, 다시 신청하지도 못한다
 * (2026-09-24 발견).
 *
 * 법 구조도 같다 — 전자상거래법 제17조①의 7일은 청약철회를 "할 수 있는" 기간이고,
 * 제18조②2호의 3영업일은 "청약철회한 날"부터 사업자가 환급해야 하는 기간이다. 신청이 기간
 * 안에 들어왔다면 우리 처리가 늦었다는 이유로 거절할 근거가 없다.
 *
 * @param paidAt      결제 시각(ISO). 파싱되지 않으면 거부한다.
 * @param exercisedAt 청약철회를 행사한 시각(ms). 사용자 요청이면 그 요청 시각,
 *                    운영자가 직접 환불하는 것이면 지금.
 */
export function isWithinRefundWindow(paidAt: string | undefined, exercisedAt: number): boolean {
  const paid = Date.parse(paidAt ?? "");
  if (!Number.isFinite(paid) || !Number.isFinite(exercisedAt)) return false;
  // 결제보다 앞선 철회는 데이터가 깨진 것이다 — 통과시키지 않는다.
  if (paid > exercisedAt) return false;
  return exercisedAt - paid <= REFUND_WINDOW_MS;
}
