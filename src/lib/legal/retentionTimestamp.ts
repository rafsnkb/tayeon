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
// ── TTL 정책을 콘솔에서 실제로 켜는 절차 (2026-09-26, 확인만 하고 걸지는 않음) ──────────
//
// 이 저장소 전체의 절차다 — 사주 리포트(`expiresAtTs`)만이 아니라 이 헬퍼로 만든 모든 만료
// 필드(`paymentArchive.retainUntil` 등)에 똑같이 적용된다. 콘솔 접근·정책 적용은 **사용자
// 몫**이다. 걸기 전에 아래를 다 읽을 것 — 특히 ②.
//
// ① 어디를 지정하는가 — **컬렉션 그룹**과 **필드 이름**, 경로 전체가 아니다
//    Firestore 콘솔(또는 `gcloud firestore fields ttls update`)에서 컬렉션 **그룹** 이름과
//    타임스탬프 필드 이름만 넣는다. 예: 컬렉션 그룹 `sajuReadings` + 필드 `expiresAtTs`.
//    **경로 깊이는 상관없다** — `users/{uid}/sajuReadings` 처럼 최상위가 아니어도 같은
//    컬렉션 ID 를 쓰는 컬렉션이면 전부(어느 부모 문서 아래 있든) 적용된다. 그래서 반대
//    위험도 있다 — **컬렉션 이름이 이 저장소 다른 곳에서도 재사용되면 그쪽도 같이
//    걸린다.** 새 컬렉션 그룹에 TTL 을 걸기 전에 그 이름이 다른 기능에서도 쓰이는지
//    먼저 검색할 것(`saju/pages`·`saju/assets` 는 2026-09-26 기준 사주 전용이라 안전하다 —
//    다른 기능이 나중에 같은 이름을 쓰면 다시 확인해야 한다).
//
// ② ⚠️ **부모 문서에 TTL 을 걸어도 서브컬렉션은 안 지워진다** — 제일 중요한 함정
//    `sajuReadings/{id}` 가 TTL 로 지워져도 그 아래 `pages/{n}`·`assets/image` 서브컬렉션
//    문서는 **그대로 남는다.** Firestore 는 문서를 지울 때(TTL 이든 수동이든) 서브컬렉션을
//    같이 지우지 않는다 — 부모만 사라지고 본문·이미지는 고아로 남아, "삭제했다"고 말하면서
//    실제로는 파기하지 않은 상태가 된다. 지금 스키마는 이 구멍을 안 막았다(`pages`·
//    `assets/image` 문서에 만료 필드가 아예 없다). 막으려면 둘 중 하나가 필요하다 —
//    **어느 쪽을 쓸지는 아직 결정 안 했다, 여기 남긴다**:
//      (a) `pages`·`assets` 문서를 쓸 때마다 부모와 같은 `expiresAtTs` 를 복사해 넣고, 그
//          두 컬렉션 그룹에도 TTL 을 따로 건다(정책 3개 — 관리 부담이 늘지만 함수가 없다)
//      (b) `sajuReadings/{id}` 의 `onDelete` Cloud Functions 트리거를 만들어 그 문서가
//          지워질 때(TTL 삭제 포함 — **TTL 삭제도 일반 삭제와 똑같이 `onDelete` 트리거를
//          깨운다**) 서브컬렉션을 재귀 삭제한다(정책은 하나, 대신 `functions/` 배포가
//          필요하다 — 지금 배포가 밀려 있다는 점을 감안할 것)
//
// ③ 삭제는 만료 "즉시"가 아니다 — 보통 만료 후 24시간 안에 처리된다(백그라운드 배치라
//    트랜잭션이 아니고, 같은 시각에 만료된 문서들이 같은 순서·같은 시각에 지워진다는 보장도
//    없다). **사용자에게 보이는 "30일 후 못 연다"는 이미 이 TTL 과 무관하게 동작한다** —
//    `isSajuReadingExpired`/`pageGateReason` 이 `expiresAt`(문자열)을 직접 비교해서 접근을
//    막는 게 애플리케이션 로직이고, 그건 지금도 정확히 30일에 걸린다. TTL 은 그 뒤에 실제
//    바이트를 지우는(개인정보처리방침의 "파기" 의무를 채우는) 별도 절차이고, 여기서 하루
//    안팎 늦는 것은 사용자 경험에 드러나지 않는다 — 접근 차단과 실제 파기를 같은 것으로
//    혼동하지 말 것.
//
// ④ ⚠️ `firebase deploy --only firestore:indexes` 에 **절대 `--force` 를 붙이지 말 것** —
//    바로 아래 문단에 이유가 있다. TTL 을 켠 뒤에는 이 위험이 이 파일이 다루는 모든 만료
//    필드(사주 포함)에 그대로 적용된다.
import { Timestamp } from "firebase-admin/firestore";
import { addMonthsClamped } from "@/lib/util/dateMath";

/** 기준 시각으로부터 N개월 뒤를 Firestore TTL이 인식하는 Timestamp로 만든다. */
export function retentionExpiresAt(fromIso: string, months: number): Timestamp {
  return Timestamp.fromDate(new Date(addMonthsClamped(fromIso, months)));
}
