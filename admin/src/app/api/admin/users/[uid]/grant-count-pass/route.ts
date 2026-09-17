import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getAdminUidFromRequest } from "@/lib/auth/verifyAdminRequest";

type FeatureScope = "tarot-only" | "all-features";

const SPREAD_KEYS = ["one", "three", "dual", "celtic"] as const;

function allowancesFor(count: number, featureScope: FeatureScope): Record<string, number> {
  return Object.fromEntries(
    SPREAD_KEYS.flatMap((spread) =>
      [false, true].flatMap((saju) =>
        [false, true].map((ziwei) => [
          `${spread}-${Number(saju)}-${Number(ziwei)}`,
          featureScope === "all-features" || (!saju && !ziwei) ? count : 0,
        ])
      )
    )
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminUid = await getAdminUidFromRequest(req);
  if (!adminUid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { uid } = await params;
  const { count, featureScope, reason } = (await req.json()) as {
    count?: number;
    featureScope?: FeatureScope;
    reason?: string;
  };
  const trimmedReason = reason?.trim() ?? "";

  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 10_000) {
    return NextResponse.json({ error: "횟수는 1회 이상 10,000회 이하여야 합니다." }, { status: 400 });
  }
  if (featureScope !== "tarot-only" && featureScope !== "all-features") {
    return NextResponse.json({ error: "기능 범위가 올바르지 않습니다." }, { status: 400 });
  }
  if (!trimmedReason || trimmedReason.length > 200) {
    return NextResponse.json({ error: "지급 사유를 1~200자로 입력해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  if (!(await userRef.get()).exists) {
    return NextResponse.json({ error: "존재하지 않는 유저입니다." }, { status: 404 });
  }

  const passRef = userRef.collection("countPasses").doc();
  const createdAt = new Date().toISOString();
  await passRef.set({
    source: "admin-grant",
    productId: null,
    featureScope,
    freePasses: count,
    basis: count * 200,
    remaining: 1,
    allowances: allowancesFor(count, featureScope),
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
    featureScope,
  });
}
