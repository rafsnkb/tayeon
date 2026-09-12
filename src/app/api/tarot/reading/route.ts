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
} from "@/lib/tarot/prompt";
import {
  SPREADS,
  isSpreadKey,
  SAJU_ADD_ON_COST,
  ZIWEI_ADD_ON_COST,
  COMPATIBILITY_ADD_ON_COST,
} from "@/lib/tarot/pricing";
import { DEFAULT_TONE, isToneKey } from "@/lib/tarot/tone";
import { calculateSaju, buildSajuPromptBlock, type SajuResult } from "@/lib/saju/calculate";
import { calculateZiwei, buildZiweiPromptBlock, type ZiweiResult } from "@/lib/ziwei/calculate";
import { isValidBirthInfo, type BirthInfo } from "@/lib/tarot/birthInfo";
import { isValidPartner, partnerToBirthInfo } from "@/lib/tarot/partner";

export async function POST(req: NextRequest) {
  const uid = await getUidFromRequest(req);
  if (!uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { question, spread, roomId, includeSaju, includeZiwei, includeCompatibility } =
    (await req.json()) as {
      question?: string;
      spread?: string;
      roomId?: string;
      includeSaju?: boolean;
      includeZiwei?: boolean;
      includeCompatibility?: boolean;
    };

  if (!question || !question.trim()) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }
  const safeQuestion: string = question;
  if (!isSpreadKey(spread)) {
    return NextResponse.json({ error: "스프레드를 선택해주세요." }, { status: 400 });
  }
  if (!roomId) {
    return NextResponse.json({ error: "대화방을 선택해주세요." }, { status: 400 });
  }

  const userRef = adminDb.collection("users").doc(uid);
  const roomRef = userRef.collection("rooms").doc(roomId);
  const [userSnap, roomSnap] = await Promise.all([userRef.get(), roomRef.get()]);

  if (!roomSnap.exists) {
    return NextResponse.json({ error: "존재하지 않는 대화방이에요." }, { status: 404 });
  }

  const userData = userSnap.data();

  if (userData?.suspended) {
    return NextResponse.json(
      { error: "이용이 제한된 계정이에요. 고객센터로 문의해주세요." },
      { status: 403 }
    );
  }

  const balance: number = userData?.coins ?? 0;
  const rawTone = userData?.tone;
  const tone = isToneKey(rawTone) ? rawTone : DEFAULT_TONE;
  const useReversedCards: boolean = userData?.useReversedCards ?? true;
  const rawBirthInfo = userData?.birthInfo;
  const birthInfo: BirthInfo | null = isValidBirthInfo(rawBirthInfo) ? rawBirthInfo : null;
  const rawPartner = userData?.partner;
  const partner = isValidPartner(rawPartner) ? rawPartner : null;

  const activeTimePass = userData?.activeTimePass as
    | { minutes: number; includesOptions: boolean; expiresAt: string }
    | null
    | undefined;
  const timePassActive = Boolean(
    activeTimePass && new Date(activeTimePass.expiresAt).getTime() > Date.now()
  );
  // 15분(타로만) 티어는 스프레드 기본요금만 커버, 30/60분(전부 포함) 티어는 옵션 추가금까지 커버.
  const spreadCovered = timePassActive;
  const optionsCovered = timePassActive && Boolean(activeTimePass?.includesOptions);

  if ((includeSaju || includeZiwei) && !birthInfo) {
    return NextResponse.json(
      {
        error: rawBirthInfo
          ? "생년월일시 정보 형식이 오래됐어요. 내 정보에서 다시 저장해주세요."
          : "사주/자미두수를 보려면 내 정보에서 생년월일시를 먼저 입력해주세요.",
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
  if ((includeSaju || includeZiwei) && !includeCompatibility && partner && question.includes(partner.nickname)) {
    const guidance = `${partner.nickname}님과의 사주/자미두수 궁합을 보려면 메뉴의 궁합 상대 정보에서 상대방 정보를 저장하고 +궁합 옵션도 함께 켜주세요.`;
    const now = new Date().toISOString();
    await roomRef.collection("readings").add({
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

  const cost =
    (spreadCovered ? 0 : SPREADS[spread].cost) +
    (includeSaju ? (optionsCovered ? 0 : SAJU_ADD_ON_COST) : 0) +
    (includeZiwei ? (optionsCovered ? 0 : ZIWEI_ADD_ON_COST) : 0) +
    (includeCompatibility ? (optionsCovered ? 0 : COMPATIBILITY_ADD_ON_COST) : 0);

  if (balance < cost) {
    return NextResponse.json(
      { error: "코인이 부족해요. 충전 후 다시 시도해주세요." },
      { status: 402 }
    );
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
            ? ""
            : " (생년월일 또는 성별 정보 없음 — 사주/자미두수 계산 불가, 카드로만 관계를 해석할 것)"
        }`
      : undefined;

  // limit을 6보다 넉넉히 잡는 이유: charged:false 리딩은 아래에서 히스토리 대상에서 제외하므로,
  // 최근 항목 중 일부가 그런 경우에도 여전히 최근 6개 "실제 리딩" 분량의 맥락을 확보하기 위함.
  const recentSnap = await roomRef
    .collection("readings")
    .orderBy("createdAt", "desc")
    .limit(12)
    .get();
  const recentReadings = recentSnap.docs
    .map((doc) => doc.data())
    .reverse()
    // charged:false 리딩(마커로 거절했거나, 안전장치가 실제 해석이 아니라고 판단한 경우)은 요약이
    // 없어 원문 전체가 그대로 남는데, 그 원문(특히 안전장치가 잡아낸, 스프레드 구조가 잘못된 응답)을
    // 히스토리에 남겨두면 모델이 다음 턴에서 그 구조/라벨을 그대로 베끼는 사고가 났음(2026-09-11) —
    // 그래서 실제 리딩이 아니었던 턴은 히스토리에서 통째로 제외한다.
    .filter((r) => r.charged)
    .slice(-6);

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
    const { stable, volatile } = buildTarotSystemPrompt(spread, drawnCards, tone, {
      sajuBlock: sajuBlock || undefined,
      ziweiBlock: ziweiBlock || undefined,
      compatibilityBlock,
      recentlyUsedCards,
    });

    async function generate() {
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 8192,
        system: [
          // 모든 요청에서 동일한 블록 — prompt caching 대상 (요청마다 달라지는 스프레드/카드/사주
          // 데이터는 별도의 캐싱 안 되는 블록으로 뒤에 붙임)
          { type: "text", text: stable, cache_control: { type: "ephemeral" } },
          { type: "text", text: volatile },
        ],
        messages: [...history, { role: "user", content: safeQuestion }],
      });

      const textBlock = response.content.find((block) => block.type === "text");
      const rawInterpretation = textBlock?.text ?? "";
      // Two markers, two different user-facing outcomes: NO_CHARGE_MARKER is for genuine abuse
      // (injection/off-topic) and surfaces the "repeat this and you may be suspended" warning;
      // GUIDANCE_MARKER is for cases that aren't the user's fault (e.g. missing +궁합 option) and
      // shows only a quiet notice. Keep them distinguishable end-to-end so the frontend can tell
      // them apart (src/app/(app)/tarot/page.tsx).
      const markedNoCharge = rawInterpretation.startsWith(NO_CHARGE_MARKER);
      const markedGuidance = !markedNoCharge && rawInterpretation.startsWith(GUIDANCE_MARKER);
      const strippedInterpretation = markedNoCharge
        ? rawInterpretation.slice(NO_CHARGE_MARKER.length).trimStart()
        : markedGuidance
          ? rawInterpretation.slice(GUIDANCE_MARKER.length).trimStart()
          : rawInterpretation;

      // Safety net for when the model should have used NO_CHARGE_MARKER but didn't (e.g. writes
      // a full reading built around the wrong spread/cards, mimicked from history): the system
      // prompt mandates every drawn card be named, so require a majority of the actually-drawn
      // cards to appear — not just one, which a wrong-structure hallucination can satisfy by
      // coincidence (e.g. naming 10 cards for a 5-card spread has good odds of overlapping 1-2).
      // This safety net is a model slip-up, not user abuse, so it must not carry the suspension
      // warning either — see flaggedForAbuse below.
      const mentionedDrawnCardCount = drawnCards.filter((d) =>
        strippedInterpretation.includes(d.card.nameKo)
      ).length;
      const cardsOk =
        !markedNoCharge &&
        !markedGuidance &&
        mentionedDrawnCardCount >= Math.ceil(drawnCards.length / 2);

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

      // Split off the trailing history-summary block (never shown to the user) from the
      // user-facing interpretation.
      const summaryIdx = strippedInterpretation.indexOf(HISTORY_SUMMARY_MARKER);
      const interpretation =
        summaryIdx === -1
          ? strippedInterpretation
          : strippedInterpretation.slice(0, summaryIdx).trimEnd();
      const historySummary =
        cardsOk && summaryIdx !== -1
          ? strippedInterpretation.slice(summaryIdx + HISTORY_SUMMARY_MARKER.length).trim()
          : null;

      return { interpretation, historySummary, cardsOk, sajuOk, ziweiOk, markedNoCharge, markedGuidance };
    }

    // 카드/스프레드가 잘못됐거나 사주·자미두수가 빠지면, 사용자에게 보여주기 전에 재생성을
    // 시도한다 — 대부분의 경우 재시도에서 정상적으로 해결되어 사용자가 실패를 볼 일 자체가 크게
    // 줄어든다(2026-09-11). 최대 시도 횟수를 2→3회로 늘림(2026-09-12) — 1회 재시도까지 실패해서
    // 모델이 완전히 헛도는(카드 언급 없이 "카드 준비 중" 같은 알 수 없는 텍스트를 내놓거나, 금지된
    // 되묻기를 하는) 응답이 그대로 노출되는 사례가 실사용에서 발견됨. 실패했을 때만 추가 API
    // 호출이 발생하므로 정상 응답엔 비용·지연 영향 없음.
    const MAX_ATTEMPTS = 3;
    let attempt = await generate();
    for (
      let i = 1;
      i < MAX_ATTEMPTS && !(attempt.cardsOk && attempt.sajuOk && attempt.ziweiOk);
      i++
    ) {
      attempt = await generate();
    }

    const { interpretation, historySummary, cardsOk } = attempt;
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

    const chargedCost = cardsOk
      ? (spreadCovered ? 0 : SPREADS[spread].cost) +
        (sajuCharged ? (optionsCovered ? 0 : SAJU_ADD_ON_COST) : 0) +
        (ziweiCharged ? (optionsCovered ? 0 : ZIWEI_ADD_ON_COST) : 0) +
        (compatibilityCharged ? (optionsCovered ? 0 : COMPATIBILITY_ADD_ON_COST) : 0)
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

    if (cardsOk) {
      await userRef.update({ coins: FieldValue.increment(-chargedCost) });
    }

    await roomRef.collection("readings").add({
      question,
      spread,
      cost: chargedCost,
      cards,
      includeSaju: sajuCharged,
      includeZiwei: ziweiCharged,
      includeCompatibility: compatibilityCharged,
      partnerNickname: compatibilityCharged && partner ? partner.nickname : null,
      interpretation,
      historySummary,
      charged: cardsOk,
      guidanceOnly,
      flaggedForAbuse,
      timePassApplied: cardsOk && spreadCovered,
      createdAt: now,
    });

    const roomUpdate: Record<string, unknown> = { updatedAt: now };
    if (roomSnap.data()?.title === "새 대화" && recentSnap.empty) {
      roomUpdate.title = question.slice(0, 24);
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
      charged: cardsOk,
      guidanceOnly,
      flaggedForAbuse,
      sajuFree,
      ziweiFree,
      timePassApplied: cardsOk && spreadCovered,
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
}
