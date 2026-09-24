import { FieldValue, type DocumentReference, type QueryDocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { availableCount, remainingAfterUse, COMBOS, type CountPassBalance, type SpreadKey } from "./pricing";
import type { BirthInfo } from "./birthInfo";

function isExpired(pass: CountPassBalance): boolean {
  return Boolean(pass.expiresAt && new Date(pass.expiresAt).getTime() <= Date.now());
}

// 허용 상태만 열거(거부 목록이 아니라 허용 목록) — pricing.ts의 availableCount와 동일한 이유.
function isUsable(pass: CountPassBalance): boolean {
  return pass.remaining > 0 && (pass.status === "unused" || pass.status === "active") && !isExpired(pass);
}

/**
 * 우선순위 큐: "사용중"(active) 상태인 이용권이 있으면 그대로 반환(끼어들지 않음 — 소진/만료될
 * 때까지 계속 이 이용권을 씀, 2026-09-18). 없으면 리워드 계열(source !== "purchase")을 createdAt
 * 오름차순으로 우선, 그다음 구매분(source === "purchase")을 후보로 첫 사용 가능한 이용권을 고른다.
 *
 * src/app/api/tarot/reading/route.ts와 src/app/api/user/me/route.ts가 공용으로 쓴다 — 트랜잭션
 * 밖 스냅샷 기준의 "다음에 뭘 쓸지" 결정용이며, 실제 차감/상태 전환은 chargeActiveCountPass가
 * 트랜잭션 안에서 재검증 후 수행한다.
 */
export function pickActiveCountPass(
  countPasses: QueryDocumentSnapshot[],
  activePointerPassId: string | null | undefined,
  /**
   * 이번 요청에 실제로 쓸 수 있는 이용권인지 거르는 추가 조건(선택).
   *
   * 없으면 `remaining > 0` 만 본다. 그런데 남은 권리는 스프레드마다 환산이 달라서, 원카드는
   * 아직 되지만 켈틱크로스는 안 되는 잔량이 존재한다 — 그 상태로 켈틱을 고르면 여기서는
   * 통과하고 chargeActiveCountPass 가 트랜잭션에서 던져서, **모델 호출까지 다 끝낸 뒤** 500이
   * 났다(2026-09-24). 호출부가 "이 스프레드를 감당할 수 있는가"를 넘겨서 미리 걸러낸다.
   */
  canUse?: (pass: CountPassBalance) => boolean
): QueryDocumentSnapshot | undefined {
  const ok = (doc: QueryDocumentSnapshot) => {
    const pass = doc.data() as CountPassBalance;
    return isUsable(pass) && (canUse?.(pass) ?? true);
  };
  if (activePointerPassId) {
    const pointed = countPasses.find((doc) => doc.id === activePointerPassId);
    if (pointed && ok(pointed) && (pointed.data() as CountPassBalance).status === "active") {
      return pointed;
    }
  }
  const usable = countPasses.filter(ok);
  const byCreatedAt = (a: QueryDocumentSnapshot, b: QueryDocumentSnapshot) =>
    String(a.data().createdAt).localeCompare(String(b.data().createdAt));
  const reward = usable.filter((doc) => doc.data().source !== "purchase").sort(byCreatedAt);
  const purchased = usable.filter((doc) => doc.data().source === "purchase").sort(byCreatedAt);
  return reward[0] ?? purchased[0];
}

/**
 * 후보 이용권의 고정 조합에서 이번 요청의 사주/자미두수 포함 여부를 유도한다. 채팅창에서 더 이상
 * 사주/자미두수를 사용자가 고르지 않으므로(2026-09-18), 활성 이용권의 조합이 곧 요청 내용이다.
 * combo:"any"(가입 무료체험 전용)만 예외로, 생년월일시가 입력된 만큼만 자동으로 포함한다.
 */
export function deriveIncludeOptions(
  pass: CountPassBalance | undefined,
  birthInfo: BirthInfo | null
): { includeSaju: boolean; includeZiwei: boolean } {
  if (!pass) return { includeSaju: false, includeZiwei: false };
  if (pass.combo === "any") {
    return { includeSaju: birthInfo != null, includeZiwei: birthInfo != null && !birthInfo.timeUnknown };
  }
  const { saju, ziwei } = COMBOS[pass.combo];
  return { includeSaju: saju, includeZiwei: ziwei };
}

/**
 * 실제 차감 + 상태 전환(호출부의 Firestore 트랜잭션 안에서 실행). 처음 쓰는 순간 unused→active로,
 * 소진되면 active→exhausted + 활성 포인터(users/{uid}.activeCountPass) 해제까지 한 번에 처리한다.
 */
export async function chargeActiveCountPass(
  tx: Transaction,
  userRef: DocumentReference,
  passRef: DocumentReference,
  spread: SpreadKey,
  saju: boolean,
  ziwei: boolean
): Promise<void> {
  const snap = await tx.get(passRef);
  const pass = snap.data() as CountPassBalance | undefined;
  if (!pass || availableCount(pass, spread, saju, ziwei) < 1) {
    throw new Error("COUNT_PASS_UNAVAILABLE");
  }
  const nextRemaining = remainingAfterUse(pass, spread, saju, ziwei);
  const nextStatus = nextRemaining <= 0 ? "exhausted" : "active";
  tx.update(passRef, { remaining: nextRemaining, status: nextStatus, usedCount: FieldValue.increment(1) });
  tx.update(userRef, {
    activeCountPass:
      nextStatus === "exhausted" ? null : { passId: passRef.id, combo: pass.combo, basis: pass.basis },
  });
}
