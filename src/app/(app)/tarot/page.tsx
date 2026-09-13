"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRooms } from "@/lib/tarot/RoomsContext";
import {
  SPREADS,
  SAJU_ADD_ON_COST,
  ZIWEI_ADD_ON_COST,
  COMPATIBILITY_ADD_ON_COST,
  type SpreadKey,
} from "@/lib/tarot/pricing";
import { openMenu } from "@/lib/ui/menuBus";
import {
  MenuIcon,
  SendIcon,
  RoomInfoIcon,
  NewChatIcon,
  SajuIcon,
  ZiweiIcon,
  CompatibilityIcon,
  CloseIcon,
  SpreadOneIcon,
  SpreadThreeIcon,
  SpreadDualIcon,
  SpreadCelticIcon,
} from "./icons";

const SPREAD_ICONS: Record<SpreadKey, (props: { className?: string }) => React.JSX.Element> = {
  one: SpreadOneIcon,
  three: SpreadThreeIcon,
  dual: SpreadDualIcon,
  celtic: SpreadCelticIcon,
};

type TarotCardInfo = { id: string; nameKo: string; nameEn: string; reversed: boolean };

type ChatMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      spread: SpreadKey;
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
    }
  | { role: "error"; text: string };

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CardImage({
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
      className={`aspect-[43/64] rounded-md border border-border object-cover ${className}`}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/** LLM이 강조하려고 붙이는 마크다운 **볼드** 표기를 문자 그대로 보여주지 않고, 폰트 굵기·컬러로 렌더링한다 */
function renderInterpretation(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-light text-bold-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/** Celtic Cross 카드 순서는 SPREAD_POSITIONS.celtic과 동일: 0현재 1도전 2근본원인 3과거 4목표 5가까운미래 6태도 7외부영향 8희망과두려움 9결과 */
function CelticCrossLayout({ cards }: { cards: TarotCardInfo[] }) {
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
function DualPathLayout({ cards }: { cards: TarotCardInfo[] }) {
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

function WelcomePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-w-sm flex-col gap-3 rounded-2xl bg-surface p-6">
        <h2 className="text-lg font-bold text-bold-text">타연에 오신 걸 환영해요</h2>
        <ul className="list-disc pl-5 text-sm text-text">
          <li>타연은 오락 목적의 서비스이며, 의학적·법적·재정적 조언을 대체하지 않습니다.</li>
          <li>만 14세 미만은 이용이 제한됩니다.</li>
          <li>충전한 코인은 사용 후 환불되지 않으며, 유효기간은 무기한입니다.</li>
          <li>
            자세한 내용은{" "}
            <a href="/terms" target="_blank" className="text-point underline">
              이용약관
            </a>{" "}
            및{" "}
            <a href="/privacy" target="_blank" className="text-point underline">
              개인정보처리방침
            </a>
            을 확인해주세요.
          </li>
        </ul>
        <button
          onClick={onClose}
          className="mt-2 rounded-full bg-cta-fill px-5 py-2 text-cta-text"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}

const SPREAD_DESCRIPTIONS: Record<SpreadKey, string> = {
  one: "간단한 질문에 추천",
  three: "제일 범용성 높은 스프레드",
  dual: "어느 한쪽을 선택해야 할 때 추천",
  celtic: "세부적인 심층 분석에 추천",
};

function CoinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <img src="/icons/coin.png" alt="" className={className} />;
}

/** 피그마 "Screen / SpreadSelect"의 List_Spread — 스프레드 4종을 설명+가격과 함께 고르는 바텀시트 */
function SpreadSelectSheet({
  spread,
  onSelect,
  onClose,
}: {
  spread: SpreadKey;
  onSelect: (key: SpreadKey) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full rounded-t-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-3 p-3">
          <div className="w-5" />
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-bold-text">스프레드 선택</p>
            <p className="text-sm font-semibold text-icon-muted">원하는 스프레드를 선택할 수 있어요</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-border/40 p-2">
          {(Object.keys(SPREADS) as SpreadKey[]).map((key, i) => {
            const Icon = SPREAD_ICONS[key];
            const selected = spread === key;
            return (
              <div key={key}>
                {i > 0 && <div className="h-px bg-border" />}
                <button
                  type="button"
                  onClick={() => {
                    onSelect(key);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center text-bold-text">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="text-lg font-semibold text-bold-text">{SPREADS[key].label}</span>
                      {selected && (
                        <span className="shrink-0 rounded-full bg-point px-2 py-0.5 text-xs font-semibold text-white">
                          선택됨
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-semibold text-icon-muted">
                      {SPREAD_DESCRIPTIONS[key]}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs font-semibold text-icon-muted">질문 1회</span>
                    <span className="flex items-center gap-1">
                      <CoinIcon className="h-5 w-5" />
                      <span className="text-base font-semibold text-gold">{SPREADS[key].cost}</span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TarotPage() {
  return (
    <Suspense fallback={null}>
      <TarotChat />
    </Suspense>
  );
}

function TarotChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    coins,
    setCoins,
    rooms,
    activeRoomId,
    selectRoom,
    loaded: roomsLoaded,
    createRoom,
    deleteRoom,
    hasBirthInfo,
    myTimeUnknown,
    hasPartner,
    partnerTimeUnknown,
    activeTimePass,
    setActiveTimePass,
    timePasses,
    setTimePasses,
  } = useRooms();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("welcome") === "1");
  const [spread, setSpread] = useState<SpreadKey>("one");
  const [includeSaju, setIncludeSaju] = useState(false);
  const [includeZiwei, setIncludeZiwei] = useState(false);
  const [includeCompatibility, setIncludeCompatibility] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [startingPass, setStartingPass] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [spreadSheetOpen, setSpreadSheetOpen] = useState(false);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!activeTimePass || new Date(activeTimePass.expiresAt).getTime() <= now) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimePass]);

  // 방 목록은 RoomsContext(레이아웃 레벨)가 불러온다 — 여기서는 URL의 ?room= 파라미터가
  // 가리키는 방으로 한 번만 맞춰준다(없으면 컨텍스트가 이미 골라둔 기본값을 그대로 씀).
  useEffect(() => {
    if (!roomsLoaded || rooms.length === 0) return;
    const roomParam = searchParams.get("room");
    if (roomParam && rooms.some((r) => r.id === roomParam) && roomParam !== activeRoomId) {
      selectRoom(roomParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsLoaded, rooms]);

  // /api/tarot/reading은 응답 전달 전에 네트워크가 끊기면(모바일에서 흔함) 서버는 이미 리딩을
  // 저장·차감까지 마쳤는데 클라이언트만 실패로 보는 상황이 생길 수 있다 — 그 경우를 감지하기 위해
  // 방 히스토리 재조회 로직을 재사용 가능한 함수로 분리(2026-09-12, handleSubmit의 catch에서도 씀).
  async function fetchRoomHistory(roomId: string): Promise<ChatMessage[] | null> {
    if (!user) return null;
    const idToken = await user.getIdToken();
    const res = await fetch(`/api/tarot/history?roomId=${roomId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const readings = data.readings as {
      question: string;
      spread: SpreadKey;
      cards: TarotCardInfo[];
      includeSaju: boolean;
      includeZiwei: boolean;
      includeCompatibility: boolean;
      partnerNickname: string | null;
      interpretation: string;
      charged: boolean;
      guidanceOnly: boolean;
      flaggedForAbuse: boolean;
      suggestions: string[];
    }[];
    return readings.flatMap((r) => [
      { role: "user", text: r.question },
      {
        role: "assistant",
        text: r.interpretation,
        spread: r.spread,
        cards: r.cards,
        includeSaju: r.includeSaju,
        includeZiwei: r.includeZiwei,
        includeCompatibility: r.includeCompatibility,
        partnerNickname: r.partnerNickname,
        charged: r.charged,
        guidanceOnly: r.guidanceOnly,
        flaggedForAbuse: r.flaggedForAbuse,
        suggestions: r.suggestions,
      },
    ]);
  }

  useEffect(() => {
    if (!user || !activeRoomId) return;

    (async () => {
      setHistoryLoaded(false);
      const history = await fetchRoomHistory(activeRoomId);
      if (history) setMessages(history);
      setHistoryLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeRoomId]);

  async function handleStartTimePass(passId: string) {
    if (!user || startingPass) return;
    setStartingPass(passId);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/tarot/time-pass/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ passId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "이용권을 사용하지 못했어요.");
        return;
      }
      setActiveTimePass(data.activeTimePass);
      setTimePasses((prev) => prev.filter((p) => p.id !== passId));
      setNow(Date.now());
    } finally {
      setStartingPass(null);
    }
  }

  async function handleNewRoom() {
    const created = await createRoom();
    if (created) router.replace(`/tarot?room=${created.id}`);
  }

  async function handleDeleteRoom(roomId: string) {
    if (rooms.length <= 1) return;
    if (!confirm("이 대화방을 삭제할까요?")) return;
    await deleteRoom(roomId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading || !user || !activeRoomId) return;

    if (includeZiwei && myTimeUnknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          text: "자미두수를 보려면 태어난 시간이 필요해요. 자미두수는 태어난 시간(시진)에 따라 명궁·신궁의 위치가 달라지기 때문에, 시간 정보 없이는 정확하게 계산할 수 없어요. 내 정보에서 태어난 시간을 입력해주세요.",
        },
      ]);
      return;
    }
    if (includeZiwei && includeCompatibility && partnerTimeUnknown) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          text: "자미두수+궁합을 함께 보려면 상대방의 태어난 시간도 필요해요. 자미두수는 태어난 시간(시진)에 따라 명궁·신궁의 위치가 달라지기 때문에, 시간 정보 없이는 상대방의 자미두수를 정확하게 계산할 수 없어요. 궁합 상대 정보에서 태어난 시간을 입력해주세요.",
        },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/tarot/reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          question: trimmed,
          spread,
          roomId: activeRoomId,
          includeSaju,
          includeZiwei,
          includeCompatibility,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: data.error ?? "오류가 발생했어요." },
        ]);
        return;
      }

      setCoins(data.remainingCoins);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.interpretation,
          spread: data.spread,
          cards: data.cards,
          includeSaju: data.includeSaju,
          includeZiwei: data.includeZiwei,
          includeCompatibility: data.includeCompatibility,
          partnerNickname: data.partnerNickname,
          charged: data.charged,
          sajuFree: data.sajuFree,
          ziweiFree: data.ziweiFree,
          guidanceOnly: data.guidanceOnly,
          flaggedForAbuse: data.flaggedForAbuse,
          timePassApplied: data.timePassApplied,
          suggestions: data.suggestions,
        },
      ]);
    } catch {
      // 응답이 오는 도중 연결이 끊기면(모바일에서 흔함), 서버는 이미 리딩 저장·코인 차감까지
      // 끝냈을 수 있다 — 무작정 재요청하면 이중 차감 위험이 있으므로, 대신 방 히스토리를 다시
      // 조회해서 이번 질문이 실제로 처리됐는지 확인한다(2026-09-12).
      const recovered = await fetchRoomHistory(activeRoomId).catch(() => null);
      const last = recovered?.[recovered.length - 1];
      const secondLast = recovered?.[recovered.length - 2];
      const questionWasAnswered =
        last?.role === "assistant" && secondLast?.role === "user" && secondLast.text === trimmed;

      if (recovered && questionWasAnswered) {
        setMessages(recovered);
        const idToken = await user.getIdToken().catch(() => null);
        if (idToken) {
          const meRes = await fetch("/api/user/me", {
            headers: { Authorization: `Bearer ${idToken}` },
          }).catch(() => null);
          if (meRes?.ok) {
            const meData = await meRes.json();
            setCoins(meData.coins);
          }
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "error", text: "네트워크 오류가 발생했어요." },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  const timePassActive = Boolean(
    activeTimePass && new Date(activeTimePass.expiresAt).getTime() > now
  );
  const spreadCoveredDisplay = timePassActive;
  const optionsCoveredDisplay = timePassActive && Boolean(activeTimePass?.includesOptions);
  const displayedCost =
    (spreadCoveredDisplay ? 0 : SPREADS[spread].cost) +
    (includeSaju ? (optionsCoveredDisplay ? 0 : SAJU_ADD_ON_COST) : 0) +
    (includeZiwei ? (optionsCoveredDisplay ? 0 : ZIWEI_ADD_ON_COST) : 0) +
    (includeCompatibility ? (optionsCoveredDisplay ? 0 : COMPATIBILITY_ADD_ON_COST) : 0);

  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      {showWelcome && <WelcomePopup onClose={() => setShowWelcome(false)} />}
      {spreadSheetOpen && (
        <SpreadSelectSheet
          spread={spread}
          onSelect={setSpread}
          onClose={() => setSpreadSheetOpen(false)}
        />
      )}
      <div className="relative flex h-16 shrink-0 items-center border-b border-border bg-topbar">
        <button
          type="button"
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="flex h-16 w-16 shrink-0 items-center justify-center text-icon-muted"
        >
          <MenuIcon className="h-3 w-5" />
        </button>
        {/* 방 목록은 메뉴 드로어((app)/layout.tsx)에 있음 — 방 이름을 누르면 그 드로어를 연다 */}
        <button
          type="button"
          onClick={openMenu}
          className="min-w-0 flex-1 truncate text-left text-base font-semibold text-[#dbdbdb]"
        >
          {activeRoom?.title ?? "새 대화"}
        </button>
        <div className="flex shrink-0 items-center gap-2 pr-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRoomInfoOpen((v) => !v)}
              aria-label="대화방 정보"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-icon-muted text-icon-muted"
            >
              <RoomInfoIcon className="h-1 w-4" />
            </button>
            {roomInfoOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRoomInfoOpen(false)} />
                <div className="absolute right-0 top-12 z-20 rounded-xl border border-border bg-topbar p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setRoomInfoOpen(false);
                      if (activeRoomId) handleDeleteRoom(activeRoomId);
                    }}
                    disabled={rooms.length <= 1}
                    className="whitespace-nowrap rounded-lg px-4 py-3 text-sm font-semibold text-bold-text disabled:opacity-40"
                  >
                    대화 삭제
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewRoom}
            aria-label="새 대화"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-fill text-cta-text"
          >
            <NewChatIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pt-3">
        {!historyLoaded && (
          <div className="self-start text-sm text-text">이전 대화를 불러오는 중...</div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="self-end rounded-2xl bg-point px-4 py-2 text-white">
                {msg.text}
              </div>
            );
          }
          if (msg.role === "error") {
            return (
              <div key={i} className="self-start rounded-2xl bg-urgent/10 px-4 py-2 text-urgent">
                {msg.text}
              </div>
            );
          }
          return (
            <div key={i} className="flex w-full flex-col items-start">
              <div className="max-w-[85%] rounded-2xl bg-surface px-4 py-3">
              {msg.cards.some((c) => c.id) && (
                <div className="mb-2 flex justify-center">
                  {msg.spread === "celtic" && msg.cards.length === 10 ? (
                    <CelticCrossLayout cards={msg.cards} />
                  ) : msg.spread === "dual" && msg.cards.length === 5 ? (
                    <DualPathLayout cards={msg.cards} />
                  ) : (
                    <div className="flex gap-2">
                      {msg.cards.map((c, j) => (
                        <div key={j} className="max-w-40 flex-1">
                          <CardImage card={c} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {msg.cards.length > 0 && (
                <div className="mb-1 flex flex-col items-center gap-1">
                  <span className="rounded-full border border-border px-3 py-1 text-base font-medium text-text">
                    {SPREADS[msg.spread].label}
                  </span>
                  <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-sm font-light text-text">
                    {msg.cards.map((c, j) => (
                      <span key={j} className="rounded-full bg-text px-3 py-1 font-light text-surface">
                        {c.nameKo}
                        {c.reversed ? "(역)" : ""}
                      </span>
                    ))}
                    {msg.includeSaju && <span>· 사주</span>}
                    {msg.includeZiwei && <span>· 자미두수</span>}
                    {msg.includeCompatibility && (
                      <span>· 궁합{msg.partnerNickname ? `(${msg.partnerNickname})` : ""}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="whitespace-pre-wrap">{renderInterpretation(msg.text)}</div>
              </div>
              {!msg.charged && !msg.guidanceOnly && (
                <div className="mt-1 w-full text-xs">
                  <p className="px-1 text-text">해당 답변은 코인 차감이 되지 않습니다.</p>
                  {msg.flaggedForAbuse && (
                    <p className="mt-1 text-center text-urgent">
                      타로와 무관하거나 시스템의 기능을 악용하려는 질문을 반복적으로 계속할 경우,
                      서비스 이용이 정지될 수 있습니다.
                    </p>
                  )}
                </div>
              )}
              {msg.charged && (msg.sajuFree || msg.ziweiFree) && (
                <p className="mt-1 w-full px-1 text-xs text-text">
                  {msg.sajuFree && msg.ziweiFree
                    ? "이번 답변에는 사주·자미두수 해석이 포함되지 않아 해당 코인은 차감되지 않았어요."
                    : msg.sajuFree
                      ? "이번 답변에는 사주 해석이 포함되지 않아 해당 코인은 차감되지 않았어요."
                      : "이번 답변에는 자미두수 해석이 포함되지 않아 해당 코인은 차감되지 않았어요."}
                </p>
              )}
              {msg.charged && msg.timePassApplied && (
                <p className="mt-1 w-full px-1 text-xs text-point">이용권으로 이용한 리딩이에요.</p>
              )}
              {msg.charged && i === messages.length - 1 && (msg.suggestions?.length ?? 0) > 0 && (
                <div className="mt-2 flex w-full flex-col gap-1.5">
                  {msg.suggestions!.map((s, j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => {
                        setQuestion(s);
                        questionInputRef.current?.focus();
                      }}
                      className="rounded-full border border-point px-3 py-1.5 text-left text-sm text-point"
                    >
                      {j + 1}. {s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => questionInputRef.current?.focus()}
                    className="rounded-full border border-border px-3 py-1.5 text-left text-sm text-text"
                  >
                    {msg.suggestions!.length + 1}. 직접 입력할게요
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="self-start rounded-2xl bg-surface px-4 py-3 text-text">
            카드를 뽑고 해석하는 중...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 px-4 pb-4">
        {timePassActive && activeTimePass && (
          <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-chip-fill px-2.5 py-2">
            <span className="text-sm font-semibold text-icon-muted">시간제 사용중</span>
            <span className="text-sm font-semibold text-bold-text">
              남은 시간: {formatRemaining(new Date(activeTimePass.expiresAt).getTime() - now)}
            </span>
          </div>
        )}
        {!timePassActive && timePasses.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {timePasses.map((pass) => (
              <div
                key={pass.id}
                className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-point px-3 py-1 text-point"
              >
                <span className="text-sm">
                  {pass.minutes}분권{pass.includesOptions ? "" : " (타로만)"}
                </span>
                <button
                  type="button"
                  onClick={() => handleStartTimePass(pass.id)}
                  disabled={startingPass === pass.id}
                  className="rounded-full bg-cta-fill px-2 py-0.5 text-xs text-cta-text disabled:opacity-50"
                >
                  사용하기
                </button>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-1 rounded-[28px] border border-border bg-surface px-4 py-3"
        >
          <input
            ref={questionInputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="궁금한 것을 물어보세요"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-bold-text placeholder-placeholder outline-none"
            disabled={loading}
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSpreadSheetOpen(true)}
              className="flex h-10 shrink-0 items-center rounded-full bg-chip-fill px-5 text-sm font-semibold text-bold-text"
            >
              {SPREADS[spread].label}
            </button>
            {hasBirthInfo && (
              <>
                <button
                  type="button"
                  onClick={() => setIncludeSaju((v) => !v)}
                  aria-pressed={includeSaju}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    includeSaju
                      ? "bg-point-bg border border-point/50 text-point"
                      : "bg-chip-fill text-icon-muted"
                  }`}
                >
                  <SajuIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeZiwei((v) => !v)}
                  aria-pressed={includeZiwei}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    includeZiwei
                      ? "bg-point-bg border border-point/50 text-point"
                      : "bg-chip-fill text-icon-muted"
                  }`}
                >
                  <ZiweiIcon className="h-5 w-5" />
                </button>
              </>
            )}
            {hasPartner && (
              <button
                type="button"
                onClick={() => setIncludeCompatibility((v) => !v)}
                aria-pressed={includeCompatibility}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  includeCompatibility
                    ? "bg-point-bg border border-point/50 text-point"
                    : "bg-chip-fill text-icon-muted"
                }`}
              >
                <CompatibilityIcon className="h-5 w-5" />
              </button>
            )}
            <span className="flex-1" />
            <button
              type="submit"
              disabled={loading}
              aria-label="질문하기"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta-fill text-cta-text disabled:opacity-50"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 px-1 text-xs">
          <div className="flex flex-col gap-0.5">
            {!hasBirthInfo && (
              <p className="text-placeholder">
                <Link href="/me" className="text-point underline">
                  내 정보
                </Link>
                에서 생년월일시를 입력하면 사주/자미두수도 함께 볼 수 있어요.
              </p>
            )}
            {!hasPartner && (
              <p className="text-placeholder">
                <Link href="/compatibility" className="text-point underline">
                  궁합 상대 정보
                </Link>
                를 저장하면 궁합도 함께 볼 수 있어요.
              </p>
            )}
          </div>
          <span className="whitespace-nowrap text-icon-muted">
            보유 {coins ?? "-"}코인 · 총 {displayedCost}코인
            {spreadCoveredDisplay && <span className="text-point"> (이용권 적용)</span>}
          </span>
        </div>
      </div>
    </div>
  );
}
