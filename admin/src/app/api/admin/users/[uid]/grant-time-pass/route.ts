import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

type ComboKey = "tarot" | "tarot-saju" | "tarot-ziwei" | "tarot-saju-ziwei";
const TIME_PRODUCTS = [
  ["timepass-tarot-15", "tarot", 15, 8900], ["timepass-tarot-30", "tarot", 30, 12900], ["timepass-tarot-60", "tarot", 60, 19900],
  ["timepass-saju-15", "tarot-saju", 15, 12900], ["timepass-saju-30", "tarot-saju", 30, 19900], ["timepass-saju-60", "tarot-saju", 60, 24900],
  ["timepass-ziwei-15", "tarot-ziwei", 15, 19900], ["timepass-ziwei-30", "tarot-ziwei", 30, 24900], ["timepass-ziwei-60", "tarot-ziwei", 60, 39900],
  ["timepass-all-15", "tarot-saju-ziwei", 15, 24900], ["timepass-all-30", "tarot-saju-ziwei", 30, 39900], ["timepass-all-60", "tarot-saju-ziwei", 60, 65900],
] as const;
const byProductId = new Map(TIME_PRODUCTS.map(([id, combo, minutes, priceWon]) => [id, { combo: combo as ComboKey, minutes, priceWon }]));

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

  const selected = typeof productId === "string" ? byProductId.get(productId as (typeof TIME_PRODUCTS)[number][0]) : null;
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
  if (existingPasses.docs.some((doc) => ["unused", "active"].includes(doc.data().status))) {
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
