import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { TIME_PASS_PACKAGES } from "@/lib/timePassPackages";
import { isCurrentlyHeld } from "@/lib/userDirectory";

const byProductId = new Map<string, (typeof TIME_PASS_PACKAGES)[number]>(
  TIME_PASS_PACKAGES.map((pkg) => [pkg.id, pkg])
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { uid } = await params;
  const { productId, minutes, includesOptions, priceWon, reason } = (await req.json()) as {
    productId?: string;
    minutes?: number;
    includesOptions?: boolean;
    priceWon?: number;
    reason?: string;
  };

  const selected = typeof productId === "string" ? byProductId.get(productId) : null;
  // 기존 대시보드의 구형 요청은 중단시키지 않되, 새 UI는 productId만 사용한다.
  if (!selected && (!Number.isInteger(minutes) || minutes! <= 0)) {
    return NextResponse.json({ error: "minutes는 양의 정수여야 합니다." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }
  const combo = selected?.combo ?? (includesOptions ? "tarot-saju-ziwei" : "tarot");
  const birthInfo = userSnap.data()?.birthInfo as { birthTime?: string | null; timeUnknown?: boolean } | undefined;
  if ((combo === "tarot-ziwei" || combo === "tarot-saju-ziwei") && (!birthInfo?.birthTime || birthInfo.timeUnknown)) {
    return NextResponse.json({ error: "태어난 시간이 없는 사용자에게는 자미두수 포함 이용권을 지급할 수 없어요." }, { status: 409 });
  }

  // 시간제 이용권은 미사용/사용중인 게 하나라도 있으면 새로 보유할 수 없다(2026-09-18 —
  // "여러 개 보유해두고 하나 활성화" 방식을 없애고 구매/지급 모두 1개 슬롯으로 통일).
  const existingPasses = await userRef.collection("timePasses").get();
  // 예전엔 ["unused","active"] 만 봤다. refund_pending 을 빼먹으면 환불 신청 중인 이용권을
  // "없는 것"으로 보고 보상용을 하나 더 지급하게 되고, 그 환불이 거절되면 원래 것이 unused 로
  // 되살아나 1슬롯 상품을 두 개 들고 있게 된다(2026-09-24). 어드민 목록이 쓰는 판정을 그대로
  // 재사용해서 두 곳이 어긋날 수 없게 한다 — 유효기간 확인도 같이 붙는다.
  if (existingPasses.docs.some((doc) => isCurrentlyHeld(doc.data()))) {
    return NextResponse.json({ error: "이 유저는 이미 미사용/사용중인 시간제 이용권을 보유하고 있습니다." }, { status: 409 });
  }

  const adminUser = await adminAuth.getUser(adminUid);

  const createdAt = new Date().toISOString();
  const usableUntil = new Date();
  usableUntil.setFullYear(usableUntil.getFullYear() + 1);
  const passRef = await userRef.collection("timePasses").add({
    productId: selected ? productId : null,
    source: "admin-grant",
    combo,
    minutes: selected?.minutes ?? minutes,
    includesOptions: combo === "tarot-saju-ziwei",
    priceWon: selected?.priceWon ?? priceWon ?? null,
    status: "unused",
    startedAt: null,
    expiresAt: null,
    reason: reason?.trim() || null,
    grantedByUid: adminUid,
    grantedByEmail: adminUser.email ?? null,
    createdAt,
    // 구매 시간제 이용권과 동일하게 지급 후 1년 안에 활성화하도록 통일한다.
    usableUntil: usableUntil.toISOString(),
  });

  return NextResponse.json({ passId: passRef.id });
}
