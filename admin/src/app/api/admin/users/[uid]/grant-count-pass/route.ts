import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import {
  COMBOS,
  COUNT_PACKAGES,
  COUNT_PASS_VALIDITY_MONTHS,
  countAllowancesForCombo,
  type ComboKey,
} from "@/lib/countPassPackages";

const byProductId = new Map<string, (typeof COUNT_PACKAGES)[number]>(COUNT_PACKAGES.map((pkg) => [pkg.id, pkg]));

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const { productId, count, combo, reason } = (await req.json()) as {
    productId?: string;
    count?: number;
    combo?: ComboKey;
    reason?: string;
  };
  const trimmedReason = reason?.trim() ?? "";

  const selected = typeof productId === "string" ? byProductId.get(productId) : null;
  // 상점과 동일한 상품(productId)을 고르면 그 가격표를 그대로 쓰고, 아니면 기존처럼 임의 횟수를
  // 직접 입력하는 레거시 방식을 허용한다(과거부터 있던 커스텀 지급 요구 — 특정 사건 보상 등).
  if (!selected && (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10_000)) {
    return NextResponse.json({ error: "상품을 선택하거나, 횟수를 1~10,000 사이로 입력해주세요." }, { status: 400 });
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

  const basis = selected ? selected.basis : count! * 200;
  const freePasses = selected ? Math.round(selected.basis / 200) : count!;

  const passRef = userRef.collection("countPasses").doc();
  const createdAt = new Date().toISOString();
  // 상점과 동일한 상품(productId)으로 지급할 땐 실제 구매와 똑같이 12개월 유효기간을 둔다.
  // 레거시 커스텀 지급(직접 입력한 횟수)은 원래부터 만료 없이 지급해온 동작을 그대로 유지한다.
  let expiresAt: string | null = null;
  if (selected) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + COUNT_PASS_VALIDITY_MONTHS);
    expiresAt = expiry.toISOString();
  }
  await passRef.set({
    source: "admin-grant",
    productId: selected ? selected.id : null,
    combo,
    freePasses,
    basis,
    remaining: 1,
    usedCount: 0,
    allowances: countAllowancesForCombo(basis, combo),
    status: "unused",
    priceWon: selected?.priceWon ?? null,
    reason: trimmedReason,
    grantedByUid: adminUid,
    // 로컬 ADC에서는 Firebase Auth의 사용자 조회가 quota-project 설정을 요구한다.
    // 지급 권한은 이미 ID 토큰의 UID allowlist로 검증했으므로 UID만 감사 기록으로 남긴다.
    grantedByEmail: null,
    createdAt,
    expiresAt,
  });

  return NextResponse.json({
    passId: passRef.id,
    productId: selected?.id ?? null,
    freePasses,
    combo,
  });
}
