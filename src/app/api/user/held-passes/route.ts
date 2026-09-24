import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import {
  COUNT_PACKAGES,
  countAllowancesForCombo,
  rewardAllowancesForCombo,
  type ComboKey,
} from "@/lib/tarot/pricing";
import { USERS, COUNT_PASSES, TIME_PASSES } from "@/lib/firestore/collections";

export type HeldPass = {
  id: string;
  kind: "countPass" | "timePass";
  /** 화면 제목. 구매분은 상품명, 무상 지급분은 "9월 보너스 리워드"처럼 월이 붙는다. */
  title: string;
  combo: ComboKey | "any" | null;
  /** "구입" / "수령" — 날짜 앞에 붙는 말. */
  acquiredLabel: "구입" | "수령";
  acquiredAt: string;
  expiresAt: string | null;
  /** 환불 신청 중이라 잠긴 이용권. 목록에서 빼면 사용자가 자기 이용권을 잃은 줄 안다. */
  refundPending: boolean;
  /** 환불 취소를 부를 때 쓰는 결제 id. 환불 대기분에만 있다. */
  paymentId: string | null;
  /** 횟수제만 — 스프레드별 남은 질문 횟수. */
  allowances: Record<string, number> | null;
  /** 시간제만. */
  minutes: number | null;
};

/** 리워드·운영자 지급분의 제목. 목업(MyPass_Held)은 "9월 보너스 리워드"처럼 월을 앞에 붙인다 —
 *  같은 종류가 매달 쌓이는 목록이라 월이 없으면 어느 것이 어느 것인지 구분되지 않는다. */
function grantTitle(source: string | undefined, acquiredAt: string): string {
  const month = new Date(acquiredAt).getMonth() + 1;
  if (source === "bonus-reward") return month + "월 보너스 리워드";
  if (source === "referral-payout") return month + "월 친구 결제 리워드";
  if (source === "referral-signup") return "친구 초대 리워드";
  if (source === "signup-free") return "첫 가입 체험 이용권";
  if (source === "admin-grant") return "운영자 지급 이용권";
  return "이용권";
}

/**
 * GET /api/user/held-passes — "내 보유 이용권"(목업 MyPass_Held).
 *
 * /api/user/me 도 보유 중인 횟수제·시간제를 내려주지만 그건 앱 전체가 계속 부르는 경로라 이
 * 화면에만 필요한 제목·날짜를 얹지 않는다. 무엇보다 **환불 신청 중인 이용권**은 me 가 의도적으로
 * 빼는 대상이다(쓸 수 없으므로). 여기서는 반대로 반드시 보여야 한다 — 신청해 둔 이용권이 화면
 * 어디에도 없으면 사라진 것처럼 보인다(2026-09-24).
 */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const userRef = adminDb.collection(USERS).doc(uid);
  const [countSnap, timeSnap] = await Promise.all([
    userRef.collection(COUNT_PASSES).get(),
    userRef.collection(TIME_PASSES).get(),
  ]);

  const now = Date.now();
  /** 아직 들고 있는 것인가 — pricing.ts 의 isHeldPass 와 같은 판단. */
  const held = (status: unknown, limit: unknown, remaining?: unknown) => {
    if (status !== "unused" && status !== "active" && status !== "refund_pending") return false;
    if (typeof remaining === "number" && remaining <= 0) return false;
    // 환불 대기분은 기간이 지났어도 남긴다 — 그 건의 돈이 아직 정리되지 않았다.
    if (status === "refund_pending") return true;
    return typeof limit !== "string" || new Date(limit).getTime() > now;
  };

  const counts: HeldPass[] = countSnap.docs
    .filter((doc) => held(doc.data().status, doc.data().expiresAt, doc.data().remaining))
    .map((doc) => {
      const data = doc.data();
      const combo = (data.combo as ComboKey | "any" | undefined) ?? null;
      const product = COUNT_PACKAGES.find((pkg) => pkg.id === data.productId);
      const purchased = data.source === "purchase";
      const remaining = Number(data.remaining ?? 0);
      // 문서에 박힌 allowances 가 지급 시점의 약속이다. 없으면(조합 고정 개편 이전 문서) 규칙으로
      // 되살리되, 구매분과 무상 지급분의 규칙이 다르다는 걸 지킨다.
      const table =
        (data.allowances as Record<string, number> | undefined) ??
        (combo && combo !== "any"
          ? purchased
            ? countAllowancesForCombo(Number(data.basis ?? 0), combo)
            : rewardAllowancesForCombo(Number(data.basis ?? 0), combo)
          : null);
      return {
        id: doc.id,
        kind: "countPass" as const,
        title: product ? product.name + " 이용권" : grantTitle(data.source, String(data.createdAt ?? "")),
        combo,
        acquiredLabel: purchased ? ("구입" as const) : ("수령" as const),
        acquiredAt: String(data.createdAt ?? ""),
        expiresAt: (data.expiresAt as string | null | undefined) ?? null,
        refundPending: data.status === "refund_pending",
        paymentId: data.status === "refund_pending" ? ((data.paymentId as string | undefined) ?? null) : null,
        // remaining 은 0~1 비율이다. 표에는 실제 남은 횟수를 그린다.
        allowances: table
          ? Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Math.round(remaining * Number(v))]))
          : null,
        minutes: null,
      };
    });

  const times: HeldPass[] = timeSnap.docs
    .filter((doc) => held(doc.data().status, doc.data().usableUntil))
    .map((doc) => {
      const data = doc.data();
      const combo = (data.combo as ComboKey | undefined) ?? (data.includesOptions ? "tarot-saju-ziwei" : "tarot");
      const minutes = Number(data.minutes ?? 0);
      return {
        id: doc.id,
        kind: "timePass" as const,
        title: minutes + "분 시간제 이용권",
        combo,
        acquiredLabel: data.source === "admin-grant" ? ("수령" as const) : ("구입" as const),
        acquiredAt: String(data.createdAt ?? ""),
        expiresAt: (data.usableUntil as string | null | undefined) ?? null,
        refundPending: data.status === "refund_pending",
        paymentId: data.status === "refund_pending" ? ((data.paymentId as string | undefined) ?? null) : null,
        allowances: null,
        minutes,
      };
    });

  const passes = [...counts, ...times].sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
  return NextResponse.json({ passes });
}
