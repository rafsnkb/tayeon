// 개인정보처리방침 제3조가 약속한 보관기간을 코드 한 곳에 모은 것.
//
// 방침에 "N년 보관"이라고 써두고 실제로는 영구 보관하면 그것도 위반이라, 약속한 기간이 지나면
// 실제로 지워져야 한다. 삭제는 Firestore TTL 정책이 수행한다 — 각 컬렉션의 만료 필드에
// `gcloud firestore fields ttls update`로 정책을 켜두면 Firestore가 알아서 문서를 지운다.
//
// !! TTL은 문자열이 아니라 Firestore `Timestamp` 타입 필드만 인식한다. ISO 문자열을 넣어두면
// 정책을 켜도 아무것도 삭제되지 않는다(실제로 paymentArchive.retainUntil이 문자열이라 5년
// 파기가 동작하지 않고 있었다 — 2026-09-21 수정). 만료 필드는 반드시 이 파일의 헬퍼로 만든다.
import { Timestamp } from "firebase-admin/firestore";
import { addMonthsClamped } from "@/lib/util/dateMath";

/** 대금결제·재화공급 기록 5년 — 전자상거래법 시행령 제6조. */
export const PAYMENT_RECORD_RETENTION_MONTHS = 60;

/** 소비자 불만·분쟁처리 기록 3년 — 같은 시행령 제6조. 고객센터 문의와 환불 요청이 여기 해당한다. */
export const DISPUTE_RECORD_RETENTION_MONTHS = 36;

/** 부정가입 방지 마커 6개월 — 개인정보 보호법 제15조1항6호(정당한 이익) 근거.
 *  실제 사용처는 src/lib/referral/code.ts. */
export const GRANT_MARKER_RETENTION_MONTHS = 6;

/** 기준 시각으로부터 N개월 뒤를 Firestore TTL이 인식하는 Timestamp로 만든다. */
export function retentionExpiresAt(fromIso: string, months: number): Timestamp {
  return Timestamp.fromDate(new Date(addMonthsClamped(fromIso, months)));
}
