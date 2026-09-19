import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { buildGreeting } from "@/lib/tarot/greeting";
import { DEFAULT_TONE, isToneKey } from "@/lib/tarot/tone";
import { USERS, ROOMS, READINGS } from "@/lib/firestore/collections";

export async function GET(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const roomId = req.nextUrl.searchParams.get("roomId");
  if (!roomId) {
    return NextResponse.json({ error: "대화방을 선택해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const roomRef = userRef.collection(ROOMS).doc(roomId);
  const snap = await roomRef.collection(READINGS).orderBy("createdAt", "asc").get();

  // 방에 리딩이 하나도 없으면(처음 연 방), 실제 리딩이 아니라 캐릭터가 먼저 건네는 인사말을
  // 합성해서 맨 앞에 끼워 넣는다 — Firestore에 저장하지 않고 매 조회마다 즉석에서 만든다(코인
  // 차감 대상도 아니고, 저장해봐야 안전장치/히스토리 로직에 실제 리딩처럼 섞여 들어갈 위험만
  // 생기므로). /api/tarot/reading이 쓰는 recentReadings는 이 엔드포인트가 아니라 Firestore를
  // 직접 재조회하므로, 여기서 합성해도 LLM에게 넘어가는 대화 히스토리에는 전혀 영향 없다.
  if (snap.empty) {
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const nickname: string = userData?.nickname ?? "당신";
    const tone = isToneKey(userData?.tone) ? userData.tone : DEFAULT_TONE;
    return NextResponse.json({
      readings: buildGreeting(tone, nickname).map((line) => ({
        isGreeting: true,
        question: null,
        spread: null,
        cards: [],
        includeSaju: false,
        includeZiwei: false,
        includeCompatibility: false,
        partnerNickname: null,
        interpretation: line,
        charged: false,
        guidanceOnly: false,
        flaggedForAbuse: false,
        suggestions: [],
      })),
    });
  }

  const readings = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      question: data.question,
      spread: data.spread,
      cards: data.cards,
      includeSaju: Boolean(data.includeSaju),
      includeZiwei: Boolean(data.includeZiwei),
      includeCompatibility: Boolean(data.includeCompatibility),
      partnerNickname: data.partnerNickname ?? null,
      interpretation: data.interpretation,
      charged: data.charged ?? true,
      guidanceOnly: Boolean(data.guidanceOnly),
      flaggedForAbuse: Boolean(data.flaggedForAbuse),
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    };
  });

  return NextResponse.json({ readings });
}
