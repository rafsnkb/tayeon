import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { addMonthsClamped } from "@/lib/util/dateMath";
import {
  COMBOS,
  isComboKey,
  COUNT_PASS_VALIDITY_MONTHS,
  countAllowancesForCombo,
  basisForOneCardCount,
} from "@/lib/tarot/pricing";
import { isValidBirthInfo } from "@/lib/tarot/birthInfo";
import { USERS, PENDING_REWARDS, COUNT_PASSES } from "@/lib/firestore/collections";
import { checkSuspension, SUSPENSION_CLEARED } from "@/lib/auth/suspension";

/** POST /api/user/pending-rewards/[id]/claim — 미수령 리워드를 고른 조합으로 실제 이용권으로
 * 전환한다. 구매(source:"purchase") 1개 제한(src/app/api/payment/prepare/route.ts)은 여기엔
 * 적용하지 않는다 — 리워드 계열 이용권은 우선순위 큐가 여러 개를 순서대로 소진하는 구조라 동시
 * 보유가 정상이다(src/lib/tarot/activeCountPass.ts 참고). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const { combo } = (await req.json()) as { combo?: string };
  if (!isComboKey(combo)) {
    return NextResponse.json({ error: "이용권 옵션을 선택해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const rewardRef = userRef.collection(PENDING_REWARDS).doc(id);

  try {
    const passId = await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      // Firestore 트랜잭션은 모든 읽기가 모든 쓰기보다 먼저 와야 한다. 아래 정지 해제가 쓰기라서,
      // 보상 문서 읽기를 그 뒤에 두면 "정지가 만료된 사용자가 보상을 수령"하는 경로에서만
      // 트랜잭션이 통째로 실패한다 — 읽기를 여기서 다 끝내둔다.
      const snap = await tx.get(rewardRef);
      const userData = userSnap.data();
      const verdict = checkSuspension(userData);
      if (verdict.kind === "blocked") {
        throw Object.assign(new Error("SUSPENDED"), {
          reason: verdict.reason,
          suspendedUntil: verdict.suspendedUntil,
        });
      }
      const liftExpiredSuspension = verdict.kind === "expired";
      // 자미두수 포함 조합은 태어난 시간이 없으면 정확한 계산이 불가능하다 — 구매 이용권과 동일하게
      // 보상 수령도 서버에서 막는다(2026-09-19).
      if (COMBOS[combo].ziwei) {
        const birthInfo = userData?.birthInfo;
        if (!isValidBirthInfo(birthInfo) || !birthInfo.birthTime || birthInfo.timeUnknown) {
          throw new Error("NO_BIRTH_TIME");
        }
      }
      if (liftExpiredSuspension) {
        tx.update(userRef, SUSPENSION_CLEARED);
      }
      if (!snap.exists) throw new Error("NOT_FOUND");
      const data = snap.data()!;
      if (data.status !== "pending") throw new Error("ALREADY_RESOLVED");
      if (new Date(data.claimWindowExpiresAt).getTime() <= Date.now()) throw new Error("EXPIRED");
      const birthdayOption = Array.isArray(data.options) ? data.options.find((option: { combo?: string }) => option.combo === combo) : null;
      // 생일 쿠폰은 조합별로 "정확히 N회"를 약속한다(8/6/4). 예전엔 freePasses × 200 을 basis 로
      // 썼는데, 그러면 countAllowancesForCombo 가 조합 배율을 한 번 더 곱해서 광고의 절반(4/3/2)만
      // 나갔다 — 단가가 200 이던 시절에도 틀렸던 계산이다(2026-09-24). 역산해서 잡는다.
      const basis = birthdayOption ? basisForOneCardCount(Number(birthdayOption.freePasses), combo) : data.basis;
      if (!Number.isFinite(basis) || basis <= 0) throw new Error("INVALID_REWARD");

      const now = new Date().toISOString();
      const passRef = userRef.collection(COUNT_PASSES).doc();
      tx.set(passRef, {
        source: data.source,
        basis,
        remaining: 1,
        usedCount: 0,
        combo,
        allowances: countAllowancesForCombo(basis, combo),
        status: "unused",
        createdAt: now,
        expiresAt: addMonthsClamped(now, COUNT_PASS_VALIDITY_MONTHS),
      });
      tx.update(rewardRef, {
        status: "claimed",
        claimedAt: now,
        claimedComboAndPassId: { combo, passId: passRef.id },
      });
      return passRef.id;
    });
    return NextResponse.json({ passId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "NOT_FOUND") return NextResponse.json({ error: "받은 이용권을 찾을 수 없어요." }, { status: 404 });
    if (message === "ALREADY_RESOLVED") return NextResponse.json({ error: "이미 처리된 이용권이에요." }, { status: 409 });
    if (message === "EXPIRED") return NextResponse.json({ error: "수령 가능 기간이 지났어요." }, { status: 410 });
    if (message === "SUSPENDED") {
      const { reason, suspendedUntil } = error as Error & { reason?: string | null; suspendedUntil?: string | null };
      return NextResponse.json(
        { error: "정지 중에는 보상을 수령할 수 없어요.", code: "SUSPENDED", reason: reason ?? null, suspendedUntil: suspendedUntil ?? null },
        { status: 403 }
      );
    }
    if (message === "NO_BIRTH_TIME") {
      return NextResponse.json(
        { error: "태어난 시간이 입력되어 있지 않아 해당 이용권을 받으실 수 없습니다.", code: "NO_BIRTH_TIME" },
        { status: 409 }
      );
    }
    if (message === "INVALID_REWARD") return NextResponse.json({ error: "이용권 정보가 올바르지 않아요." }, { status: 409 });
    console.error("[pending-rewards/claim] 처리 실패", error);
    return NextResponse.json({ error: "이용권을 받지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
