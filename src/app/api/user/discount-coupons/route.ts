// 사용자가 할인쿠폰 코드를 등록하고, 보유분을 조회하는 곳.
//
// 쿠폰은 **쿠폰 하나당 사용자 한 명이 한 번만** 등록할 수 있다(사용자 결정, 2026-09-25).
// AAA 를 등록한 사람이 AAA 를 다시 넣으면 "이미 적용된 코드입니다."이고, 나중에 나온 BBB 는
// 별개라 또 한 번 등록할 수 있다.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { blockIfSuspended } from "@/lib/auth/suspension";
import { USERS, DISCOUNT_COUPONS, USER_DISCOUNT_COUPONS, PAYMENTS } from "@/lib/firestore/collections";
import { COMBOS, isComboKey } from "@/lib/tarot/pricing";
import { normalizeCouponCode, couponShelfState, type HeldDiscountCoupon } from "@/lib/payment/discountCoupon";

/** 등록 실패 사유. 문구는 화면에 그대로 나간다 — 사용자 결정으로 재등록만 따로 구분한다. */
const MESSAGES = {
  malformed: "쿠폰 코드를 다시 확인해주세요.",
  notFound: "존재하지 않는 코드입니다.",
  alreadyRegistered: "이미 적용된 코드입니다.",
  expired: "유효기간이 지난 코드입니다.",
  notStarted: "아직 사용할 수 없는 코드입니다.",
  soldOut: "선착순이 마감된 코드입니다.",
} as const;

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const snap = await adminDb.collection(USERS).doc(uid).collection(USER_DISCOUNT_COUPONS).get();
  const nowIso = new Date().toISOString();

  // 쿠폰함 노출 규칙(사용자 결정, 2026-09-25):
  //   사용 가능 — 유효기간 동안
  //   사용 완료 — 결제와 묶여 있으므로 무기한
  //   기간 만료 — 30 일 뒤 삭제
  const purge: string[] = [];
  const coupons = snap.docs.flatMap((doc) => {
    const data = doc.data();
    const held: HeldDiscountCoupon = {
      code: doc.id,
      discountRate: Number(data.discountRate ?? 0),
      startsAt: String(data.startsAt ?? ""),
      endsAt: String(data.endsAt ?? ""),
      status: data.status === "used" ? "used" : "unused",
    };
    const state = couponShelfState(held, nowIso);
    if (state === "purgeable") {
      purge.push(doc.id);
      return [];
    }
    return [{
      ...held,
      name: typeof data.name === "string" ? data.name : "",
      state,
      usable: state === "usable",
      registeredAt: data.registeredAt ?? null,
      usedAt: data.usedAt ?? null,
      usedPaymentId: typeof data.usedPaymentId === "string" ? data.usedPaymentId : null,
    }];
  });

  // 보관 기간이 지난 사본은 여기서 지운다. 스케줄 함수를 따로 두지 않는 이유는, 지울 대상이
  // 그 사용자의 쿠폰함을 열 때만 의미가 있고 문서도 작기 때문이다 — 한 번도 안 열어 본 사람의
  // 사본이 남는 것은 무해하다(캠페인 기록은 어차피 최상위 문서에 따로 있다).
  //
  // 응답을 막지 않는다. 삭제가 실패해도 목록에는 이미 안 보이고, 다음 조회 때 다시 시도된다.
  if (purge.length > 0) {
    const batch = adminDb.batch();
    const userCoupons = adminDb.collection(USERS).doc(uid).collection(USER_DISCOUNT_COUPONS);
    for (const code of purge) batch.delete(userCoupons.doc(code));
    void batch.commit().catch((error) => console.error("[coupon] 만료 쿠폰 정리 실패", uid, purge, error));
  }

  // 사용 완료 쿠폰은 "무엇에 썼는지"를 같이 보여준다(목업 Coupon_List). 결제 문서에서 상품명과
  // 조합을 읽는다 — 쓴 쿠폰은 많아야 몇 건이라 건별 조회로 충분하고, 없는 결제(예: 정리된
  // 오래된 건)는 조용히 비워 둔다.
  const userPayments = adminDb.collection(USERS).doc(uid).collection(PAYMENTS);
  const withProduct = await Promise.all(
    coupons.map(async (coupon) => {
      if (coupon.status !== "used" || !coupon.usedPaymentId) return { ...coupon, usedProduct: null };
      const snap = await userPayments.doc(coupon.usedPaymentId).get().catch(() => null);
      const payment = snap?.exists ? snap.data() : null;
      if (!payment) return { ...coupon, usedProduct: null };
      return {
        ...coupon,
        usedProduct: {
          orderName: typeof payment.orderName === "string" ? payment.orderName : null,
          comboLabel: isComboKey(payment.combo) ? COMBOS[payment.combo].label : null,
        },
      };
    })
  );

  return NextResponse.json({ coupons: withProduct });
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRef = adminDb.collection(USERS).doc(uid);
  const userSnap = await userRef.get();
  const suspended = await blockIfSuspended(userRef, userSnap.data(), "정지 중에는 쿠폰을 등록할 수 없어요.");
  if (suspended) return suspended;

  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = normalizeCouponCode(body.code);
  if (!code) return NextResponse.json({ error: MESSAGES.malformed }, { status: 400 });

  const couponRef = adminDb.collection(DISCOUNT_COUPONS).doc(code);
  const heldRef = userRef.collection(USER_DISCOUNT_COUPONS).doc(code);

  // 선착순 카운터를 정확히 지키려면 "남았는지 확인"과 "한 자리 차지"가 한 트랜잭션이어야 한다.
  // 나눠 놓으면 마감 직전에 동시에 들어온 요청이 전부 통과해 N+α 명이 받는다.
  //
  // 선착순은 **등록** 기준이다(구매가 아니라) — 그래서 여기서 세고, 구매·환불은 이 수를
  // 건드리지 않는다.
  const result = await adminDb.runTransaction(async (tx): Promise<{ ok: true; discountRate: number; endsAt: string } | { ok: false; message: string; status: number }> => {
    const [couponSnap, heldSnap] = await Promise.all([tx.get(couponRef), tx.get(heldRef)]);
    if (!couponSnap.exists) return { ok: false, message: MESSAGES.notFound, status: 404 };

    // 재등록은 **다른 어떤 사유보다 먼저** 본다. 마감·만료된 코드를 다시 넣었을 때 "이미
    // 적용된 코드"라고 알려주는 편이, 이미 내 것이 된 쿠폰을 "마감됐다"고 하는 것보다 맞다.
    if (heldSnap.exists) return { ok: false, message: MESSAGES.alreadyRegistered, status: 409 };

    const data = couponSnap.data() ?? {};
    const discountRate = Number(data.discountRate ?? 0);
    const startsAt = String(data.startsAt ?? "");
    const endsAt = String(data.endsAt ?? "");
    const maxRegistrations = typeof data.maxRegistrations === "number" ? data.maxRegistrations : null;
    const registeredCount = Number(data.registeredCount ?? 0);

    // 비활성화한 코드는 "없는 코드"와 같이 다룬다 — 존재 여부를 알려 줄 이유가 없다.
    if (data.disabled === true) return { ok: false, message: MESSAGES.notFound, status: 404 };
    if (!(discountRate > 0)) return { ok: false, message: MESSAGES.notFound, status: 404 };

    const now = Date.now();
    const starts = Date.parse(startsAt);
    const ends = Date.parse(endsAt);
    if (!Number.isFinite(starts) || !Number.isFinite(ends)) {
      console.error("[coupon] 기간이 깨진 쿠폰", code, { startsAt, endsAt });
      return { ok: false, message: MESSAGES.notFound, status: 404 };
    }
    if (now < starts) return { ok: false, message: MESSAGES.notStarted, status: 409 };
    if (now > ends) return { ok: false, message: MESSAGES.expired, status: 409 };
    if (maxRegistrations !== null && registeredCount >= maxRegistrations) {
      return { ok: false, message: MESSAGES.soldOut, status: 409 };
    }

    // 발급 시점 조건을 복사해 둔다 — 구매할 때 최상위 문서를 다시 읽지 않아도 되고, 나중에
    // 운영자가 조건을 고쳐도 이미 받은 사람의 조건이 소급해 바뀌지 않는다.
    tx.set(heldRef, {
      name: typeof data.name === "string" ? data.name : "",
      discountRate,
      startsAt,
      endsAt,
      status: "unused",
      usedPaymentId: null,
      usedAt: null,
      registeredAt: new Date().toISOString(),
    });
    tx.update(couponRef, { registeredCount: FieldValue.increment(1) });
    return { ok: true, discountRate, endsAt };
  });

  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ code, discountRate: result.discountRate, endsAt: result.endsAt });
}
