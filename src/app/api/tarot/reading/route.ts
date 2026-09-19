import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { anthropic } from "@/lib/anthropic";
import { adminDb } from "@/lib/firebase/admin";
import { getUidFromRequest } from "@/lib/auth/verifyRequest";
import { drawCards } from "@/lib/tarot/draw";
import {
  buildTarotSystemPrompt,
  NO_CHARGE_MARKER,
  GUIDANCE_MARKER,
  HISTORY_SUMMARY_MARKER,
  TOPIC_MARKER,
  TOPIC_CATEGORIES,
  SUGGESTIONS_MARKER,
} from "@/lib/tarot/prompt";
import {
  SPREADS,
  isSpreadKey,
  SAJU_ADD_ON_COST,
  ZIWEI_ADD_ON_COST,
  COMPATIBILITY_ADD_ON_COST,
  COMBOS,
  type CountPassBalance,
  type ComboKey,
} from "@/lib/tarot/pricing";
import { pickActiveCountPass, deriveIncludeOptions, chargeActiveCountPass } from "@/lib/tarot/activeCountPass";
import { DEFAULT_TONE, isToneKey, type ToneKey } from "@/lib/tarot/tone";
import { calculateSaju, buildSajuPromptBlock, type SajuResult } from "@/lib/saju/calculate";
import { calculateZiwei, buildZiweiPromptBlock, type ZiweiResult } from "@/lib/ziwei/calculate";
import { isValidBirthInfo, type BirthInfo } from "@/lib/tarot/birthInfo";
import { isValidPartner, partnerToBirthInfo } from "@/lib/tarot/partner";
import type { DocumentReference } from "firebase-admin/firestore";
import { USERS, ROOMS, READINGS, COUNT_PASSES } from "@/lib/firestore/collections";

// 궁합 옵션이 꺼진 채 상대방 관계를 묻는 질문을 서버가 결정적으로 차단할 때(LLM 호출 없음) 쓰는
// 안내 문구 — 사용자가 고른 AI 말투(tone)에 맞춰 4종으로 나눠서, 획일적인 시스템 메시지처럼
// 느껴지지 않도록 함(2026-09-12).
const GUIDANCE_NO_COMPATIBILITY: Record<ToneKey, (nickname: string) => string> = {
  warm: (nickname) =>
    `${nickname}님과의 궁합을 정확히 보고 싶으신 거죠? 지금은 상대방 사주 정보가 없어서 마음까지 깊이 헤아리기가 어려워요. 메뉴의 궁합 상대 정보에서 생년월일을 저장하고 +궁합 옵션을 함께 켜주시면, 두 분의 흐름을 더 정성껏 봐드릴게요.`,
  direct: (nickname) =>
    `지금 상태로는 ${nickname}이랑 궁합까진 못 봐. 메뉴 궁합 상대 정보에 생년월일부터 넣고 +궁합 옵션 켜 — 그래야 제대로 나와.`,
  mystical: (nickname) =>
    `${nickname}님과의 인연을 온전히 읽으려면, 그 분의 운명이 새겨진 생년월일이 필요합니다. 메뉴의 궁합 상대 정보에 기록을 남기고 +궁합의 문을 함께 열어주세요. 그때 비로소 두 분을 잇는 실이 보일 거예요.`,
  friendly: (nickname) =>
    `${nickname}이랑 궁합 보려면 그 사람 생년월일도 있어야 돼! 메뉴 궁합 상대 정보에 저장하고 +궁합 옵션 켜줘봐, 그래야 제대로 봐줄 수 있어.`,
};

// 한 유저가 동시에 여러 리딩 요청을 병렬로 보낼 수 없도록 거는 락. 앱 UI는 이미 응답이 올 때까지
// 버튼을 막아서(disabled={loading}, src/app/(app)/tarot/page.tsx) 요청이 항상 순차적인데, 순차
// 요청은 모델 생성 속도(Haiku 4.5 ~85토큰/초)에 의해 비용이 자연히 제한된다 — 15분을 꽉 채워
// 쉬지 않고 순차 생성해도 이론상 최대 수백 원 수준. 하지만 API를 직접 두드려서 같은 토큰으로
// 병렬 요청을 여러 개 동시에 보내면 그 속도 한계를 배수로 뚫어버릴 수 있어서(예: 20개 동시 요청
// = 20배속 토큰 생성), 서버에서 유저당 동시 요청 1건으로 강제한다(2026-09-13).
const READING_LOCK_STALE_MS = 60_000; // 서버가 도중에 죽어서 락을 못 지운 경우를 위한 안전장치

// 비용 방어(2026-09-19): 유효한 이용권만 있으면 순차 반복 호출로 Anthropic 비용을 무제한
// 유발할 수 있어서, 동시요청 락과 별개로 UID 기준 분당/일당 리딩 시작 횟수와 질문 길이를
// 서버에서 강제한다. 후보값(질문 1,000자, 분당 10회, 일 100회)은 doc/작업현황.md "비용 방어"
// 절 기준 — 확정치 아님, 실사용 로그 보고 조정 가능하도록 상수화만 해둔다.
const READING_QUESTION_MAX_LENGTH = 1000;
const READING_RATE_LIMIT_PER_MINUTE = 10;
const READING_RATE_LIMIT_PER_DAY = 100;
const RATE_LIMIT_MINUTE_MS = 60_000;
const RATE_LIMIT_DAY_MS = 24 * 60 * 60 * 1000;

const READING_MODEL = "claude-haiku-4-5";
const READING_MAX_OUTPUT_TOKENS = 8192;
// 카드/사주·자미두수 안전장치 실패 시 재생성을 시도하는 최대 횟수(2026-09-12, 2→3회로 확대) —
// 실패했을 때만 추가 API 호출이 발생하므로 정상 응답엔 비용·지연 영향 없음.
const MAX_GENERATE_ATTEMPTS = 3;
// charged:false 리딩은 히스토리 대상에서 제외하므로, 최근 항목 중 일부가 그런 경우에도 여전히
// HISTORY_CONTEXT_SIZE만큼의 "실제 리딩" 맥락을 확보하기 위해 넉넉히 조회한다.
const HISTORY_FETCH_LIMIT = 12;
const HISTORY_CONTEXT_SIZE = 6;

type ReadingLockResult =
  | { ok: true }
  | { ok: false; reason: "locked" }
  | { ok: false; reason: "rate_limited"; scope: "minute" | "day"; retryAfterSeconds: number };

// 동시요청 락 획득과 분당/일당 리딩 카운터 증가를 한 트랜잭션에서 함께 처리한다 — 두 번의
// 읽기-쓰기 왕복 대신 하나로 묶어 레이스 컨디션 없이 원자적으로 판단한다. 카운터는 고정 윈도우
// 방식(fixed window)이라 윈도우 경계에서 이론상 살짝 더 몰릴 수 있지만, 목적이 완벽한 레이트리밋이
// 아니라 순차 반복 호출로 인한 비용 폭주 방지이므로 충분하다.
async function acquireReadingLock(userRef: DocumentReference): Promise<ReadingLockResult> {
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() ?? {};
    const now = Date.now();

    const lockAt = data.readingLockAt as string | undefined;
    if (lockAt && now - new Date(lockAt).getTime() < READING_LOCK_STALE_MS) {
      return { ok: false, reason: "locked" };
    }

    const minuteWindowStart = data.readingRateMinuteWindowStart
      ? new Date(data.readingRateMinuteWindowStart as string).getTime()
      : 0;
    const minuteExpired = now - minuteWindowStart >= RATE_LIMIT_MINUTE_MS;
    const minuteCount = Number(data.readingRateMinuteCount ?? 0);
    if (!minuteExpired && minuteCount >= READING_RATE_LIMIT_PER_MINUTE) {
      const retryAfterSeconds = Math.max(1, Math.ceil((minuteWindowStart + RATE_LIMIT_MINUTE_MS - now) / 1000));
      return { ok: false, reason: "rate_limited", scope: "minute", retryAfterSeconds };
    }

    const dayWindowStart = data.readingRateDayWindowStart
      ? new Date(data.readingRateDayWindowStart as string).getTime()
      : 0;
    const dayExpired = now - dayWindowStart >= RATE_LIMIT_DAY_MS;
    const dayCount = Number(data.readingRateDayCount ?? 0);
    if (!dayExpired && dayCount >= READING_RATE_LIMIT_PER_DAY) {
      const retryAfterSeconds = Math.max(1, Math.ceil((dayWindowStart + RATE_LIMIT_DAY_MS - now) / 1000));
      return { ok: false, reason: "rate_limited", scope: "day", retryAfterSeconds };
    }

    tx.update(userRef, {
      readingLockAt: new Date(now).toISOString(),
      readingRateMinuteWindowStart: new Date(minuteExpired ? now : minuteWindowStart).toISOString(),
      readingRateMinuteCount: minuteExpired ? 1 : minuteCount + 1,
      readingRateDayWindowStart: new Date(dayExpired ? now : dayWindowStart).toISOString(),
      readingRateDayCount: dayExpired ? 1 : dayCount + 1,
    });
    return { ok: true };
  });
}

async function releaseReadingLock(userRef: DocumentReference): Promise<void> {
  await userRef.update({ readingLockAt: FieldValue.delete() }).catch(() => {});
}

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { question, spread, roomId, includeCompatibility } = (await req.json()) as {
    question?: string;
    spread?: string;
    roomId?: string;
    includeCompatibility?: boolean;
  };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }
  if (question.length > READING_QUESTION_MAX_LENGTH) {
    return NextResponse.json(
      { error: `질문은 최대 ${READING_QUESTION_MAX_LENGTH}자까지 입력할 수 있어요.` },
      { status: 400 }
    );
  }
  const safeQuestion: string = question;
  if (!isSpreadKey(spread)) {
    return NextResponse.json({ error: "스프레드를 선택해주세요." }, { status: 400 });
  }
  if (!roomId) {
    return NextResponse.json({ error: "대화방을 선택해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection(USERS).doc(uid);
  const roomRef = userRef.collection(ROOMS).doc(roomId);

  const lockResult = await acquireReadingLock(userRef);
  if (!lockResult.ok) {
    if (lockResult.reason === "locked") {
      return NextResponse.json(
        { error: "이전 질문에 대한 답변을 생성 중이에요. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      {
        error:
          lockResult.scope === "minute"
            ? "짧은 시간에 너무 많은 리딩 요청을 보냈어요. 잠시 후 다시 시도해주세요."
            : "오늘 이용 가능한 리딩 요청 횟수를 모두 사용했어요. 내일 다시 시도해주세요.",
        code: "RATE_LIMITED",
        retryAfterSeconds: lockResult.retryAfterSeconds,
      },
      { status: 429, headers: { "Retry-After": String(lockResult.retryAfterSeconds) } }
    );
  }

  try {
    const [userSnap, roomSnap] = await Promise.all([userRef.get(), roomRef.get()]);

    if (!roomSnap.exists) {
      return NextResponse.json({ error: "존재하지 않는 대화방이에요." }, { status: 404 });
    }

    const userData = userSnap.data();

    if (userData?.suspended) {
      const suspendedUntil = Date.parse(userData.suspendedUntil ?? "");
      if (Number.isFinite(suspendedUntil) && suspendedUntil <= Date.now()) {
        // 기간 정지는 첫 보호 대상 요청에서 원자적으로 정상 상태로 되돌린다.
        await userRef.update({ suspended: false, suspendedAt: null, suspendedUntil: null, suspendedReason: null });
      } else {
        return NextResponse.json(
          {
            error: "이용이 제한된 계정이에요. 고객센터로 문의해주세요.",
            code: "SUSPENDED",
            reason: userData.suspendedReason ?? null,
            suspendedUntil: userData.suspendedUntil ?? null,
          },
          { status: 403 }
        );
      }
    }

    const balance: number = userData?.coins ?? 0;
    const countPassesSnap = await userRef.collection(COUNT_PASSES).get();
    const countPasses = countPassesSnap.docs;
    const rawTone = userData?.tone;
    const tone = isToneKey(rawTone) ? rawTone : DEFAULT_TONE;
    const useReversedCards: boolean = userData?.useReversedCards ?? true;
    const rawBirthInfo = userData?.birthInfo;
    const birthInfo: BirthInfo | null = isValidBirthInfo(rawBirthInfo) ? rawBirthInfo : null;
    const rawPartner = userData?.partner;
    const partner = isValidPartner(rawPartner) ? rawPartner : null;

    const activeTimePass = userData?.activeTimePass as
      | { minutes: number; combo?: ComboKey; includesOptions?: boolean; expiresAt: string }
      | null
      | undefined;
    const timePassActive = Boolean(
      activeTimePass && new Date(activeTimePass.expiresAt).getTime() > Date.now()
    );
    // 시간제 이용권은 2026-09-19부터 횟수제와 동일하게 조합(combo)으로 고정된다 — 레거시 문서
    // (개편 이전 구매분)는 combo가 없고 includesOptions만 있어 그 값으로 폴백한다.
    const timePassCombo: ComboKey | undefined =
      activeTimePass?.combo ?? (activeTimePass ? (activeTimePass.includesOptions ? "tarot-saju-ziwei" : "tarot") : undefined);
    const spreadCovered = timePassActive;

    // 채팅창에서 사주/자미두수를 더 이상 사용자가 고르지 않는다(2026-09-18) — 시간제 이용권이면
    // optionsCovered 여부로, 아니면 활성 이용권(우선순위 큐로 고른 후보)의 고정 조합으로 결정한다.
    // 이용권 자체가 없으면 이후 로직이 의미가 없으므로 여기서 바로 402로 막는다.
    const activePointerPassId = userData?.activeCountPass?.passId as string | undefined;
    const chosenPass = spreadCovered ? undefined : pickActiveCountPass(countPasses, activePointerPassId);
    if (!spreadCovered && !chosenPass) {
      return NextResponse.json(
        { error: "이용 가능한 횟수가 없어요. 이용권을 구입해주세요." },
        { status: 402 }
      );
    }
    const { includeSaju, includeZiwei } = spreadCovered
      ? {
          includeSaju: timePassCombo ? COMBOS[timePassCombo].saju : false,
          includeZiwei: timePassCombo ? COMBOS[timePassCombo].ziwei : false,
        }
      : deriveIncludeOptions(chosenPass?.data() as CountPassBalance | undefined, birthInfo);

    if ((includeSaju || includeZiwei || includeCompatibility) && !birthInfo) {
      return NextResponse.json(
        {
          error: rawBirthInfo
            ? "생년월일시 정보 형식이 오래됐어요. 내 정보에서 다시 저장해주세요."
            : "사주, 자미두수 또는 궁합을 보려면 내 정보에서 생년월일시를 먼저 입력해주세요.",
        },
        { status: 400 }
      );
    }

    if (includeCompatibility && !partner) {
      return NextResponse.json(
        { error: "궁합을 보려면 메뉴 > 궁합 상대 정보에서 상대방 정보를 먼저 저장해주세요." },
        { status: 400 }
      );
    }

    // 자미두수는 태어난 시간(시진)에 따라 명궁·신궁 위치가 달라져서 시간 모르면 정확히 계산 못 함 —
    // 지금까지는 /tarot 프론트에서만 막고 있었는데, API를 직접 두드리면 우회 가능했음(2026-09-12).
    if (includeZiwei && birthInfo?.timeUnknown) {
      return NextResponse.json(
        {
          error:
            "자미두수를 보려면 태어난 시간이 필요해요. 자미두수는 태어난 시간(시진)에 따라 명궁·신궁의 위치가 달라지기 때문에, 시간 정보 없이는 정확하게 계산할 수 없어요. 내 정보에서 태어난 시간을 입력해주세요.",
        },
        { status: 400 }
      );
    }
    if (includeZiwei && includeCompatibility && partner && !partner.birthTime) {
      return NextResponse.json(
        {
          error:
            "자미두수+궁합을 함께 보려면 상대방의 태어난 시간도 필요해요. 자미두수는 태어난 시간(시진)에 따라 명궁·신궁의 위치가 달라지기 때문에, 시간 정보 없이는 상대방의 자미두수를 정확하게 계산할 수 없어요. 궁합 상대 정보에서 태어난 시간을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    // 사주/자미두수는 켜져 있는데 궁합(상대방 정보)은 안 켜진 상태에서, 질문이 저장된 상대방을
    // 가리키는 경우 — LLM 판단에만 맡기면 "내 사주로 상대방 반응을 우회 설명"하는 경우가 있어서
    // (2026-09-11) 서버에서 결정적으로 차단하고 안내한다. API 호출 자체를 하지 않아 비용도 안 듦.
    // 안내 문구를 사용자가 고른 AI 말투(tone)에 맞게 4종으로 나눠서, 딱딱한 시스템 메시지처럼
    // 느껴지지 않도록 함(2026-09-12 — 획일적인 안내문이 "일반적인 AI 답변 같다"는 피드백을 받음).
    if (
      (includeSaju || includeZiwei) &&
      !includeCompatibility &&
      partner &&
      question.includes(partner.nickname)
    ) {
      const guidance = GUIDANCE_NO_COMPATIBILITY[tone](partner.nickname);
      const now = new Date().toISOString();
      await roomRef.collection(READINGS).add({
        question,
        spread,
        cost: 0,
        cards: [],
        includeSaju: false,
        includeZiwei: false,
        includeCompatibility: false,
        partnerNickname: null,
        interpretation: guidance,
        historySummary: null,
        charged: false,
        guidanceOnly: true,
        flaggedForAbuse: false,
        createdAt: now,
      });
      await roomRef.update({ updatedAt: now });
      return NextResponse.json({
        spread,
        cards: [],
        includeSaju: false,
        includeZiwei: false,
        includeCompatibility: false,
        partnerNickname: null,
        interpretation: guidance,
        remainingCoins: balance,
        charged: false,
        guidanceOnly: true,
        flaggedForAbuse: false,
      });
    }

    const drawnCards = drawCards(SPREADS[spread].cardCount, useReversedCards);

    const partnerBirthInfo = partner ? partnerToBirthInfo(partner) : null;

    let sajuResult: SajuResult | null = null;
    let ziweiResult: ZiweiResult | null = null;
    let partnerSajuResult: SajuResult | null = null;
    let partnerZiweiResult: ZiweiResult | null = null;
    try {
      sajuResult = includeSaju && birthInfo ? calculateSaju(birthInfo) : null;
      ziweiResult = includeZiwei && birthInfo ? calculateZiwei(birthInfo) : null;
      partnerSajuResult =
        includeCompatibility && includeSaju && partnerBirthInfo
          ? calculateSaju(partnerBirthInfo)
          : null;
      partnerZiweiResult =
        includeCompatibility && includeZiwei && partnerBirthInfo
          ? calculateZiwei(partnerBirthInfo)
          : null;
    } catch (error) {
      console.error("Saju/Ziwei calculation error:", error);
      return NextResponse.json(
        { error: "생년월일시 정보로 계산하지 못했어요. 내 정보에서 다시 확인해주세요." },
        { status: 400 }
      );
    }

    const sajuBlock = [
      sajuResult ? `### 나의 사주\n${buildSajuPromptBlock(sajuResult)}` : "",
      partnerSajuResult && partner
        ? `### ${partner.nickname}의 사주\n${buildSajuPromptBlock(partnerSajuResult)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const ziweiBlock = [
      ziweiResult ? `### 나의 자미두수\n${buildZiweiPromptBlock(ziweiResult)}` : "",
      partnerZiweiResult && partner
        ? `### ${partner.nickname}의 자미두수\n${buildZiweiPromptBlock(partnerZiweiResult)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const compatibilityBlock =
      includeCompatibility && partner
        ? `상대방 별명: ${partner.nickname}${
            partnerBirthInfo
              ? partnerSajuResult || partnerZiweiResult
                ? ` (상대방의 사주/자미두수 계산 결과가 위 "## 사주/자미두수 계산 결과" 섹션에 "### ${partner.nickname}의 사주" 또는 "### ${partner.nickname}의 자미두수"로 이미 포함되어 있습니다 — 궁합 상대 정보가 없다거나 부족하다고 판단해서 안내 문구를 쓰지 마세요, 반드시 카드+사주/자미두수를 통합한 정상적인 궁합 해석을 제공하세요.)`
                : ""
              : " (생년월일 또는 성별 정보 없음 — 사주/자미두수 계산 불가, 카드로만 관계를 해석할 것)"
          }`
        : undefined;

    const recentSnap = await roomRef
      .collection(READINGS)
      .orderBy("createdAt", "desc")
      .limit(HISTORY_FETCH_LIMIT)
      .get();
    const recentReadings = recentSnap.docs
      .map((doc) => doc.data())
      .reverse()
      // charged:false 리딩(마커로 거절했거나, 안전장치가 실제 해석이 아니라고 판단한 경우)은 요약이
      // 없어 원문 전체가 그대로 남는데, 그 원문(특히 안전장치가 잡아낸, 스프레드 구조가 잘못된 응답)을
      // 히스토리에 남겨두면 모델이 다음 턴에서 그 구조/라벨을 그대로 베끼는 사고가 났음(2026-09-11) —
      // 그래서 실제 리딩이 아니었던 턴은 히스토리에서 통째로 제외한다.
      .filter((r) => r.charged)
      .slice(-HISTORY_CONTEXT_SIZE);

    const history: Anthropic.MessageParam[] = recentReadings.flatMap((r) => [
      { role: "user", content: r.question },
      { role: "assistant", content: r.historySummary ?? r.interpretation },
    ]);

    // 실제(charged) 리딩이라도 그 안의 카드를 다음 턴 리딩이 그대로 재사용하는 사고가 있었음
    // (2026-09-11) — 프롬프트의 추상적인 "재사용 금지" 문구만으로는 안 지켜져서, 최근 사용된
    // 카드 이름을 명시적으로 나열해서 기계적으로 걸러내도록 한다.
    const recentlyUsedCards: string[] = recentReadings.flatMap(
      (r) => (r.cards as { nameKo: string }[] | undefined)?.map((c) => c.nameKo) ?? []
    );

    try {
      const today = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date());
      const { stable, volatile } = buildTarotSystemPrompt(spread, drawnCards, tone, {
        sajuBlock: sajuBlock || undefined,
        ziweiBlock: ziweiBlock || undefined,
        compatibilityBlock,
        recentlyUsedCards,
        today,
        isFollowUp: history.length > 0,
      });

      async function generate() {
        const response = await anthropic.messages.create({
          model: READING_MODEL,
          max_tokens: READING_MAX_OUTPUT_TOKENS,
          system: [
            // 모든 요청에서 동일한 블록 — prompt caching 대상 (요청마다 달라지는 스프레드/카드/사주
            // 데이터는 별도의 캐싱 안 되는 블록으로 뒤에 붙임)
            { type: "text", text: stable, cache_control: { type: "ephemeral" } },
            { type: "text", text: volatile },
          ],
          messages: [...history, { role: "user", content: safeQuestion }],
        });

        // 운영 분석 전용 원장: 질문 원문·응답은 저장하지 않고 토큰/모델/익명 속성만 남긴다.
        const nowForUsage = new Date();
        const kstParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(nowForUsage);
        const part = (type: string) => kstParts.find((item) => item.type === type)?.value ?? "";
        const usageEventRef = await adminDb.collection("apiUsageEvents").add({
          createdAt: nowForUsage.toISOString(), model: READING_MODEL,
          inputTokens: response.usage.input_tokens ?? 0, outputTokens: response.usage.output_tokens ?? 0,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
          cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
          weekday: part("weekday"), hour: Number(part("hour")),
          gender: userData?.birthInfo?.gender ?? "unknown",
          birthYear: typeof userData?.birthInfo?.birthDate === "string" ? Number(userData.birthInfo.birthDate.slice(0, 4)) : null,
        });

        const textBlock = response.content.find((block) => block.type === "text");
        const rawInterpretation = textBlock?.text ?? "";
        // Two markers, two different user-facing outcomes: NO_CHARGE_MARKER is for genuine abuse
        // (injection/off-topic) and surfaces the "repeat this and you may be suspended" warning;
        // GUIDANCE_MARKER is for cases that aren't the user's fault (e.g. missing +궁합 option) and
        // shows only a quiet notice. Keep them distinguishable end-to-end so the frontend can tell
        // them apart (src/app/(app)/tarot/page.tsx).
        // Detect the marker anywhere in the text, not just at position 0 (2026-09-15): empirically,
        // the model sometimes writes the guidance sentence first and only remembers to append the
        // marker at the very end instead of leading with it. A strict startsWith() missed that case
        // entirely, so it fell through to the generic "malformed reading" bucket (no charge, but no
        // clear guidance message either — reads as a half-finished answer to the user). When the
        // marker isn't at index 0, treat the text before it as the actual guidance message.
        const noChargeIdx = rawInterpretation.indexOf(NO_CHARGE_MARKER);
        const guidanceIdx = rawInterpretation.indexOf(GUIDANCE_MARKER);
        const markedNoCharge = noChargeIdx !== -1;
        const markedGuidance = !markedNoCharge && guidanceIdx !== -1;
        const strippedInterpretation = markedNoCharge
          ? (noChargeIdx === 0
              ? rawInterpretation.slice(NO_CHARGE_MARKER.length)
              : rawInterpretation.slice(0, noChargeIdx)
            ).trim()
          : markedGuidance
            ? (guidanceIdx === 0
                ? rawInterpretation.slice(GUIDANCE_MARKER.length)
                : rawInterpretation.slice(0, guidanceIdx)
              ).trim()
            : rawInterpretation;

        // Safety net for when the model should have used NO_CHARGE_MARKER but didn't (e.g. writes
        // a full reading built around the wrong spread/cards, mimicked from history), AND for the
        // "절대 규칙" that every drawn card must be covered: require every one of the actually-drawn
        // cards to appear, not just a majority (2026-09-14 — a majority threshold let a real
        // multi-card reading through that silently skipped one position's card entirely, since
        // 2-of-3 already cleared the old bar; tightening to "all" makes a skipped card trigger the
        // existing retry loop below instead of shipping an incomplete, still-charged reading).
        // This safety net is a model slip-up, not user abuse, so it must not carry the suspension
        // warning either — see flaggedForAbuse below.
        // Match on nameKo OR nameEn (2026-09-15): under heavy combined load (celtic + saju + ziwei +
        // compatibility + history), the model occasionally writes a card heading using the English
        // name given in the prompt (e.g. "Queen of Cups") instead of the Korean one, even though the
        // rest of the reading is complete and correct — requiring nameKo only turned these into
        // false "no charge" cases for otherwise-valid readings. Both forms are values we handed the
        // model ourselves for this exact card, so accepting either isn't exploitable.
        const mentionedDrawnCardCount = drawnCards.filter(
          (d) =>
            strippedInterpretation.includes(d.card.nameKo) ||
            strippedInterpretation.includes(d.card.nameEn)
        ).length;
        const cardsOk =
          !markedNoCharge &&
          !markedGuidance &&
          mentionedDrawnCardCount === drawnCards.length;

        // Same idea for the saju/ziwei add-ons: the user paid extra for them, so if the option was
        // requested but the response shows no sign of touching it, it was silently dropped and
        // shouldn't be charged for. Checked against a small set of terms/values a genuine saju or
        // ziwei discussion reliably uses somewhere (e.g. the model usually cites just the 일간 stem
        // rather than the full 일주 pillar, so anchoring on one exact computed string is too fragile —
        // any of these signals is enough).
        const sajuOk = !Boolean(
          includeSaju &&
            sajuResult &&
            ![sajuResult.pillars.day, "일간", "사주", "십신", "오행", "간지", "공망"].some((t) =>
              strippedInterpretation.includes(t)
            )
        );
        const ziweiOk = !Boolean(
          includeZiwei &&
            ziweiResult &&
            ![ziweiResult.soul, ziweiResult.body, "자미두수", "명궁", "신궁", "오행국"].some((t) =>
              strippedInterpretation.includes(t)
            )
        );

        // Split off the trailing history-summary + topic-tag + suggested-follow-ups blocks (never
        // shown as-is to the user — summary feeds the next turn's history, topic feeds the admin
        // stats dashboard only, suggestions render as quick-reply chips) from the user-facing
        // interpretation.
        const summaryIdx = strippedInterpretation.indexOf(HISTORY_SUMMARY_MARKER);
        const interpretation =
          summaryIdx === -1
            ? strippedInterpretation
            : strippedInterpretation.slice(0, summaryIdx).trimEnd();

        const tail =
          summaryIdx === -1
            ? ""
            : strippedInterpretation.slice(summaryIdx + HISTORY_SUMMARY_MARKER.length);
        const topicIdx = tail.indexOf(TOPIC_MARKER);
        // suggestions는 topic 마커 뒤에서만 찾는다 — topic 마커가 없으면(모델이 깜빡한 경우) tail
        // 전체에서 찾아 기존(2026-09-12 이전) 동작과 동일하게 동작한다.
        const afterTopic = topicIdx === -1 ? tail : tail.slice(topicIdx + TOPIC_MARKER.length);
        const suggestionsIdx = afterTopic.indexOf(SUGGESTIONS_MARKER);
        const historySummary =
          cardsOk && summaryIdx !== -1
            ? (
                topicIdx !== -1
                  ? tail.slice(0, topicIdx)
                  : suggestionsIdx !== -1
                    ? tail.slice(0, suggestionsIdx)
                    : tail
              ).trim()
            : null;
        const rawTopic =
          cardsOk && topicIdx !== -1
            ? (suggestionsIdx === -1 ? afterTopic : afterTopic.slice(0, suggestionsIdx)).trim()
            : null;
        // 통계 집계용 — 모델이 고정 목록 밖의 값을 쓰거나 마커를 깜빡하면 "기타"로 흡수한다
        // (집계에 빈 값이 섞이는 것보다 낫다).
        const topic = cardsOk
          ? (TOPIC_CATEGORIES as readonly string[]).includes(rawTopic ?? "")
            ? (rawTopic as (typeof TOPIC_CATEGORIES)[number])
            : "기타"
          : null;
        await usageEventRef.update({ topic });
        const suggestions =
          cardsOk && suggestionsIdx !== -1
            ? afterTopic
                .slice(suggestionsIdx + SUGGESTIONS_MARKER.length)
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 3)
            : [];

        return {
          interpretation,
          historySummary,
          topic,
          suggestions,
          cardsOk,
          sajuOk,
          ziweiOk,
          markedNoCharge,
          markedGuidance,
        };
      }

      // 카드/스프레드가 잘못됐거나 사주·자미두수가 빠지면, 사용자에게 보여주기 전에 재생성을
      // 시도한다 — 대부분의 경우 재시도에서 정상적으로 해결되어 사용자가 실패를 볼 일 자체가 크게
      // 줄어든다(2026-09-11). 최대 시도 횟수를 2→3회로 늘림(2026-09-12) — 1회 재시도까지 실패해서
      // 모델이 완전히 헛도는(카드 언급 없이 "카드 준비 중" 같은 알 수 없는 텍스트를 내놓거나, 금지된
      // 되묻기를 하는) 응답이 그대로 노출되는 사례가 실사용에서 발견됨.
      //
      // markedNoCharge/markedGuidance면 재시도하지 않고 즉시 멈춘다(2026-09-19 버그 수정) — 이 두
      // 마커는 모델이 "무관한 질문/인젝션" 또는 "옵션 안내"를 의도적으로, 정확하게 판단했다는
      // 뜻이라 cardsOk가 false여도 실패가 아니다. 예전 코드는 이 경우도 실패로 취급해서 3번을
      // 전부 소진했는데, 같은 질문이면 모델이 매번 똑같이 판단하니 재시도는 무의미한 API 호출
      // 3배·지연 3배만 유발했고, 실제로 이게 쌓여서(약 35초) 인프라 타임아웃으로 500이 나는 사고로
      // 이어진 사례가 있었다(운영 로그로 확인). 진짜 재시도가 필요한 건 카드/사주/자미두수 누락처럼
      // 모델이 형식을 놓친 경우뿐이다.
      let attempt = await generate();
      for (
        let i = 1;
        i < MAX_GENERATE_ATTEMPTS &&
        !attempt.markedNoCharge &&
        !attempt.markedGuidance &&
        !(attempt.cardsOk && attempt.sajuOk && attempt.ziweiOk);
        i++
      ) {
        attempt = await generate();
      }

      const { interpretation, historySummary, topic, suggestions, cardsOk } = attempt;
      // 카드/스프레드 자체가 무효면 전체 무과금(기존 동작 유지). 카드는 정상인데 사주/자미두수만
      // 빠졌다면, 기본 스프레드 요금은 정상 청구하고 빠진 옵션의 추가금만 면제한다 — 재시도까지
      // 실패했다고 해서 이미 완성된 카드 해석 전체를 무과금 처리하면 사용자 입장에서 결과물은
      // 다 봤는데 뜬금없이 "타로와 무관한 질문" 경고가 뜨는 혼란스러운 경험이 되기 때문.
      // 무과금 사유 3가지를 프론트에 구분해서 전달한다(2026-09-12): guidanceOnly(사용자 잘못 아님,
      // 조용히 안내만) / flaggedForAbuse(진짜 인젝션·무관 요청, 정지 경고 노출) / 둘 다 false(카드
      // 안전장치가 잡아낸 모델 쪽 구조 오류 — 사용자를 악용으로 몰지 않고 무과금 안내만 보여줌).
      const guidanceOnly = !cardsOk && attempt.markedGuidance;
      const flaggedForAbuse = !cardsOk && attempt.markedNoCharge;
      const sajuCharged = Boolean(cardsOk && includeSaju && attempt.sajuOk);
      const ziweiCharged = Boolean(cardsOk && includeZiwei && attempt.ziweiOk);
      const compatibilityCharged = Boolean(cardsOk && compatibilityBlock);
      const sajuFree = Boolean(cardsOk && includeSaju && !attempt.sajuOk);
      const ziweiFree = Boolean(cardsOk && includeZiwei && !attempt.ziweiOk);

      const chargedCost = cardsOk && !chosenPass
        ? (spreadCovered ? 0 : { one: 200, three: 250, dual: 300, celtic: 400 }[spread]) +
          (sajuCharged ? (spreadCovered && timePassCombo && COMBOS[timePassCombo].saju ? 0 : SAJU_ADD_ON_COST) : 0) +
          (ziweiCharged ? (spreadCovered && timePassCombo && COMBOS[timePassCombo].ziwei ? 0 : ZIWEI_ADD_ON_COST) : 0) +
          (compatibilityCharged ? (spreadCovered ? 0 : COMPATIBILITY_ADD_ON_COST) : 0)
        : 0;

      const cards = cardsOk
        ? drawnCards.map((d) => ({
            id: d.card.id,
            nameKo: d.card.nameKo,
            nameEn: d.card.nameEn,
            reversed: d.reversed,
          }))
        : [];

      const now = new Date().toISOString();

      let chargedPassId: string | null = null;
      if (cardsOk && chosenPass) {
        await adminDb.runTransaction((tx) =>
          chargeActiveCountPass(tx, userRef, chosenPass.ref, spread, sajuCharged, ziweiCharged)
        );
        chargedPassId = chosenPass.id;
      } else if (chargedCost > 0) {
        await userRef.update({ coins: FieldValue.increment(-chargedCost) });
      }

      await roomRef.collection(READINGS).add({
        question,
        spread,
        cost: chargedCost,
        countPassId: chargedPassId,
        cards,
        includeSaju: sajuCharged,
        includeZiwei: ziweiCharged,
        includeCompatibility: compatibilityCharged,
        partnerNickname: compatibilityCharged && partner ? partner.nickname : null,
        interpretation,
        historySummary,
        topic,
        suggestions,
        charged: cardsOk,
        guidanceOnly,
        flaggedForAbuse,
        timePassApplied: cardsOk && spreadCovered,
        createdAt: now,
      });

      const roomUpdate: Record<string, unknown> = { updatedAt: now };
      let newRoomTitle: string | undefined;
      if (roomSnap.data()?.title === "새 대화" && recentSnap.empty) {
        newRoomTitle = question.slice(0, 24);
        roomUpdate.title = newRoomTitle;
      }
      await roomRef.update(roomUpdate);

      return NextResponse.json({
        spread,
        cards,
        includeSaju: sajuCharged,
        includeZiwei: ziweiCharged,
        includeCompatibility: compatibilityCharged,
        partnerNickname: compatibilityCharged && partner ? partner.nickname : null,
        interpretation,
        remainingCoins: cardsOk ? balance - chargedCost : balance,
        countPassApplied: Boolean(chargedPassId),
        charged: cardsOk,
        guidanceOnly,
        flaggedForAbuse,
        sajuFree,
        ziweiFree,
        timePassApplied: cardsOk && spreadCovered,
        suggestions,
        // 방의 첫 리딩이면 서버가 방금 갱신한 제목을 함께 내려준다 — 프론트가 이걸로 로컬 rooms
        // 상태를 즉시 갱신해야 탑바 제목이 새로고침 없이 바로 바뀐다(2026-09-15, 그전엔 rooms
        // 목록이 로그인 시 한 번만 불러와져서 여기서 바뀐 제목이 반영 안 되고 있었음).
        roomTitle: newRoomTitle,
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error("Anthropic API error:", error.status, error.message);
        return NextResponse.json(
          { error: "해석을 생성하지 못했어요. 잠시 후 다시 시도해주세요." },
          { status: 502 }
        );
      }
      throw error;
    }
  } finally {
    await releaseReadingLock(userRef);
  }
}
