// 보관기간 만료 시각을 Firestore TTL이 인식하는 값으로 만드는 헬퍼. **서버 전용**이다.
//
// 보관기간 상수 자체는 retention.ts에 있다 — 그쪽은 약관 본문이 import하고 약관은 클라이언트
// 컴포넌트에서도 쓰이므로 firebase-admin을 물릴 수 없다. 그래서 Timestamp가 필요한 이 부분만
// 따로 떼어냈다.
//
// !! `firebase deploy --only firestore:indexes` 에 **절대 `--force` 를 붙이지 말 것.**
// TTL 정책은 Firestore 에서 "field override" 로 저장되는데 firestore.indexes.json 의
// fieldOverrides 는 비어 있다. --force 는 "파일에 없는 override 를 지우는" 플래그라, 한 번
// 누르면 여기서 심은 만료 시각들이 **전부 집행되지 않는 상태**가 된다(2026-09-24 배포 때
// "6 field overrides ... To delete them, run with --force" 경고로 확인). 보존기간을 지나
// 파기되지 않는 것도 위반이므로 조용히 법을 어기게 된다.
//
// !! TTL은 문자열이 아니라 Firestore `Timestamp` 타입 필드만 인식한다. ISO 문자열을 넣어두면
// 정책을 켜도 아무것도 삭제되지 않는다(실제로 paymentArchive.retainUntil이 문자열이라 5년
// 파기가 동작하지 않고 있었다 — 2026-09-21 수정). 만료 필드는 반드시 이 헬퍼로 만들 것.
//
// ── TTL 정책 현황 (2026-09-27) ─────────────────────────────────────────────────────────
//
// ACTIVE 인 정책은 **6개**다: `paymentArchive.retainUntil`, 그리고 `friends`·`rateLimits`·
// `refundRequests`·`signupGrants`·`supportInquiries` × `expiresAt`.
// 확인: `gcloud firestore fields ttls list --project=<id>`.
//
// **사주 리포트(`sajuReadings`·`pages`·`assets` × `expiresAtTs`)는 껐다.** 리포트가 타로
// 리딩과 같이 회원 탈퇴 시까지 무기한 보관으로 바뀌었기 때문이다(사용자 결정) — 만료 필드도
// 코드에서 걷어냈다. ⚠️ 기존 문서에 남아 있는 `expiresAt`/`expiresAtTs` 값은 **지우지 않았다**
// — 아무도 읽지 않으므로 무해하고, 지우는 마이그레이션은 프로덕션 쓰기라 별도 승인이 필요하다.
// 되살릴 일이 생기면 **정책·필드·약관·개인정보처리방침 넷을 함께** 되돌려야 한다.
//
// 이 헬퍼로 안 만든 만료 필드는 전수 감사했고(2026-09-26) 전부 Timestamp 였다 — 아래 문자열
// 함정에 걸린 것은 `paymentArchive.retainUntil` 한 건뿐이었고 그건 고쳤다.
//
// ⚠️ 정책을 새로 걸 때 주의할 것:
//  ① 지정하는 건 **컬렉션 그룹 이름 + 필드 이름**이다. 경로 깊이는 상관없으므로, 같은 컬렉션
//     이름이 다른 기능에서도 쓰이면 **그쪽도 같이 걸린다** — 걸기 전에 이름을 검색할 것.
//  ② **부모에 TTL 을 걸어도 서브컬렉션은 안 지워진다.** 서브컬렉션마다 만료 필드를 심고
//     정책을 따로 걸거나, `onDelete` 트리거로 재귀 삭제해야 한다(TTL 삭제도 트리거를 깨운다).
//  ③ 삭제는 만료 "즉시"가 아니라 보통 24시간 안이다. 접근 차단(애플리케이션 로직)과 실제
//     파기(TTL)는 별개다 — 혼동하지 말 것.

import { Timestamp } from "firebase-admin/firestore";
import { addMonthsClamped } from "@/lib/util/dateMath";

/** 기준 시각으로부터 N개월 뒤를 Firestore TTL이 인식하는 Timestamp로 만든다. */
export function retentionExpiresAt(fromIso: string, months: number): Timestamp {
  return Timestamp.fromDate(new Date(addMonthsClamped(fromIso, months)));
}
