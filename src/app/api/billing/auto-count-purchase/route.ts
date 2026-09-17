import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { AUTO_COUNT_PURCHASE_DOC } from "@/lib/payment/autoCountPurchase";
import { resolveProduct } from "@/lib/payment/products";

function configRef(uid: string) {
  return adminDb.collection("users").doc(uid).collection("settings").doc(AUTO_COUNT_PURCHASE_DOC);
}

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRef = adminDb.collection("users").doc(uid);
  const [configSnap, keysSnap] = await Promise.all([
    configRef(uid).get(),
    userRef.collection("billingKeys").orderBy("createdAt", "desc").get(),
  ]);
  const config = configSnap.data() ?? {};
  const billingKeys = keysSnap.docs
    .filter((key) => key.data().status === "active")
    .map((key) => ({
      id: key.id,
      cardLabel: key.data().cardLabel ?? null,
      maskedNumber: key.data().maskedNumber ?? null,
    }));

  return NextResponse.json({
    autoPurchase: {
      active: config.status === "active",
      productId: config.productId ?? null,
      billingKeyId: config.billingKeyId ?? null,
      lastError: config.lastError ?? null,
    },
    billingKeys,
  });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { action?: "save" | "disable"; productId?: string; billingKeyId?: string };
  if (body.action === "disable") {
    await configRef(uid).set(
      { status: "inactive", disabledAt: new Date().toISOString(), purchaseLockAt: null },
      { merge: true }
    );
    return NextResponse.json({ active: false });
  }

  const product = resolveProduct(body.productId);
  if (!product || product.type !== "countPass") {
    return NextResponse.json({ error: "자동결제할 횟수제 이용권을 선택해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const keysSnap = await userRef.collection("billingKeys").orderBy("createdAt", "desc").get();
  const activeKeys = keysSnap.docs.filter((key) => key.data().status === "active");
  const billingKey = activeKeys.find((key) => key.id === body.billingKeyId) ?? activeKeys[0];
  if (!billingKey) {
    return NextResponse.json({ error: "자동결제용 카드를 먼저 등록해주세요." }, { status: 409 });
  }

  await configRef(uid).set(
    {
      status: "active",
      productId: product.productId,
      billingKeyId: billingKey.id,
      consentedAt: new Date().toISOString(),
      consentVersion: "2026-09-auto-count-purchase-v1",
      lastError: null,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return NextResponse.json({ active: true, productId: product.productId, billingKeyId: billingKey.id });
}
