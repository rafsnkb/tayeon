import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

// src/lib/tarot/pricing.ts의 ComboKey/COMBOS/countAllowance와 동일한 값 — admin은 본체와 완전히
// 분리된 별도 앱이라(2026-09-18 이용권 조합 고정 개편, admin/AGENTS.md 참고) 값만 그대로 복사한다.
type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";
const COMBOS: Record<ComboKey, { saju: boolean; ziwei: boolean }> = {
  tarot: { saju: false, ziwei: false },
  "tarot-saju": { saju: true, ziwei: false },
  "tarot-ziwei": { saju: false, ziwei: true },
  "tarot-saju-ziwei": { saju: true, ziwei: true },
};
const SPREAD_COSTS = { one: 200, three: 300, dual: 400, celtic: 500 } as const;

function allowancesForCombo(basis: number, combo: ComboKey): Record<string, number> {
  const { saju, ziwei } = COMBOS[combo];
  const multiplier = saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1;
  return Object.fromEntries(
    Object.entries(SPREAD_COSTS).map(([spread, cost]) => [spread, Math.round(Math.round(basis / cost) * multiplier)])
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const { count, combo, reason } = (await req.json()) as {
    count?: number;
    combo?: ComboKey;
    reason?: string;
  };
  const trimmedReason = reason?.trim() ?? "";

  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10_000) {
    return NextResponse.json({ error: "횟수는 1회 이상 10,000회 이하여야 합니다." }, { status: 400 });
  }
  if (!combo || !(combo in COMBOS)) {
    return NextResponse.json({ error: "이용권 옵션이 올바르지 않습니다." }, { status: 400 });
  }
  if (!trimmedReason || trimmedReason.length > 200) {
    return NextResponse.json({ error: "지급 사유를 1~200자로 입력해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }
  const birthInfo = userSnap.data()?.birthInfo as { birthTime?: string | null; timeUnknown?: boolean } | undefined;
  if (COMBOS[combo].ziwei && (!birthInfo?.birthTime || birthInfo.timeUnknown)) {
    return NextResponse.json({ error: "태어난 시간이 없는 사용자에게는 자미두수 포함 이용권을 지급할 수 없어요." }, { status: 409 });
  }

  const passRef = userRef.collection("countPasses").doc();
  const createdAt = new Date().toISOString();
  const basis = count * 200;
  await passRef.set({
    source: "admin-grant",
    productId: null,
    combo,
    freePasses: count,
    basis,
    remaining: 1,
    allowances: allowancesForCombo(basis, combo),
    status: "unused",
    reason: trimmedReason,
    grantedByUid: adminUid,
    // 로컬 ADC에서는 Firebase Auth의 사용자 조회가 quota-project 설정을 요구한다.
    // 지급 권한은 이미 ID 토큰의 UID allowlist로 검증했으므로 UID만 감사 기록으로 남긴다.
    grantedByEmail: null,
    createdAt,
    expiresAt: null,
  });

  return NextResponse.json({
    passId: passRef.id,
    count,
    combo,
  });
}
