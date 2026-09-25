// 특정 사용자에게 할인쿠폰을 직접 지급한다 — 이용권 커스텀 지급(grant-count-pass)과 같은 자리다.
//
// **이미 발급된 코드를 그 사람 쿠폰함에 넣어 주는 것**이지, 그 사람만을 위한 새 쿠폰을 만드는
// 것이 아니다. 이용권 지급이 상품표에서 고르는 것과 같은 모양이고, 그래야 "기간이 겹치게
// 발급하지 않는다"는 원칙이 지켜진다 — 개인용 쿠폰을 즉석에서 만들면 진행 중인 캠페인과 기간이
// 겹쳐서 "한 사용자가 쓸 수 있는 쿠폰은 최대 한 장"이라는 전제가 깨진다.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

/** 본체(src/lib/firestore/collections.ts)와 같은 이름이어야 한다 — 별도 앱이라 상수를 공유하지 않는다. */
const DISCOUNT_COUPONS = "discountCoupons";
const USER_DISCOUNT_COUPONS = "discountCoupons";

export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const { code, reason } = (await req.json().catch(() => ({}))) as { code?: unknown; reason?: unknown };
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  if (!normalized) return NextResponse.json({ error: "쿠폰 코드를 선택해주세요." }, { status: 400 });
  if (!trimmedReason || trimmedReason.length > 200) {
    return NextResponse.json({ error: "지급 사유를 1~200자로 입력해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  if (!(await userRef.get()).exists) {
    return NextResponse.json({ error: "존재하지 않는 사용자입니다." }, { status: 404 });
  }

  const couponRef = adminDb.collection(DISCOUNT_COUPONS).doc(normalized);
  const heldRef = userRef.collection(USER_DISCOUNT_COUPONS).doc(normalized);

  const result = await adminDb.runTransaction(async (tx): Promise<{ ok: true; name: string; discountPercent: number; endsAt: string } | { ok: false; error: string; status: number }> => {
    const [couponSnap, heldSnap] = await Promise.all([tx.get(couponRef), tx.get(heldRef)]);
    if (!couponSnap.exists) return { ok: false, error: "존재하지 않는 코드입니다.", status: 404 };
    if (heldSnap.exists) return { ok: false, error: "이 사용자는 이미 이 쿠폰을 보유하고 있습니다.", status: 409 };

    const data = couponSnap.data() ?? {};
    const discountRate = Number(data.discountRate ?? 0);
    const startsAt = String(data.startsAt ?? "");
    const endsAt = String(data.endsAt ?? "");
    const name = typeof data.name === "string" ? data.name : "";
    if (!(discountRate > 0)) return { ok: false, error: "할인율이 올바르지 않은 쿠폰입니다.", status: 409 };

    const ends = Date.parse(endsAt);
    if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(ends)) {
      return { ok: false, error: "유효기간이 올바르지 않은 쿠폰입니다.", status: 409 };
    }
    // 이미 끝난 쿠폰을 지급해 봐야 쓸 수 없다 — 쿠폰함에 "기간 만료"로 들어갈 뿐이다.
    if (Date.now() > ends) return { ok: false, error: "이미 유효기간이 지난 쿠폰입니다.", status: 409 };

    // 선착순 상한은 **넘겨서 지급한다** — 운영자가 개별 사정을 보고 주는 것이라 마감이 이유가
    // 되면 안 된다. 다만 카운터는 올려서 실제 발급 수와 어긋나지 않게 한다(현황 화면의 잔여
    // 수량은 0 에서 멈춘다).
    tx.set(heldRef, {
      name,
      discountRate,
      startsAt,
      endsAt,
      status: "unused",
      usedPaymentId: null,
      usedAt: null,
      registeredAt: new Date().toISOString(),
      // 사용자가 코드를 입력해 받은 것과 구분한다 — 문의가 왔을 때 경위를 되짚을 수 있어야 한다.
      source: "admin-grant",
      reason: trimmedReason,
      grantedByUid: adminUid,
    });
    tx.update(couponRef, { registeredCount: FieldValue.increment(1) });
    return { ok: true, name, discountPercent: Math.round(discountRate * 100), endsAt };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ code: normalized, name: result.name, discountPercent: result.discountPercent, endsAt: result.endsAt });
}
