"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import Link from "next/link";
import {
  SPREADS,
  SAJU_ADD_ON_COST,
  ZIWEI_ADD_ON_COST,
  COMPATIBILITY_ADD_ON_COST,
  type SpreadKey,
} from "@/lib/tarot/pricing";

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

type Room = { id: string; title: string; updatedAt: string };

type ActiveTimePass = {
  passId: string;
  minutes: number;
  includesOptions: boolean;
  startedAt: string;
  expiresAt: string;
};

type TimePass = { id: string; minutes: number; includesOptions: boolean };

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
  const [user, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("welcome") === "1");
  const [spread, setSpread] = useState<SpreadKey>("one");
  const [hasBirthInfo, setHasBirthInfo] = useState(false);
  const [myTimeUnknown, setMyTimeUnknown] = useState(false);
  const [hasPartner, setHasPartner] = useState(false);
  const [partnerTimeUnknown, setPartnerTimeUnknown] = useState(false);
  const [includeSaju, setIncludeSaju] = useState(false);
  const [includeZiwei, setIncludeZiwei] = useState(false);
  const [includeCompatibility, setIncludeCompatibility] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTimePass, setActiveTimePass] = useState<ActiveTimePass | null>(null);
  const [timePasses, setTimePasses] = useState<TimePass[]>([]);
  const [startingPass, setStartingPass] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    if (!activeTimePass) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimePass]);

  useEffect(() => {
    if (activeTimePass && new Date(activeTimePass.expiresAt).getTime() <= now) {
      setActiveTimePass(null);
    }
  }, [activeTimePass, now]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);

      const idToken = await u.getIdToken();
      const [meRes, roomsRes] = await Promise.all([
        fetch("/api/user/me", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/tarot/rooms", { headers: { Authorization: `Bearer ${idToken}` } }),
      ]);

      if (meRes.ok) {
        const data = await meRes.json();
        setCoins(data.coins);
        setHasBirthInfo(Boolean(data.birthInfo?.birthDate));
        setMyTimeUnknown(Boolean(data.birthInfo?.timeUnknown));
        setHasPartner(Boolean(data.partner?.nickname));
        setPartnerTimeUnknown(Boolean(data.partner?.nickname) && !data.partner?.birthTime);
        setActiveTimePass(data.activeTimePass ?? null);
        setTimePasses(data.timePasses ?? []);
      }

      let roomList: Room[] = [];
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        roomList = data.rooms;
      }

      if (roomList.length === 0) {
        const createRes = await fetch("/api/tarot/rooms", {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const created = await createRes.json();
        roomList = [created];
      }

      setRooms(roomList);
      const roomParam = searchParams.get("room");
      const initialRoomId = roomList.find((r) => r.id === roomParam)?.id ?? roomList[0].id;
      setActiveRoomId(initialRoomId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/tarot/rooms", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const created: Room = await res.json();
    setRooms((prev) => [created, ...prev]);
    setActiveRoomId(created.id);
    router.replace(`/tarot?room=${created.id}`);
  }

  async function handleDeleteRoom(roomId: string) {
    if (!user || rooms.length <= 1) return;
    if (!confirm("이 대화방을 삭제할까요?")) return;

    const idToken = await user.getIdToken();
    await fetch(`/api/tarot/rooms/${roomId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const remaining = rooms.filter((r) => r.id !== roomId);
    setRooms(remaining);
    if (activeRoomId === roomId) {
      setActiveRoomId(remaining[0].id);
      router.replace(`/tarot?room=${remaining[0].id}`);
    }
  }

  function handleSelectRoom(roomId: string) {
    setActiveRoomId(roomId);
    router.replace(`/tarot?room=${roomId}`);
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {showWelcome && <WelcomePopup onClose={() => setShowWelcome(false)} />}

      <div className="shrink-0 p-4 pb-0">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-bold-text">타연 · 타로</h1>
          <span className="text-sm text-text">보유 코인: {coins ?? "-"}</span>
        </div>

        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {rooms.map((room) => (
          <div key={room.id} className="group relative flex-shrink-0">
            <button
              type="button"
              onClick={() => handleSelectRoom(room.id)}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
                activeRoomId === room.id
                  ? "border-point bg-point-bg text-point"
                  : "border-border text-text"
              }`}
            >
              {room.title}
            </button>
            {rooms.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteRoom(room.id)}
                aria-label="대화방 삭제"
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-urgent text-[10px] text-urgent-text group-hover:flex"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleNewRoom}
          className="flex-shrink-0 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-text"
        >
          + 새 대화
        </button>
        </div>

        {(activeTimePass || timePasses.length > 0) && (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-point bg-point-bg px-3 py-2 text-xs">
            {activeTimePass ? (
              <span className="whitespace-nowrap text-point">
                ⏱ {formatRemaining(new Date(activeTimePass.expiresAt).getTime() - now)} 남음 ·{" "}
                {activeTimePass.minutes}분권
                {activeTimePass.includesOptions ? " (전부 무제한)" : " (타로만 무제한)"}
              </span>
            ) : (
              timePasses.map((pass) => (
                <div
                  key={pass.id}
                  className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-point px-3 py-1 text-point"
                >
                  <span>
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
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pt-0">
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

      <div className="shrink-0 border-t border-border p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(SPREADS) as SpreadKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSpread(key)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${
              spread === key ? "border-point bg-point-bg text-point" : "border-border text-text"
            }`}
          >
            {SPREADS[key].label} · {SPREADS[key].cost}코인
          </button>
        ))}
      </div>

      {(hasBirthInfo || hasPartner) && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {hasBirthInfo && (
            <>
              <button
                type="button"
                onClick={() => setIncludeSaju(!includeSaju)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${
                  includeSaju ? "border-point bg-point-bg text-point" : "border-border text-text"
                }`}
              >
                +사주 · {SAJU_ADD_ON_COST}코인
              </button>
              <button
                type="button"
                onClick={() => setIncludeZiwei(!includeZiwei)}
                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${
                  includeZiwei ? "border-point bg-point-bg text-point" : "border-border text-text"
                }`}
              >
                +자미두수 · {ZIWEI_ADD_ON_COST}코인
              </button>
            </>
          )}
          {hasPartner && (
            <button
              type="button"
              onClick={() => setIncludeCompatibility(!includeCompatibility)}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${
                includeCompatibility ? "border-point bg-point-bg text-point" : "border-border text-text"
              }`}
            >
              +궁합 · {COMPATIBILITY_ADD_ON_COST}코인
            </button>
          )}
          <span className="whitespace-nowrap text-xs text-text">
            총 {displayedCost}코인
            {spreadCoveredDisplay && <span className="text-point"> (이용권 적용)</span>}
          </span>
        </div>
      )}

      {!hasBirthInfo && (
        <p className="pt-2 text-xs text-text">
          <Link href="/me" className="text-point underline">
            내 정보
          </Link>
          에서 생년월일시를 입력하면 사주/자미두수도 함께 볼 수 있어요.
        </p>
      )}
      {!hasPartner && (
        <p className="pt-1 text-xs text-text">
          <Link href="/compatibility" className="text-point underline">
            궁합 상대 정보
          </Link>
          를 저장하면 궁합도 함께 볼 수 있어요.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 pt-2">
        <input
          ref={questionInputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="궁금한 것을 물어보세요"
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-bold-text outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="flex-shrink-0 whitespace-nowrap rounded-full bg-cta-fill px-4 py-2 text-sm text-cta-text disabled:opacity-50"
        >
          질문하기
        </button>
      </form>
      </div>
    </div>
  );
}
