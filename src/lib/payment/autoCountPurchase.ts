import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { chargeBillingKey } from "@/lib/payment/billing";
import { fulfillPayment } from "@/lib/payment/fulfill";
import { resolveProduct } from "@/lib/payment/products";

export const AUTO_COUNT_PURCHASE_DOC = "autoCountPurchase";

type AutoPurchaseConfig = {
  status?: "active" | "inactive";
  productId?: string;
  billingKeyId?: string;
  purchaseLockAt?: string;
};

export type AutoCountPurchaseResult =
  | { kind: "purchased" }
  | { kind: "not_configured" | "not_eligible" }
  | { kind: "failed"; message: string };

function hasRemainingCountPass(data: Record<string, unknown>): boolean {
  const expiresAt = typeof data.expiresAt === "string" ? Date.parse(data.expiresAt) : NaN;
  return Number(data.remaining) > 0 && (!Number.isFinite(expiresAt) || expiresAt > Date.now());
}

/**
 * 마지막 유효 이용권이 소진된 뒤에만 선택한 이용권을 한 번 결제한다. 설정 문서의 짧은 잠금은
 * 같은 계정의 동시 요청이 동일한 빌링키를 이중 승인하는 일을 막는다.
 */
export async function attemptAutoCountPurchase(params: {
  uid: string;
  userRef: DocumentReference;
}): Promise<AutoCountPurchaseResult> {
  const configRef = params.userRef.collection("settings").doc(AUTO_COUNT_PURCHASE_DOC);
  const prepared = await adminDb.runTransaction(async (tx) => {
    const [configSnap, passesSnap] = await Promise.all([
      tx.get(configRef),
      tx.get(params.userRef.collection("countPasses")),
    ]);
    const config = configSnap.data() as AutoPurchaseConfig | undefined;
    if (config?.status !== "active" || !config.productId || !config.billingKeyId) return null;
    if (passesSnap.docs.some((pass) => hasRemainingCountPass(pass.data()))) return null;

    const lockedAt = config.purchaseLockAt ? Date.parse(config.purchaseLockAt) : NaN;
    if (Number.isFinite(lockedAt) && Date.now() - lockedAt < 120_000) return "locked" as const;

    const product = resolveProduct(config.productId);
    if (!product || product.type !== "countPass") return "invalid" as const;

    const billingKeySnap = await tx.get(params.userRef.collection("billingKeys").doc(config.billingKeyId));
    if (!billingKeySnap.exists || billingKeySnap.data()?.status !== "active") return "invalid" as const;

    tx.set(configRef, { purchaseLockAt: new Date().toISOString() }, { merge: true });
    return { product, billingKey: billingKeySnap.data()!.billingKey as string };
  });

  if (!prepared) return { kind: "not_eligible" };
  if (prepared === "locked") return { kind: "failed", message: "자동결제를 처리 중이에요. 잠시 후 다시 시도해주세요." };
  if (prepared === "invalid") return { kind: "failed", message: "자동결제 카드 또는 상품 설정을 다시 확인해주세요." };

  try {
    const payment = await chargeBillingKey({
      billingKey: prepared.billingKey,
      orderName: prepared.product.orderName,
      amountWon: prepared.product.priceWon,
      customerId: params.uid,
      customData: { uid: params.uid, productId: prepared.product.productId, autoCountPurchase: true },
    });
    const fulfilled = await fulfillPayment(payment.paymentId, params.uid, "autoPurchase");
    if (fulfilled.kind !== "fulfilled") {
      throw new Error(fulfilled.kind === "rejected" ? fulfilled.reason : "결제 승인을 확인하지 못했어요.");
    }
    await configRef.set(
      {
        purchaseLockAt: FieldValue.delete(),
        lastPurchasedAt: payment.paidAt,
        lastPaymentId: payment.paymentId,
        lastError: null,
      },
      { merge: true }
    );
    return { kind: "purchased" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동결제에 실패했어요.";
    await configRef.set(
      {
        purchaseLockAt: FieldValue.delete(),
        lastFailedAt: new Date().toISOString(),
        lastError: message,
      },
      { merge: true }
    );
    console.error("[billing] 자동 이용권 결제 실패", params.uid, error);
    return { kind: "failed", message: "자동결제에 실패했어요. 등록 카드와 설정을 확인해주세요." };
  }
}
