// 할인쿠폰 발급과 발급 현황.
//
// 쿠폰은 **운영자가 뿌리는 공용 코드**다(추천인 코드와 다르다 — 그건 사용자마다 자기 코드다).
// 같은 코드를 여러 사람이 등록하되, 한 사람은 한 번만 등록할 수 있다.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";
import { validateCouponIssue, findOverlapping } from "@/lib/discountCouponRules";

/** 본체(src/lib/firestore/collections.ts 의 DISCOUNT_COUPONS)와 같은 이름이어야 한다 —
 *  admin 은 별도 앱이라 상수를 공유하지 않는다. */
const DISCOUNT_COUPONS = "discountCoupons";

type StoredCoupon = {
  code: string;
  name: string;
  discountRate: number;
  startsAt: string;
  endsAt: string;
  maxRegistrations: number | null;
  registeredCount: number;
  disabled?: boolean;
  createdAt: string;
  createdByUid?: string | null;
};

function readCoupon(id: string, data: FirebaseFirestore.DocumentData): StoredCoupon {
  return {
    code: id,
    name: typeof data.name === "string" ? data.name : "",
    discountRate: Number(data.discountRate ?? 0),
    startsAt: String(data.startsAt ?? ""),
    endsAt: String(data.endsAt ?? ""),
    maxRegistrations: typeof data.maxRegistrations === "number" ? data.maxRegistrations : null,
    registeredCount: Number(data.registeredCount ?? 0),
    disabled: data.disabled === true,
    createdAt: String(data.createdAt ?? ""),
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await getAdminUidFromRequest(req))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const snap = await adminDb.collection(DISCOUNT_COUPONS).orderBy("createdAt", "desc").limit(100).get();
  const now = Date.now();
  const coupons = snap.docs.map((doc) => {
    const c = readCoupon(doc.id, doc.data());
    const starts = Date.parse(c.startsAt);
    const ends = Date.parse(c.endsAt);
    // 남은 수량은 화면에 반드시 보여야 한다 — 소진된 뒤에도 "선착순" 문구를 계속 노출하면
    // 기만적 표시가 된다(표시광고법 제3조).
    const remaining = c.maxRegistrations === null ? null : Math.max(0, c.maxRegistrations - c.registeredCount);
    const state = c.disabled
      ? "disabled"
      : remaining === 0
        ? "soldOut"
        : !Number.isFinite(starts) || !Number.isFinite(ends)
          ? "broken"
          : now < starts
            ? "scheduled"
            : now > ends
              ? "expired"
              : "active";
    return { ...c, discountPercent: Math.round(c.discountRate * 100), remaining, state };
  });
  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const checked = validateCouponIssue({
    code: body.code as string,
    name: body.name as string,
    discountPercent: body.discountPercent as number,
    startsAt: body.startsAt as string,
    endsAt: body.endsAt as string,
    maxRegistrations: (body.maxRegistrations ?? null) as number | null,
  });
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const value = checked.value;

  // 기간 겹침 검사와 발급을 한 트랜잭션에 묶는다. 나눠 두면 두 창에서 동시에 발급했을 때 둘 다
  // 통과해 겹친 쿠폰이 생기고, 그러면 "한 사용자가 쓸 수 있는 쿠폰은 최대 한 장"이라는 전제가
  // 깨진다 — 그 전제 위에 구매 화면과 적용 로직이 서 있다(discountCouponRules.ts 주석 참고).
  const result = await adminDb.runTransaction(async (tx): Promise<{ ok: true } | { ok: false; error: string; status: number }> => {
    const ref = adminDb.collection(DISCOUNT_COUPONS).doc(value.code);
    const [existingSnap, allSnap] = await Promise.all([tx.get(ref), tx.get(adminDb.collection(DISCOUNT_COUPONS))]);
    if (existingSnap.exists) {
      return { ok: false, error: "이미 존재하는 코드입니다.", status: 409 };
    }
    const overlapping = findOverlapping(
      allSnap.docs.map((doc) => readCoupon(doc.id, doc.data())),
      { startsAt: value.startsAt, endsAt: value.endsAt }
    );
    if (overlapping) {
      return {
        ok: false,
        error: `유효기간이 "${overlapping.name || overlapping.code}"(${overlapping.code}) 와 겹칩니다. 쿠폰은 기간이 겹치지 않게 발급해주세요.`,
        status: 409,
      };
    }

    tx.set(ref, {
      name: value.name,
      discountRate: value.discountRate,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      maxRegistrations: value.maxRegistrations,
      registeredCount: 0,
      disabled: false,
      createdAt: new Date().toISOString(),
      createdByUid: adminUid,
    });
    return { ok: true };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ code: value.code, name: value.name, discountPercent: Math.round(value.discountRate * 100) }, { status: 201 });
}

/** 발급한 쿠폰을 비활성화한다. 지우지 않는 이유는 이미 등록한 사람의 보유분이 남아 있어서다 —
 *  보유분은 등록 시점 조건을 복사해 두므로 계속 쓸 수 있고, 새로 등록만 막힌다. */
export async function PATCH(req: NextRequest) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { code, disabled } = (await req.json().catch(() => ({}))) as { code?: unknown; disabled?: unknown };
  if (typeof code !== "string" || !code || typeof disabled !== "boolean") {
    return NextResponse.json({ error: "코드와 상태를 확인해주세요." }, { status: 400 });
  }
  const ref = adminDb.collection(DISCOUNT_COUPONS).doc(code.trim().toUpperCase());
  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: "존재하지 않는 코드입니다." }, { status: 404 });
  }
  await ref.update({ disabled, updatedAt: new Date().toISOString(), updatedByUid: adminUid });
  return NextResponse.json({ code: ref.id, disabled });
}
