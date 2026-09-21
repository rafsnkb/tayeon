// 보관기간 만료 시각을 Firestore TTL이 인식하는 값으로 만드는 헬퍼. **서버 전용**이다.
//
// 보관기간 상수 자체는 retention.ts에 있다 — 그쪽은 약관 본문이 import하고 약관은 클라이언트
// 컴포넌트에서도 쓰이므로 firebase-admin을 물릴 수 없다. 그래서 Timestamp가 필요한 이 부분만
// 따로 떼어냈다.
//
// !! TTL은 문자열이 아니라 Firestore `Timestamp` 타입 필드만 인식한다. ISO 문자열을 넣어두면
// 정책을 켜도 아무것도 삭제되지 않는다(실제로 paymentArchive.retainUntil이 문자열이라 5년
// 파기가 동작하지 않고 있었다 — 2026-09-21 수정). 만료 필드는 반드시 이 헬퍼로 만들 것.
import { Timestamp } from "firebase-admin/firestore";
import { addMonthsClamped } from "@/lib/util/dateMath";

/** 기준 시각으로부터 N개월 뒤를 Firestore TTL이 인식하는 Timestamp로 만든다. */
export function retentionExpiresAt(fromIso: string, months: number): Timestamp {
  return Timestamp.fromDate(new Date(addMonthsClamped(fromIso, months)));
}
