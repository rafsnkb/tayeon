import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { SPREADS, type SpreadKey } from "@/lib/tarot/pricing";

const ROOM_LIMIT = 30;
const READINGS_PER_ROOM = 20;
const ENTRY_LIMIT = 50;

type UsageEntry = {
  kind: "usage";
  roomTitle: string;
  spread: SpreadKey;
  spreadLabel: string;
  includeSaju: boolean;
  includeZiwei: boolean;
  includeCompatibility: boolean;
  cost: number;
  timePassApplied: boolean;
  countPassApplied: boolean;
  createdAt: string;
};

type RewardEntry = {
  kind: "reward";
  label: string;
  freePasses: number | null;
  coins: number | null;
  createdAt: string;
};

// payoutKey는 "yyyy-mm"(정산 대상 월, functions/src/index.ts 참고) — 표시용으로 월 숫자만 뽑는다.
function monthLabelFromPayoutKey(payoutKey: string): string {
  const month = Number(payoutKey.split("-")[1]);
  return Number.isFinite(month) ? String(month) : "?";
}

/** 피그마 "Screen / UsingHistory"("이용 내역") — 이용권 사용 내역과 들어온 리워드
 * 지급 내역(보너스 리워드/친구 결제 리워드)을 합쳐 시간순으로 보여준다. 유저→방→리딩 순회는
 * admin의 scanReadings와 같은 이유로(커스텀 인덱스 없음) collectionGroup+where 대신 이 방식을 씀. */
export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userRef = adminDb.collection("users").doc(uid);

  const [roomsSnap, bonusPayoutsSnap, referralPayoutsSnap, countPassesSnap] = await Promise.all([
    userRef.collection("rooms").orderBy("updatedAt", "desc").limit(ROOM_LIMIT).get(),
    userRef.collection("bonusRewardPayouts").get(),
    userRef.collection("referralPayouts").get(),
    userRef.collection("countPasses").get(),
  ]);

  const usageEntries: UsageEntry[] = [];
  for (const room of roomsSnap.docs) {
    const readingsSnap = await room.ref
      .collection("readings")
      .orderBy("createdAt", "desc")
      .limit(READINGS_PER_ROOM)
      .get();
    for (const doc of readingsSnap.docs) {
      const data = doc.data();
      if (!data.charged) continue;
      usageEntries.push({
        kind: "usage",
        roomTitle: room.data()?.title ?? "새 대화",
        spread: data.spread,
        spreadLabel: SPREADS[data.spread as SpreadKey]?.label ?? data.spread,
        includeSaju: Boolean(data.includeSaju),
        includeZiwei: Boolean(data.includeZiwei),
        includeCompatibility: Boolean(data.includeCompatibility),
        cost: data.cost ?? 0,
        timePassApplied: Boolean(data.timePassApplied),
        countPassApplied: Boolean(data.countPassId),
        createdAt: data.createdAt,
      });
    }
  }

  const rewardEntries: RewardEntry[] = [
    // 전환 전 코인 정산 이력은 그대로 남긴다. 전환 후 정산은 아래 countPasses에서 표시한다.
    ...bonusPayoutsSnap.docs.filter((doc) => typeof doc.data().freePasses !== "number").map((doc) => ({
      kind: "reward" as const,
      label: `${monthLabelFromPayoutKey(doc.id)}월 결제 리워드`,
      freePasses: typeof doc.data().freePasses === "number" ? doc.data().freePasses : null,
      coins: typeof doc.data().coins === "number" ? doc.data().coins : null,
      createdAt: doc.data().createdAt,
    })),
    ...referralPayoutsSnap.docs.filter((doc) => typeof doc.data().freePasses !== "number").map((doc) => ({
      kind: "reward" as const,
      label: "친구 결제 리워드",
      freePasses: typeof doc.data().freePasses === "number" ? doc.data().freePasses : null,
      coins: typeof doc.data().coins === "number" ? doc.data().coins : null,
      createdAt: doc.data().createdAt,
    })),
    ...countPassesSnap.docs
      .filter((doc) => ["admin-grant", "signup-free", "referral-signup", "bonus-reward", "referral-payout"].includes(doc.data().source))
      .map((doc) => {
        const data = doc.data();
        const label = data.source === "admin-grant"
          ? `관리자 이용권 지급${data.reason ? ` · ${data.reason}` : ""}`
          : data.source === "signup-free"
          ? "첫 가입 체험 이용권"
          : data.source === "referral-signup"
          ? "친구 초대 리워드"
          : data.source === "referral-payout"
            ? "친구 결제 리워드"
            : "결제 리워드";
        return {
          kind: "reward" as const,
          label,
          freePasses: Number(data.freePasses ?? Math.round(Number(data.basis ?? 0) / 200)),
          coins: null,
          createdAt: data.createdAt,
        };
      }),
  ];

  const entries: (UsageEntry | RewardEntry)[] = [...usageEntries, ...rewardEntries];
  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ entries: entries.slice(0, ENTRY_LIMIT) });
}
