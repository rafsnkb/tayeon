import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import type { ComboKey } from "@/lib/tarot/pricing";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { passId } = (await req.json()) as { passId?: string };
  if (!passId) {
    return NextResponse.json({ error: "passId가 필요해요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const passRef = userRef.collection("timePasses").doc(passId);

  const userSnapForSuspend = await userRef.get();
  const userDataForSuspend = userSnapForSuspend.data();
  if (userDataForSuspend?.suspended) {
    const suspendedUntilMs = Date.parse(userDataForSuspend.suspendedUntil ?? "");
    if (Number.isFinite(suspendedUntilMs) && suspendedUntilMs <= Date.now()) {
      await userRef.update({ suspended: false, suspendedAt: null, suspendedUntil: null, suspendedReason: null });
    } else {
      return NextResponse.json(
        {
          error: "정지 중에는 이용권을 사용할 수 없어요.",
          code: "SUSPENDED",
          reason: userDataForSuspend.suspendedReason ?? null,
          suspendedUntil: userDataForSuspend.suspendedUntil ?? null,
        },
        { status: 403 }
      );
    }
  }

  // 가드 체크(이미 활성 이용권 있는지/이 이용권이 사용 가능한지)와 두 문서 쓰기를 하나의
  // 트랜잭션으로 묶는다 — 이전엔 각자 따로 읽고 두 update()를 Promise.all로만 묶어서, 동시에
  // "사용하기"를 두 번 누르면 한쪽이 가드 체크를 통과한 직후 다른 쪽이 끼어들어 activeTimePass를
  // 덮어쓸 수 있는 레이스가 있었다(2026-09-18, 카운트패스 활성 포인터를 트랜잭션화하는 김에 같이
  // 정리 — src/lib/tarot/activeCountPass.ts 참고).
  try {
    const nextActiveTimePass = await adminDb.runTransaction(async (tx) => {
      const [userSnap, passSnap] = await Promise.all([tx.get(userRef), tx.get(passRef)]);

      const activeTimePass = userSnap.data()?.activeTimePass as
        | { expiresAt: string }
        | null
        | undefined;
      if (activeTimePass && new Date(activeTimePass.expiresAt).getTime() > Date.now()) {
        throw new Error("ALREADY_ACTIVE");
      }

      if (!passSnap.exists || passSnap.data()?.status !== "unused") {
        throw new Error("UNUSABLE");
      }

      const usableUntil = passSnap.data()?.usableUntil;
      if (typeof usableUntil === "string" && new Date(usableUntil).getTime() <= Date.now()) {
        tx.update(passRef, { status: "expired" });
        throw new Error("EXPIRED");
      }

      const passData = passSnap.data() as { minutes: number; combo?: ComboKey; includesOptions?: boolean };
      const { minutes } = passData;
      // 레거시 문서(2026-09-19 조합 개편 이전 구매분)는 combo가 없고 includesOptions만 있다.
      const combo: ComboKey = passData.combo ?? (passData.includesOptions ? "tarot-saju-ziwei" : "tarot");

      const startedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const result = { passId, minutes, combo, startedAt, expiresAt };

      tx.update(passRef, { status: "active", startedAt, expiresAt });
      tx.update(userRef, { activeTimePass: result });

      return result;
    });

    return NextResponse.json({ activeTimePass: nextActiveTimePass });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "ALREADY_ACTIVE") {
      return NextResponse.json({ error: "이미 활성화된 이용권이 있어요. 만료 후 다시 시도해주세요." }, { status: 409 });
    }
    if (message === "UNUSABLE") {
      return NextResponse.json({ error: "사용할 수 없는 이용권이에요." }, { status: 400 });
    }
    if (message === "EXPIRED") {
      return NextResponse.json({ error: "이용권 유효기간이 만료됐어요." }, { status: 410 });
    }
    throw error;
  }
}
