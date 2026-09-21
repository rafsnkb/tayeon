// 계정 정지 판정과 "기간이 지난 정지의 자동 해제"를 한 곳에 모은 것.
//
// 예전에는 이 로직이 reading/prepare/time-pass-start/pending-rewards-claim 네 군데에 통째로
// 복제돼 있었다. 복제본 하나가 Firestore 트랜잭션 규칙(모든 읽기가 쓰기보다 먼저)을 어겨
// "정지가 만료된 사용자만" 500을 맞는 버그를 만들었고(2026-09-21), 그게 이 파일을 만든 계기다.
import { NextResponse } from "next/server";
import type { DocumentReference } from "firebase-admin/firestore";

/** 정지를 푼 상태. update()에 그대로 넘긴다. */
export const SUSPENSION_CLEARED = {
  suspended: false,
  suspendedAt: null,
  suspendedUntil: null,
  suspendedReason: null,
} as const;

export type SuspensionFields = {
  suspended?: boolean;
  suspendedUntil?: string | null;
  suspendedReason?: string | null;
};

export type SuspensionVerdict =
  | { kind: "ok" }
  /** 기간 정지가 이미 끝났다 — 호출부가 SUSPENSION_CLEARED로 해제 쓰기를 해야 한다. */
  | { kind: "expired" }
  | { kind: "blocked"; reason: string | null; suspendedUntil: string | null };

/**
 * 읽어둔 유저 문서만으로 판정한다(읽기·쓰기를 하지 않으므로 트랜잭션 안에서도 안전하다).
 * `suspendedUntil`이 없거나 파싱되지 않는 정지는 무기한 정지로 보고 막는다.
 */
export function checkSuspension(data: SuspensionFields | undefined): SuspensionVerdict {
  if (!data?.suspended) return { kind: "ok" };
  const until = Date.parse(data.suspendedUntil ?? "");
  if (Number.isFinite(until) && until <= Date.now()) return { kind: "expired" };
  return {
    kind: "blocked",
    reason: data.suspendedReason ?? null,
    suspendedUntil: data.suspendedUntil ?? null,
  };
}

/**
 * 트랜잭션 밖 라우트용. 막아야 하면 403 응답을, 통과(또는 자동 해제)면 null을 반환한다.
 *
 * @param message 정지 중 사용자에게 보여줄 문구 — 막는 동작이 화면마다 달라서 이것만 인자로 받는다.
 */
export async function blockIfSuspended(
  userRef: DocumentReference,
  data: SuspensionFields | undefined,
  message: string
): Promise<NextResponse | null> {
  const verdict = checkSuspension(data);
  if (verdict.kind === "ok") return null;
  if (verdict.kind === "expired") {
    await userRef.update(SUSPENSION_CLEARED);
    return null;
  }
  return NextResponse.json(
    {
      error: message,
      code: "SUSPENDED",
      reason: verdict.reason,
      suspendedUntil: verdict.suspendedUntil,
    },
    { status: 403 }
  );
}
