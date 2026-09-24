import { adminAuth, adminDb } from "@/lib/firebase/admin";

/** 운영자가 지급한("admin-grant") 이용권만 회수할 수 있다 — 구매분은 사용자가 돈을 낸 것이라
 *  회수가 아니라 환불(refund-payment 라우트)로만 되돌릴 수 있고, 리워드 지급분은 정산 기록과
 *  묶여 있어 여기서 손대지 않는다. */
const SOURCE = "admin-grant";

/** 평소 회수 대상: 아직 한 번도 안 쓴 것. */
const REVOCABLE = ["unused"];

/** 강제 회수 대상: 이미 쓰기 시작한 것까지 포함한다.
 *
 *  잘못 지급한 이용권을 사용자가 쓰기 시작하면 평소 경로로는 영영 못 거둬들인다. 남은 횟수가
 *  많으면 그 계정은 계속 무료로 서비스를 쓰고, 운영자가 할 수 있는 일이 없다. 실수 지급·테스트
 *  계정 정리 같은 예외 상황에서 쓰라고 열어두되, 되돌릴 수 없으므로 호출부가 force 를 명시적으로
 *  넘겨야 한다. */
const FORCE_REVOCABLE = ["unused", "active"];

/** 회수된 이용권이 사용자 문서의 활성 포인터로 걸려 있을 때 끊어야 하는 필드. */
const POINTER_FIELD = { countPasses: "activeCountPass", timePasses: "activeTimePass" } as const;

export async function revokeGrantedPass(
  uid: string,
  collection: "countPasses" | "timePasses",
  passId: string,
  adminUid: string,
  reason: string,
  force = false
): Promise<{ error: string; status: number } | null> {
  const allowed = force ? FORCE_REVOCABLE : REVOCABLE;
  const adminUser = await adminAuth.getUser(adminUid);
  const userRef = adminDb.collection("users").doc(uid);
  const passRef = userRef.collection(collection).doc(passId);

  // 트랜잭션인 이유: 상태를 읽고 쓰는 사이에 사용자가 리딩을 한 번 더 돌리면(unused→active,
  // 또는 active→exhausted) 그 차감이 회수 쓰기에 덮여 사라진다. 활성 포인터 정리도 같은 원자
  // 단위여야 한다 — 이용권만 회수되고 포인터가 남으면 시간제는 만료 시각까지 계속 무제한으로
  // 쓸 수 있다(본체 src/lib/payment/revoke.ts 의 같은 처리 참고).
  return adminDb.runTransaction(async (tx) => {
    const passSnap = await tx.get(passRef);
    if (!passSnap.exists) return { error: "존재하지 않는 이용권입니다.", status: 404 };

    const pass = passSnap.data()!;
    if (pass.source !== SOURCE) {
      return { error: "운영자가 지급한 이용권만 회수할 수 있어요.", status: 409 };
    }
    const status = typeof pass.status === "string" ? pass.status : "unknown";
    if (!allowed.includes(status)) {
      return {
        error: force
          ? `회수할 수 없는 상태예요(${status}).`
          : "이미 사용을 시작한 이용권이에요. 강제 회수로만 거둬들일 수 있어요.",
        status: 409,
      };
    }

    const userSnap = await tx.get(userRef);
    const pointerField = POINTER_FIELD[collection];
    const pointer = userSnap.data()?.[pointerField] as { passId?: string } | null | undefined;

    tx.update(passRef, {
      status: "revoked",
      revokedAt: new Date().toISOString(),
      revokedByUid: adminUid,
      revokedByEmail: adminUser.email ?? null,
      revokeReason: reason.trim().slice(0, 200),
      // 무엇을 거둬들였는지 남긴다 — 강제 회수는 사용자가 이미 쓰고 있던 것을 뺏는 일이라,
      // 나중에 문의가 들어왔을 때 "어떤 상태의 무엇을 얼마나 남기고 뺏었는지"가 필요하다.
      revokedFromStatus: status,
      revokedForced: force,
      remainingAtRevoke: pass.remaining ?? null,
    });
    // 활성 포인터가 이 이용권을 가리키고 있으면 같이 끊는다.
    if (pointer?.passId === passId) {
      tx.update(userRef, { [pointerField]: null });
    }

    return null;
  });
}
