/** 개월 더하기는 리워드 수령 기한 계산에도 쓰이고, 그 계산은 Cloud Functions 에도 같은 코드가
 *  있어야 한다. 그래서 정의 자체는 `@/lib/reward/rules`(Functions 로 복사되는 단일 출처)에 두고
 *  여기서는 기존 호출부(fulfill.ts, referral/code.ts, pending-rewards, retentionTimestamp)가
 *  그대로 돌도록 재수출만 한다. */
export { addMonthsClamped } from "@/lib/reward/rules";
