"use client";

import { useEffect, useState } from "react";
import type { SpreadKey } from "@/lib/tarot/pricing";
import { CARD_ART_VERSION } from "@/lib/tarot/cards";

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
    // typedLength 가 빠지면 한 글자만 찍고 멈춘다(2026-09-26 실제로 냈다). 타이핑을 미는 건
    // typedLength 를 1 올리는 setTimeout 인데, 의존성에 없으면 값이 올라도 이펙트가 다시 안 돌아
    // 다음 타이머가 안 걸린다. phase·typingDone 은 첫 글자에서 둘 다 그대로라 못 잡아준다.
  }, [phase, typingDone, typedLength]);

  return (
    <div
      aria-live="polite"
      /* 말풍선을 두르지 않는다(2026-09-26 사용자 지시) — 뒤이어 올 AI 답변이 배경 없는 맨
         텍스트라, 로딩만 회색 박스를 쓰면 다른 종류의 메시지처럼 보였다. */
      className={`self-start text-text transition-opacity duration-1000 ${
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

/** 한 글자씩 찍어 내는 텍스트.
 *
 *  리딩 본문은 서버 스트리밍 덕에 저절로 "타이핑처럼" 나오는데, 인사말은 클라이언트가 이미 다 들고
 *  있어서 한 번에 떴다(2026-09-26 사용자 지적). 같은 화면에서 둘이 다르게 보이면 인사말만 미리
 *  준비된 안내문처럼 읽힌다.
 *
 *  `startDelayMs` 로 여러 말풍선을 이어 붙인다 — 앞 줄이 다 찍힌 뒤에 다음 줄이 시작하도록
 *  호출부가 누적 시간을 넘긴다. */
export const TYPING_SPEED_MS = 28;

export function TypewriterText({ text, startDelayMs = 0 }: { text: string; startDelayMs?: number }) {
  const [started, setStarted] = useState(startDelayMs <= 0);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (started) return;
    const timeout = setTimeout(() => setStarted(true), startDelayMs);
    return () => clearTimeout(timeout);
  }, [started, startDelayMs]);

  useEffect(() => {
    if (!started || length >= text.length) return;
    const timeout = setTimeout(() => setLength((n) => n + 1), TYPING_SPEED_MS);
    return () => clearTimeout(timeout);
  }, [started, length, text]);

  return (
    <>
      {text.slice(0, length)}
      {started && length < text.length && (
        <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">|</span>
      )}
    </>
  );
}

export function CardImage({
  card,
  extraRotate = 0,
  className = "w-full",
  order,
}: {
  card: TarotCardInfo;
  extraRotate?: number;
  className?: string;
  /** 주면 그 순서대로 한 장씩 페이드인 한다 — 스프레드 배열 순서(0부터)를 넘긴다. */
  order?: number;
}) {
  if (!card.id) return null;
  const rotation = extraRotate + (card.reversed ? 180 : 0);
  return (
    <img
      src={`/api/tarot/cards/${card.id}?v=${CARD_ART_VERSION}`}
      alt={card.nameKo}
      // 원본 카드 그림의 비율이다(asset/resource/*.png). 2026-09-25 에 430×640 → 360×640 으로
      // 다시 그려져서 9:16 이 됐다 — 비율이 어긋나면 object-cover 가 그림을 잘라 낸다.
      className={`aspect-[9/16] rounded-md border border-border object-cover ${order !== undefined ? "animate-fade-in" : ""} ${className}`}
      style={{
        ...(rotation ? { transform: `rotate(${rotation}deg)` } : null),
        // fade-in 은 opacity 만 건드리므로 위 rotate 와 안 부딪힌다.
        // backwards: 차례가 오기 전에도 투명하게 대기시킨다(안 주면 미리 보인다).
        ...(order !== undefined
          ? { animationDelay: `${order * 0.12}s`, animationFillMode: "backwards" as const }
          : null),
      }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/** 뽑힌 카드를 스프레드 배치에 맞춰 깐다.
 *
 *  카드 그림은 **LLM 이 필요 없다** — 서버가 뽑는 즉시 확정된다. 그래서 해석 첫 글자보다 먼저
 *  내려보내 깔아 주고(2026-09-26), 완성된 메시지도 같은 컴포넌트로 그린다. */
export function SpreadCards({
  spread,
  cards,
  stagger = false,
}: {
  spread: SpreadKey | null;
  cards: TarotCardInfo[];
  /** 방금 뽑은 카드를 깔 때만 켠다 — 스프레드 순서대로 한 장씩 나타난다. 지난 대화를 다시 열 때는
   *  이미 나왔던 카드라 연출 없이 그냥 보여준다. */
  stagger?: boolean;
}) {
  if (!cards.some((c) => c.id)) return null;
  const at = (i: number) => (stagger ? i : undefined);
  return (
    <div className="mb-2 flex justify-center">
      {spread === "celtic" && cards.length === 10 ? (
        <CelticCrossLayout cards={cards} at={at} />
      ) : spread === "dual" && cards.length === 5 ? (
        <DualPathLayout cards={cards} at={at} />
      ) : (
        <div className="flex gap-2">
          {cards.map((c, j) => (
            <div key={j} className="max-w-40 flex-1">
              <CardImage card={c} order={at(j)} />
            </div>
          ))}
        </div>
      )}
    </div>
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
export function CelticCrossLayout({ cards, at }: { cards: TarotCardInfo[]; at?: (i: number) => number | undefined }) {
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
          <CardImage card={cards[4]} order={at?.(4)} />
        </div>
        <div className="w-full" style={{ gridArea: "left" }}>
          <CardImage card={cards[3]} order={at?.(3)} />
        </div>
        {/* z-10: 가로로 눕힌 도전 카드(cards[1])는 회전하면서 제 칸을 넘어 좌우 칸까지 걸친다.
            그런데 그리드에서 right/down 칸이 **뒤에** 그려지는 형제라, z-index 가 없으면 그것들이
            도전 카드 위를 덮는다 — 켈틱크로스에서 도전 카드는 현재 카드 위에 **얹히는** 카드다. */}
        <div className="relative z-10 flex w-full items-center justify-center" style={{ gridArea: "center" }}>
          <CardImage card={cards[0]} order={at?.(0)} />
          <div className="absolute w-full">
            <CardImage card={cards[1]} extraRotate={90} order={at?.(1)} />
          </div>
        </div>
        <div className="w-full" style={{ gridArea: "right" }}>
          <CardImage card={cards[5]} order={at?.(5)} />
        </div>
        <div className="w-full" style={{ gridArea: "down" }}>
          <CardImage card={cards[2]} order={at?.(2)} />
        </div>
      </div>
      <div className="flex flex-1 flex-col-reverse gap-2">
        <CardImage card={cards[6]} order={at?.(6)} />
        <CardImage card={cards[7]} order={at?.(7)} />
        <CardImage card={cards[8]} order={at?.(8)} />
        <CardImage card={cards[9]} order={at?.(9)} />
      </div>
    </div>
  );
}

/** 양자택일 카드 순서는 SPREAD_POSITIONS.dual과 동일: 0A현재 1A결과 2B현재 3B결과 4조언 */
export function DualPathLayout({ cards, at }: { cards: TarotCardInfo[]; at?: (i: number) => number | undefined }) {
  return (
    <div className="flex w-full items-center justify-center gap-4">
      <div className="flex flex-1 flex-col items-center gap-2">
        <CardImage card={cards[0]} className="w-24" order={at?.(0)} />
        <CardImage card={cards[1]} className="w-24" order={at?.(1)} />
      </div>
      <CardImage card={cards[4]} className="w-24" order={at?.(4)} />
      <div className="flex flex-1 flex-col items-center gap-2">
        <CardImage card={cards[2]} className="w-24" order={at?.(2)} />
        <CardImage card={cards[3]} className="w-24" order={at?.(3)} />
      </div>
    </div>
  );
}
