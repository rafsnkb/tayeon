"use client";

import { useEffect, useState } from "react";
import type { SpreadKey } from "@/lib/tarot/pricing";

/* 리딩 결과를 그리는 조각들 — 대화 메시지의 형태, 뽑는 동안 도는 로딩 문구, 카드 이미지와
 * 스프레드별 배치, 그리고 해석 본문의 **볼드** 처리.
 *
 * TarotScreen.tsx 에서 떼어 왔다(2026-09-24). 여기 있는 것들은 전부 "받은 데이터를
 * 그리기만" 하고 이용권·방 상태를 모른다. */

export type TarotCardInfo = { id: string; nameKo: string; nameEn: string; reversed: boolean };

export type ChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      spread: SpreadKey | null;
      cards: TarotCardInfo[];
      includeSaju: boolean;
      includeZiwei: boolean;
      includeCompatibility: boolean;
      partnerNickname: string | null;
      charged: boolean;
      sajuFree?: boolean;
      ziweiFree?: boolean;
      guidanceOnly?: boolean;
      flaggedForAbuse?: boolean;
      timePassApplied?: boolean;
      suggestions?: string[];
      /** 방을 처음 열었을 때 캐릭터가 먼저 건네는 인사말(실제 리딩 아님) — 카드/스프레드 표시,
       * 이용권 차감 안내 등 리딩 전용 UI를 이 메시지에는 붙이지 않기 위한 구분용 플래그. */
      isGreeting?: boolean;
    }
  | { role: "error"; text: string };
const READING_LOADING_MESSAGES = [
  "카드를 섞고 있습니다...",
  "운명의 흐름을 읽는 중...",
  "숨겨진 의미를 찾는 중...",
  "당신을 위한 조언을 준비하고 있습니다...",
];

export function ReadingLoadingMessage() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  // 예전엔 "typing" 다음에 "holding" 단계를 따로 두고 타이핑이 끝나는 순간 이펙트 안에서
  // 동기적으로 setPhase("holding")을 호출했는데, 이러면 렌더가 한 번 더 도는 연쇄가 생긴다.
  // holding은 화면상 "커서만 사라진 typing"이라, 커서 표시 여부를 typedLength에서 직접
  // 끌어내면 단계 자체가 필요 없어진다.
  const [phase, setPhase] = useState<"typing" | "fading">("typing");
  const message = READING_LOADING_MESSAGES[messageIndex];
  const typingDone = typedLength >= message.length;

  useEffect(() => {
    if (phase === "typing") {
      if (!typingDone) {
        const timeout = setTimeout(() => setTypedLength((length) => length + 1), 42);
        return () => clearTimeout(timeout);
      }
      // 다 친 뒤 1초 머무른 다음 페이드아웃으로 넘어간다.
      const timeout = setTimeout(() => setPhase("fading"), 1000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setMessageIndex((index) => (index + 1) % READING_LOADING_MESSAGES.length);
      setTypedLength(0);
      setPhase("typing");
    }, 1000);
    return () => clearTimeout(timeout);
  }, [phase, typingDone]);

  return (
    <div
      aria-live="polite"
      className={`self-start rounded-2xl bg-surface px-4 py-3 text-text transition-opacity duration-1000 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {message.slice(0, typedLength)}
      {phase === "typing" && !typingDone && (
        <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">|</span>
      )}
    </div>
  );
}

export function CardImage({
  card,
  extraRotate = 0,
  className = "w-full",
}: {
  card: TarotCardInfo;
  extraRotate?: number;
  className?: string;
}) {
  if (!card.id) return null;
  const rotation = extraRotate + (card.reversed ? 180 : 0);
  return (
    <img
      src={`/api/tarot/cards/${card.id}`}
      alt={card.nameKo}
      // 원본 카드 그림의 비율이다(asset/resource/*.png). 2026-09-25 에 430×640 → 360×640 으로
      // 다시 그려져서 9:16 이 됐다 — 비율이 어긋나면 object-cover 가 그림을 잘라 낸다.
      className={`aspect-[9/16] rounded-md border border-border object-cover ${className}`}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/** LLM이 강조하려고 붙이는 마크다운 **볼드** 표기를 문자 그대로 보여주지 않고, 폰트 굵기·컬러로 렌더링한다 */
export function renderInterpretation(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-bold-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/** Celtic Cross 카드 순서는 SPREAD_POSITIONS.celtic과 동일: 0현재 1도전 2근본원인 3과거 4목표 5가까운미래 6태도 7외부영향 8희망과두려움 9결과 */
export function CelticCrossLayout({ cards }: { cards: TarotCardInfo[] }) {
  return (
    <div className="flex w-full gap-3">
      <div
        className="grid flex-[3] items-center justify-items-center gap-2"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateAreas: `". up ." "left center right" ". down ."`,
        }}
      >
        <div className="w-full" style={{ gridArea: "up" }}>
          <CardImage card={cards[4]} />
        </div>
        <div className="w-full" style={{ gridArea: "left" }}>
          <CardImage card={cards[3]} />
        </div>
        <div className="relative flex w-full items-center justify-center" style={{ gridArea: "center" }}>
          <CardImage card={cards[0]} />
          <div className="absolute w-full">
            <CardImage card={cards[1]} extraRotate={90} />
          </div>
        </div>
        <div className="w-full" style={{ gridArea: "right" }}>
          <CardImage card={cards[5]} />
        </div>
        <div className="w-full" style={{ gridArea: "down" }}>
          <CardImage card={cards[2]} />
        </div>
      </div>
      <div className="flex flex-1 flex-col-reverse gap-2">
        <CardImage card={cards[6]} />
        <CardImage card={cards[7]} />
        <CardImage card={cards[8]} />
        <CardImage card={cards[9]} />
      </div>
    </div>
  );
}

/** 양자택일 카드 순서는 SPREAD_POSITIONS.dual과 동일: 0A현재 1A결과 2B현재 3B결과 4조언 */
export function DualPathLayout({ cards }: { cards: TarotCardInfo[] }) {
  return (
    <div className="flex w-full items-center justify-center gap-4">
      <div className="flex flex-1 flex-col items-center gap-2">
        <CardImage card={cards[0]} className="w-24" />
        <CardImage card={cards[1]} className="w-24" />
      </div>
      <CardImage card={cards[4]} className="w-24" />
      <div className="flex flex-1 flex-col items-center gap-2">
        <CardImage card={cards[2]} className="w-24" />
        <CardImage card={cards[3]} className="w-24" />
      </div>
    </div>
  );
}
