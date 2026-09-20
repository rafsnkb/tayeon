"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRooms, type CountPass, type TimePass } from "@/lib/tarot/RoomsContext";
import { COUNT_PACKAGES, availableCount, COMBOS, countPassDisplayName, type ComboKey } from "@/lib/tarot/pricing";
import { TIER_TEXTURE, TIME_COMBO_TIER } from "@/lib/tarot/timePassTiers";
import {
  SPREADS,
  type SpreadKey,
} from "@/lib/tarot/pricing";
import { openMenu } from "@/lib/ui/menuBus";
import ConfirmModal from "@/components/ConfirmModal";
import RoomLimitModal from "@/components/RoomLimitModal";
import SuspensionModal, { parseSuspensionError, type SuspensionInfo } from "@/components/SuspensionModal";
import { BrandBi } from "@/components/BrandBi";
import { CompanyInfoBar } from "@/components/CompanyInfoBar";
import {
  MenuIcon,
  SendIcon,
  RoomInfoIcon,
  NewChatIcon,
  CompatibilityIcon,
  CloseIcon,
  PencilIcon,
  TrashIcon,
  SpreadOneIcon,
  SpreadThreeIcon,
  SpreadDualIcon,
  SpreadCelticIcon,
  TicketIcon,
  InfoCircleIcon,
} from "./icons";

const DEFAULT_ROOM_TITLE = "새 대화";

const SPREAD_ICONS: Record<SpreadKey, (props: { className?: string }) => React.JSX.Element> = {
  one: SpreadOneIcon,
  three: SpreadThreeIcon,
  dual: SpreadDualIcon,
  celtic: SpreadCelticIcon,
};

const INPUT_MODE_SPREAD_LABEL: Record<SpreadKey, string> = {
  one: "원 카드",
  three: "쓰리 카드",
  dual: "양자택일",
  celtic: "켈틱 크로스",
};

// 활성 이용권 이름 + 조합 표기 — "스탠다드 이용권(타로+사주+자미두수 전용)" 형식(combo:"any"인
// 가입 무료체험은 특정 조합에 묶이지 않으므로 괄호 생략).
function countPassFullName(pass: { productId?: string; source?: string; combo: ComboKey | "any" }): string {
  const base = countPassDisplayName(pass);
  return pass.combo === "any" ? base : `${base}(${COMBOS[pass.combo].label} 전용)`;
}

const COUNT_PASS_CARD_TIERS = [
  { border: "#9de9ed", text: "#9de9ed", tagBg: "rgba(12, 68, 86, 0.86)", bg: TIER_TEXTURE[4] },
  { border: "#2f8bee", text: "#66b0ff", tagBg: "rgba(15, 52, 98, 0.86)", bg: TIER_TEXTURE[3] },
  { border: "#2f8bee", text: "#66b0ff", tagBg: "rgba(15, 52, 98, 0.86)", bg: TIER_TEXTURE[3] },
  { border: "#8335d6", text: "#a04ff8", tagBg: "rgba(56, 24, 82, 0.86)", bg: TIER_TEXTURE[2] },
  { border: "#8335d6", text: "#a04ff8", tagBg: "rgba(56, 24, 82, 0.86)", bg: TIER_TEXTURE[2] },
  { border: "#ff007f", text: "#ff007f", tagBg: "rgba(82, 17, 59, 0.86)", bg: TIER_TEXTURE[1] },
];

function CountPassUsageModal({ pass, onClose }: { pass: CountPass; onClose: () => void }) {
  const productIndex = COUNT_PACKAGES.findIndex((pkg) => pkg.id === pass.productId);
  const product = productIndex >= 0 ? COUNT_PACKAGES[productIndex] : null;
  const tier = COUNT_PASS_CARD_TIERS[productIndex >= 0 ? productIndex : 1];
  const remainingPercent = Math.max(0, Math.min(100, pass.remaining * 100)).toFixed(2);

  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[32px] border border-border bg-topbar p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">이용권 사용량</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text"><CloseIcon className="h-5 w-5" /></button>
        </div>
        <p className="mb-2 text-center text-sm font-semibold text-icon-muted">현재 이용권</p>
        <div className="relative h-20 overflow-hidden rounded-[28px] border bg-cover bg-center p-4" style={{ borderColor: tier.border, backgroundImage: `url(${tier.bg})` }}>
          <div className="absolute inset-0 bg-[#19191d]/70" />
          <div className="relative">
            <p className="text-xl font-bold text-white">{countPassFullName(pass)}</p>
            <span className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold" style={{ color: tier.text, backgroundColor: tier.tagBg }}>
              {product?.bonus ?? "무료 이용권"}
            </span>
          </div>
        </div>
        <p className="mb-2 mt-6 text-center text-sm font-semibold text-icon-muted">남은 사용량</p>
        <p className="mx-auto w-fit rounded-full bg-chip-fill px-4 py-1 text-xl font-bold text-white">{remainingPercent}%</p>
      </div>
    </div>
  );
}

type TarotCardInfo = { id: string; nameKo: string; nameEn: string; reversed: boolean };

type ChatMessage =
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

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const READING_LOADING_MESSAGES = [
  "카드를 섞고 있습니다...",
  "운명의 흐름을 읽는 중...",
  "숨겨진 의미를 찾는 중...",
  "당신을 위한 조언을 준비하고 있습니다...",
];

function ReadingLoadingMessage() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [phase, setPhase] = useState<"typing" | "holding" | "fading">("typing");
  const message = READING_LOADING_MESSAGES[messageIndex];

  useEffect(() => {
    if (phase === "typing") {
      if (typedLength < message.length) {
        const timeout = setTimeout(() => setTypedLength((length) => length + 1), 42);
        return () => clearTimeout(timeout);
      }
      setPhase("holding");
      return;
    }

    if (phase === "holding") {
      const timeout = setTimeout(() => setPhase("fading"), 1000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setMessageIndex((index) => (index + 1) % READING_LOADING_MESSAGES.length);
      setTypedLength(0);
      setPhase("typing");
    }, 1000);
    return () => clearTimeout(timeout);
  }, [message.length, phase, typedLength]);

  return (
    <div
      aria-live="polite"
      className={`self-start rounded-2xl bg-surface px-4 py-3 text-text transition-opacity duration-1000 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      {message.slice(0, typedLength)}
      {phase === "typing" && <span aria-hidden="true" className="ml-0.5 inline-block animate-pulse">|</span>}
    </div>
  );
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
        <strong key={i} className="font-semibold text-bold-text">
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
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-w-sm flex-col gap-3 rounded-2xl bg-surface p-6">
        <h2 className="text-lg font-bold text-bold-text">타연에 오신 걸 환영해요</h2>
        <ul className="list-disc pl-5 text-sm text-text">
          <li>타연은 오락 목적의 서비스이며, 의학적·법적·재정적 조언을 대체하지 않습니다.</li>
          <li>만 14세 미만은 이용이 제한됩니다.</li>
          <li>횟수제ㆍ시간제 이용권은 구입일부터 1년 동안 사용할 수 있어요.</li>
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
          className="mt-2 h-12 rounded-full bg-cta-fill px-5 text-base font-semibold text-cta-text"
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

function TimePassCard({ pass, actionLabel, onAction, busy }: {
  pass: TimePass;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}) {
  const tier = TIME_COMBO_TIER[pass.combo] ?? TIME_COMBO_TIER.tarot;
  return (
    <div
      className="relative flex h-20 items-center gap-2 overflow-hidden rounded-[32px] border bg-cover bg-center px-4"
      style={{ borderColor: tier.border, backgroundImage: `url(${tier.bg})` }}
    >
      <div className="absolute inset-0 bg-[#19191d]/70" />
      <div className="relative flex flex-1 flex-col gap-1">
        <span className="text-2xl font-bold text-white">{pass.minutes}분 무제한</span>
        <span
          className="w-fit rounded-full px-2 py-0.5 text-sm font-semibold"
          style={{ backgroundColor: tier.tagBg, color: tier.tagText }}
        >
          {COMBOS[pass.combo].label} 무제한
        </span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="relative shrink-0 rounded-2xl bg-point px-5 py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** 피그마 "Screen / HeldTimepassListModal" — 보유한 시간제 이용권을 카드로 나열, 사용하기를
 * 누르면 확인 모달(HeldTimepassUseModal)로 넘어간다. */
function HeldTimepassListModal({
  timePasses,
  onSelect,
  onClose,
}: {
  timePasses: TimePass[];
  onSelect: (pass: TimePass) => void;
  onClose: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm max-h-[70vh] flex-col gap-4 rounded-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-1">
          <div className="w-5" />
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-bold-text">보유 시간제 이용권</p>
            <p className="text-sm font-semibold text-icon-muted">사용할 시간제 이용권을 선택하세요</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto">
          {timePasses.map((pass) => (
            <TimePassCard
              key={pass.id}
              pass={pass}
              actionLabel="사용하기"
              onAction={() => onSelect(pass)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 피그마 "Screen / HeldTimepassUseModal" — 실제로 활성화되면 즉시 시간 차감이 시작된다는 걸
 * 한 번 더 확인시키는 모달. */
function HeldTimepassUseModal({
  pass,
  busy,
  onConfirm,
  onClose,
}: {
  pass: TimePass;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-1">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">시간제 이용권 사용하기</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-center text-sm font-semibold text-icon-muted">선택한 시간제 이용권</p>
        <TimePassCard pass={pass} />
        <p className="text-center text-base font-semibold text-bold-text">
          선택한 시간제 이용권을 사용하시겠어요?
        </p>
        <p className="text-center text-sm font-semibold text-urgent">
          시간제 이용권은 사용하기를 누른 순간부터 시간 차감이 시작되며, 브라우저를 닫아도 멈추지 않습니다.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-12 w-full rounded-2xl bg-point text-base font-semibold text-white disabled:opacity-60"
        >
          사용하기
        </button>
      </div>
    </div>
  );
}

/** 피그마 "Screen / NoHeldTimepassModal" — 보유 시간제 이용권 배지를 눌렀는데 보유한 이용권이
 * 없을 때(HeldTimepassListModal 대신) 뜨는, 화면 중앙에 뜨는 안내 모달. */
function NoHeldTimepassModal({ onClose, onGoCharge }: { onClose: () => void; onGoCharge: () => void }) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center gap-3 p-1">
          <div className="w-5" />
          <div className="flex-1 text-center">
            <p className="text-lg font-bold text-bold-text">보유 시간제 이용권</p>
            <p className="text-sm font-semibold text-icon-muted">사용할 시간제 이용권을 선택하세요</p>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-center text-base font-semibold text-bold-text">보유한 시간제 이용권이 없습니다.</p>
        <button
          type="button"
          onClick={onGoCharge}
          className="h-12 w-full rounded-2xl bg-point text-base font-semibold text-white"
        >
          구입하러 가기
        </button>
      </div>
    </div>
  );
}

function PurchaseTicketModal({
  onClose,
  onInvite,
  onPurchase,
}: {
  onClose: () => void;
  onInvite: () => void;
  onPurchase: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">인연의 끈을 이어갈까요?</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-5 text-center text-sm font-semibold leading-5 text-icon-muted">
          당신의 앞길을 비춰줄 조언을 더 주고싶지만,<br />
          아쉽게도 가진 이용권을 모두 사용하셨어요.
        </p>
        <p className="mt-4 text-center text-sm font-semibold leading-5 text-icon-muted">
          새로운 나침반이 필요하다면<br />
          언제든 이용권을 채워주세요.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onInvite} className="h-12 flex-1 rounded-full bg-cta-fill text-base font-bold text-cta-text">
            친구 초대하기
          </button>
          <button type="button" onClick={onPurchase} className="h-12 flex-1 rounded-full bg-point text-base font-bold text-white">
            이용권 구입하기
          </button>
        </div>
        <p className="mt-5 text-center text-xs font-semibold text-icon-muted">기존 대화는 안전하게 보관됩니다.</p>
      </div>
    </div>
  );
}

/** 피그마 "Screen / ChatroomNameEdit" — 대화방 이름 변경. 기존엔 브라우저 기본 prompt()를 썼음. */
function RenameRoomModal({
  initialTitle,
  busy,
  onConfirm,
  onClose,
}: {
  initialTitle: string;
  busy: boolean;
  onConfirm: (title: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">채팅방 이름 변경</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-center text-sm font-semibold text-icon-muted">변경할 이름을 입력해주세요</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="채팅방 이름 입력"
          autoFocus
          className="mb-6 h-12 w-full rounded-2xl bg-bg px-4 text-base text-bold-text placeholder-placeholder outline-none"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-chip-fill text-base font-semibold text-white"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => title.trim() && onConfirm(title.trim())}
            disabled={busy || !title.trim()}
            className="h-12 flex-1 rounded-2xl bg-point text-base font-semibold text-white disabled:opacity-60"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
}

/** 피그마 "Screen / SpreadSelect"의 List_Spread — 스프레드 4종을 설명+가격과 함께 고르는 바텀시트 */
function SpreadSelectSheet({
  spread,
  remainingBySpread,
  timePassActive,
  onSelect,
  includeCompatibility,
  hasPartner,
  onToggleCompatibility,
  onClose,
}: {
  spread: SpreadKey;
  remainingBySpread: Record<SpreadKey, number>;
  timePassActive: boolean;
  onSelect: (key: SpreadKey) => void;
  includeCompatibility: boolean;
  hasPartner: boolean;
  onToggleCompatibility: () => void;
  onClose: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="w-full xl:mx-auto xl:max-w-4xl rounded-t-[28px] border border-border bg-topbar p-4"
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
                      <span className="text-lg font-semibold text-bold-text">{SPREADS[key].label} 스프레드</span>
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
                    <span className="text-xs font-semibold text-icon-muted">남은 횟수</span>
                    <span className="text-base font-semibold text-gold">{timePassActive ? "무제한" : `${remainingBySpread[key]}회`}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <section className="mt-3">
          <p className="text-center text-lg font-bold text-bold-text">궁합 해석 추가</p>
          <p className="text-center text-sm font-semibold text-icon-muted">사주ㆍ자미두수 정보를 기반으로 궁합까지 타로 리딩</p>
          <p className="text-center text-sm font-semibold text-urgent [word-break:keep-all]">궁합 해석을 추가하려면 상대방 프로필 정보가 필요합니다.</p>
          <div className="mt-2 rounded-2xl bg-[#f7f4fb] dark:bg-chip-fill">
            <div className="flex items-center gap-3 px-4 py-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[#79678f] dark:text-bold-text"><CompatibilityIcon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-bold-text">궁합 해석 추가</span>
                <span className="block text-sm font-semibold text-icon-muted">상대방과의 궁합을 더 자세하게 분석</span>
              </span>
              <Switch checked={includeCompatibility} onChange={onToggleCompatibility} disabled={!hasPartner} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** 피그마 "Screen / SpreadSelect"(궁합 추가 시트)가 쓰던 on/off 스위치 — 기존 코드베이스엔
 * 세그먼트 버튼(ToggleGroup)만 있고 iOS류 스위치가 없어서 신설. 스프레드 선택 시트 하단의 궁합
 * 스위치가 그대로 재사용한다(2026-09-18, 사주/자미두수는 이용권 조합 고정으로 별도 시트 제거됨). */
function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-7 w-[72px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? "bg-point" : "bg-[#868b9a] dark:bg-icon-muted"
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-6 w-6 rounded-full transition-transform ${
          checked ? "translate-x-[46px] bg-white" : "translate-x-[2px] bg-[#dcdee3] dark:bg-cta-fill"
        }`}
      />
    </button>
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
    countPasses,
    setCountPasses,
    activeCountPass: activeCountPassInfo,
    refreshMe,
    rooms,
    activeRoomId,
    selectRoom,
    loaded: roomsLoaded,
    createRoom,
    deleteRoom,
    renameRoom,
    setRoomTitleLocal,
    hasBirthInfo,
    myTimeUnknown,
    hasPartner,
    activeTimePass,
    setActiveTimePass,
    timePasses,
    setTimePasses,
    hasUnreadNotifications,
    pendingReadingRoomIds,
    markReadingPending,
    markReadingDone,
  } = useRooms();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => searchParams.get("welcome") === "1");
  const [spread, setSpread] = useState<SpreadKey>("one");
  const [countPassUsageOpen, setCountPassUsageOpen] = useState(false);
  const [includeCompatibility, setIncludeCompatibility] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [greetingAnimationRoomId, setGreetingAnimationRoomId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [startingPass, setStartingPass] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [spreadSheetOpen, setSpreadSheetOpen] = useState(false);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [timePassListOpen, setTimePassListOpen] = useState(false);
  const [noTimePassModalOpen, setNoTimePassModalOpen] = useState(false);
  const [purchaseTicketOpen, setPurchaseTicketOpen] = useState(false);
  const [timePassToUse, setTimePassToUse] = useState<TimePass | null>(null);
  const [renameModalRoomId, setRenameModalRoomId] = useState<string | null>(null);
  const [deleteModalRoomId, setDeleteModalRoomId] = useState<string | null>(null);
  const [roomLimitOpen, setRoomLimitOpen] = useState(false);
  const [roomLimitBusy, setRoomLimitBusy] = useState(false);
  const [suspension, setSuspension] = useState<SuspensionInfo | null>(null);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLInputElement>(null);
  const greetedRoomIdsRef = useRef<Set<string>>(new Set());
  // 이 방에서 진행 중인 리딩 요청이 있는지 — 이 인스턴스가 직접 시작했든(loading), 로딩 중
  // 페이지 이동 후 돌아와서 다른(재마운트 전) 인스턴스가 시작한 걸 뒤늦게 알게 됐든
  // (isRoomPending) 상관없이 UI는 동일하게 "응답 대기 중"으로 보여줘야 한다.
  const isRoomPending = Boolean(activeRoomId && pendingReadingRoomIds.has(activeRoomId));
  const showLoading = loading || isRoomPending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, showLoading]);

  useEffect(() => {
    if (!activeTimePass || new Date(activeTimePass.expiresAt).getTime() <= now) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimePass]);


  // 방 목록은 RoomsContext(레이아웃 레벨)가 불러온다 — 여기서는 URL의 ?room= 파라미터가
  // 가리키는 방으로 맞춰준다(없으면 컨텍스트가 이미 골라둔 기본값을 그대로 씀).
  // 이 effect가 searchParams에 의존하지 않던 버전에서는(2026-09-15 발견) "새 대화" 버튼을 누르면
  // createRoom()이 activeRoomId를 새 방으로 먼저 바꾸고 → rooms 배열이 바뀌어 이 effect가 다시
  // 실행되는데, 그 시점엔 router.replace/push가 아직 URL을 못 바꿔서 searchParams가 옛 방 id를
  // 그대로 들고 있었음 — 그래서 방금 바뀐 activeRoomId를 옛 방으로 도로 되돌려버리는 경쟁 상태가
  // 있었다(새 방은 생성되지만 화면은 옛 방에 그대로 머무는 버그). searchParams를 의존성에 추가하면
  // URL이 뒤늦게 갱신될 때 이 effect가 한 번 더 실행되어 activeRoomId를 다시 새 방으로 맞춰준다.
  useEffect(() => {
    if (!roomsLoaded || rooms.length === 0) return;
    const roomParam = searchParams.get("room");
    if (roomParam && rooms.some((r) => r.id === roomParam) && roomParam !== activeRoomId) {
      selectRoom(roomParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomsLoaded, rooms, searchParams]);

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
      isGreeting?: boolean;
      question: string | null;
      spread: SpreadKey | null;
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
    return readings.flatMap((r): ChatMessage[] => {
      const assistantMsg: ChatMessage = {
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
        isGreeting: r.isGreeting,
      };
      // 인사말은 사용자의 질문 없이 캐릭터가 먼저 건네는 말이라 "user" 말풍선 없이 단독으로 넣는다.
      return r.isGreeting ? [assistantMsg] : [{ role: "user", text: r.question ?? "" }, assistantMsg];
    });
  }

  useEffect(() => {
    if (!user || !activeRoomId) return;

    (async () => {
      setHistoryLoaded(false);
      const history = await fetchRoomHistory(activeRoomId);
      if (history) {
        const hasOnlyGreeting = history.length > 0 && history.every((message) => message.role === "assistant" && message.isGreeting);
        const shouldAnimateGreeting = hasOnlyGreeting && !greetedRoomIdsRef.current.has(activeRoomId);
        greetedRoomIdsRef.current.add(activeRoomId);
        setGreetingAnimationRoomId(shouldAnimateGreeting ? activeRoomId : null);
        setMessages(history);
      }
      setHistoryLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeRoomId]);

  useEffect(() => {
    if (!greetingAnimationRoomId) return;
    const timeout = setTimeout(() => setGreetingAnimationRoomId(null), 3600);
    return () => clearTimeout(timeout);
  }, [greetingAnimationRoomId]);

  // 방금 물어본 질문이 이 방에서 서버 응답을 기다리는 중인지는 RoomsContext(레이아웃 레벨,
  // 재마운트에 영향 안 받음)로 추적한다 — 로딩 중에 다른 페이지로 이동했다가 돌아오면 이
  // TarotChat 인스턴스는 통째로 재마운트되어 로컬 loading/messages state가 초기화되는데,
  // 그 사이 서버는 리딩 저장·이용권 차감을 끝냈을 수 있다. 아무 데도 그 사실을 확인할 방법이
  // 없으면 방금 물어본 질문+답변이 그냥 사라진 것처럼 보인다(2026-09-14, 사용자 리포트).
  const startedHereRef = useRef<Set<string>>(new Set());
  // 시간제 이용권이 "활성 → 만료"로 바뀌는 순간을 잡아 지금 보고 있는 채팅방에 경고 메시지를
  // 한 번만 띄우기 위한 플래그(2026-09-20, 사용자 요청) — activeTimePass 자체가 없어서
  // timePassActive가 처음부터 false인 경우(방을 열었을 때 이미 이용권이 없던 경우)에는
  // 안 띄워야 하므로, "한때 true였다가 false가 됐는지"만 본다.
  const wasTimePassActiveRef = useRef(false);
  const prevPendingRef = useRef<{ roomId: string | null; pending: boolean }>({
    roomId: null,
    pending: false,
  });
  useEffect(() => {
    if (!activeRoomId) return;
    const prev = prevPendingRef.current;
    if (!isRoomPending && prev.roomId === activeRoomId && prev.pending) {
      if (startedHereRef.current.has(activeRoomId)) {
        // 이 인스턴스가 직접 시작한 요청 — handleSubmit이 이미 setMessages로 결과를 반영했다.
        startedHereRef.current.delete(activeRoomId);
      } else {
        // 다른(아마 이미 언마운트된) 인스턴스가 시작한 요청이 방금 끝남 — 히스토리를 다시
        // 불러와서 반영한다.
        fetchRoomHistory(activeRoomId).then((history) => {
          if (history) setMessages(history);
        });
      }
    }
    prevPendingRef.current = { roomId: activeRoomId, pending: isRoomPending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRoomPending, activeRoomId]);

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
        const suspensionInfo = parseSuspensionError(data);
        if (suspensionInfo) {
          setSuspension(suspensionInfo);
          return;
        }
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
    try {
      const created = await createRoom();
      if (created) router.replace(`/tarot?room=${created.id}`);
    } catch (error) {
      if (error instanceof Error && error.message === "ROOM_LIMIT") setRoomLimitOpen(true);
    }
  }

  async function confirmRoomLimit() {
    setRoomLimitBusy(true);
    try {
      const created = await createRoom(true);
      setRoomLimitOpen(false);
      if (created) router.replace(`/tarot?room=${created.id}`);
    } finally {
      setRoomLimitBusy(false);
    }
  }

  async function confirmDeleteRoom() {
    if (!deleteModalRoomId) return;
    setRoomActionBusy(true);
    try {
      await deleteRoom(deleteModalRoomId);
      setDeleteModalRoomId(null);
    } finally {
      setRoomActionBusy(false);
    }
  }

  async function confirmRenameRoom(title: string) {
    if (!renameModalRoomId) return;
    setRoomActionBusy(true);
    try {
      await renameRoom(renameModalRoomId, title);
      setRenameModalRoomId(null);
    } finally {
      setRoomActionBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || showLoading || !user || !activeRoomId) return;

    if (includeCompatibility && !hasPartner) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "궁합을 보려면 메뉴 > 궁합 상대 정보에서 상대방 정보를 먼저 저장해주세요." },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setQuestion("");
    setLoading(true);
    startedHereRef.current.add(activeRoomId);
    markReadingPending(activeRoomId);

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
          includeCompatibility: effectiveIncludeCompatibility,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        const suspensionInfo = parseSuspensionError(data);
        if (suspensionInfo) {
          setSuspension(suspensionInfo);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "error", text: data.error ?? "오류가 발생했어요." },
        ]);
        return;
      }

      if (data.countPassApplied) await refreshMe();
      if (data.roomTitle) setRoomTitleLocal(activeRoomId, data.roomTitle);
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
      // 응답이 오는 도중 연결이 끊기면(모바일에서 흔함), 서버는 이미 리딩 저장·이용권 차감까지
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
            setCountPasses(meData.countPasses ?? []);
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
      markReadingDone(activeRoomId);
    }
  }

  const timePassActive = Boolean(
    activeTimePass && new Date(activeTimePass.expiresAt).getTime() > now
  );
  const spreadCoveredDisplay = timePassActive;
  useEffect(() => {
    if (timePassActive) {
      wasTimePassActiveRef.current = true;
      return;
    }
    if (wasTimePassActiveRef.current) {
      wasTimePassActiveRef.current = false;
      setMessages((prev) => [...prev, { role: "error", text: "사용중인 시간제 이용권이 종료되었습니다." }]);
    }
  }, [timePassActive]);
  // 활성 이용권(서버가 우선순위 큐로 고른 것)의 고정 조합 — combo:"any"(가입 무료체험)만 예외로
  // 생년월일시가 입력된 만큼만 자동 포함한다(src/lib/tarot/activeCountPass.ts의 서버 로직과 동일).
  const activeCountPass = countPasses.find((p) => p.id === activeCountPassInfo?.passId);
  const activeCombo = activeCountPass
    ? activeCountPass.combo === "any"
      ? { saju: hasBirthInfo, ziwei: hasBirthInfo && !myTimeUnknown }
      : COMBOS[activeCountPass.combo]
    : { saju: false, ziwei: false };
  const remainingBySpread = Object.fromEntries(
    (Object.keys(SPREADS) as SpreadKey[]).map((key) => [
      key,
      activeCountPass ? availableCount(activeCountPass, key, activeCombo.saju, activeCombo.ziwei) : 0,
    ])
  ) as Record<SpreadKey, number>;
  const activeCountPassRemaining = activeCountPass
    ? availableCount(activeCountPass, spread, activeCombo.saju, activeCombo.ziwei)
    : 0;
  const hasUsableCountPass = countPasses.some(
    (pass) =>
      pass.remaining > 0 &&
      (pass.status === "unused" || pass.status === "active") &&
      (!pass.expiresAt || new Date(pass.expiresAt).getTime() > now)
  );
  const noUsableTicket = roomsLoaded && !timePassActive && timePasses.length === 0 && !hasUsableCountPass;
  // 파트너 정보가 사라진 뒤에도 스위치 상태가 그대로 남아있을 수 있어(effect 대신 파생값으로 처리),
  // 실제로 반영할 값은 항상 hasPartner와 함께 계산한다.
  const effectiveIncludeCompatibility = includeCompatibility && hasPartner;
  const inputModeLabel = [
    INPUT_MODE_SPREAD_LABEL[spread],
    effectiveIncludeCompatibility && "궁합",
  ].filter(Boolean).join(" + ") + " 모드";

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const isBlankRoom = (activeRoom?.title ?? DEFAULT_ROOM_TITLE) === DEFAULT_ROOM_TITLE && messages.length === 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-bg">
      {showWelcome && <WelcomePopup onClose={() => setShowWelcome(false)} />}
      {countPassUsageOpen && activeCountPass && (
        <CountPassUsageModal pass={activeCountPass} onClose={() => setCountPassUsageOpen(false)} />
      )}
      {spreadSheetOpen && (
        <SpreadSelectSheet
          spread={spread}
          remainingBySpread={remainingBySpread}
          timePassActive={timePassActive}
          onSelect={setSpread}
          includeCompatibility={effectiveIncludeCompatibility}
          hasPartner={hasPartner}
          onToggleCompatibility={() => setIncludeCompatibility((v) => !v)}
          onClose={() => setSpreadSheetOpen(false)}
        />
      )}
      {timePassListOpen && (
        <HeldTimepassListModal
          timePasses={timePasses}
          onSelect={(pass) => {
            setTimePassListOpen(false);
            setTimePassToUse(pass);
          }}
          onClose={() => setTimePassListOpen(false)}
        />
      )}
      {timePassToUse && (
        <HeldTimepassUseModal
          pass={timePassToUse}
          busy={startingPass === timePassToUse.id}
          onConfirm={async () => {
            await handleStartTimePass(timePassToUse.id);
            setTimePassToUse(null);
          }}
          onClose={() => setTimePassToUse(null)}
        />
      )}
      {noTimePassModalOpen && (
        <NoHeldTimepassModal
          onClose={() => setNoTimePassModalOpen(false)}
          onGoCharge={() => {
            setNoTimePassModalOpen(false);
            router.push("/charge?tab=time");
          }}
        />
      )}
      {purchaseTicketOpen && (
        <PurchaseTicketModal
          onClose={() => setPurchaseTicketOpen(false)}
          onInvite={() => {
            setPurchaseTicketOpen(false);
            router.push("/invite");
          }}
          onPurchase={() => {
            setPurchaseTicketOpen(false);
            router.push("/charge");
          }}
        />
      )}
      {renameModalRoomId && (
        <RenameRoomModal
          initialTitle={rooms.find((r) => r.id === renameModalRoomId)?.title ?? ""}
          busy={roomActionBusy}
          onConfirm={confirmRenameRoom}
          onClose={() => setRenameModalRoomId(null)}
        />
      )}
      {deleteModalRoomId && (
        <ConfirmModal
          title="채팅방 삭제"
          description={"채팅방을 삭제하시겠어요?\n삭제된 대화는 복구가 불가능합니다."}
          confirmLabel="삭제하기"
          busy={roomActionBusy}
          onConfirm={confirmDeleteRoom}
          onClose={() => setDeleteModalRoomId(null)}
        />
      )}
      {roomLimitOpen && (
        <RoomLimitModal
          busy={roomLimitBusy}
          onConfirm={confirmRoomLimit}
          onClose={() => setRoomLimitOpen(false)}
        />
      )}
      {suspension && <SuspensionModal info={suspension} onClose={() => setSuspension(null)} />}
      <div className="app-topbar-glass absolute inset-x-0 top-0 z-20 flex h-16 items-center border-b border-border">
        <div className="flex h-full w-full items-center xl:mx-auto xl:max-w-4xl xl:pl-4">
        <button
          type="button"
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="relative flex h-16 w-16 shrink-0 items-center justify-center text-icon-muted xl:hidden"
        >
          <MenuIcon className="h-3 w-5" />
          {hasUnreadNotifications && (
            <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-point" />
          )}
        </button>
        {/* 방 목록은 메뉴 드로어((app)/layout.tsx)에 있음 — 방 이름을 누르면 그 드로어를 연다.
            아직 한 번도 안 쓴 방("새 대화" 기본 제목 그대로)은 피그마 "Screen / Main"처럼 제목 대신
            타연 워드마크를 중앙에 보여주고, 방 컨트롤(이름변경/삭제/새대화/이용권뱃지)도 감춘다. */}
        {isBlankRoom ? (
          <button
            type="button"
            onClick={openMenu}
            className="flex flex-1 items-center justify-center"
          >
            <BrandBi className="h-6 w-12" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={openMenu}
              className="min-w-0 flex-1 truncate text-center text-base font-semibold text-bold-text"
            >
              {activeRoom?.title ?? DEFAULT_ROOM_TITLE}
            </button>
            <div className="flex shrink-0 items-center gap-2 pr-4">
              <button
                type="button"
                onClick={handleNewRoom}
                aria-label="새 대화"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-fill text-cta-text"
              >
                <NewChatIcon className="h-5 w-5" />
              </button>
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
                    <div className="absolute right-0 top-12 z-20 flex flex-col rounded-xl border border-border bg-topbar p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setRoomInfoOpen(false);
                          if (activeRoomId) setRenameModalRoomId(activeRoomId);
                        }}
                        className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold text-bold-text"
                      >
                        <PencilIcon className="h-4 w-4" />
                        이름 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRoomInfoOpen(false);
                          if (activeRoomId) setDeleteModalRoomId(activeRoomId);
                        }}
                        disabled={rooms.length <= 1}
                        className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-3 text-left text-sm font-semibold text-urgent disabled:opacity-40"
                      >
                        <TrashIcon className="h-4 w-4" />
                        대화 삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
      {/* 메시지 스크롤 영역(2026-09-15 재구성): 이용권 배지가 원래 스크롤 영역 "위"에 자기 줄을
          따로 차지하고 있어서, 실제로 스크롤 가능한 영역의 높이가 배지 줄 높이만큼 줄어들어 있었음
          — 실사용 중 발견된 "말풍선 상단이 배지 높이만큼 잘려 보인다"는 문제가 바로 이거였음(스크롤을
          아무리 올려도 그 잘린 부분은 배지 줄 뒤에 가려서 애초에 스크롤 영역 자체에 포함이 안 됨).
          배지를 별도 줄로 빼는 대신 스크롤 영역 위에 떠 있는 오버레이로 바꿔서, 스크롤 영역 자체는
          탑바 바로 아래부터 끝까지 전부 차지하도록 수정. 배지 아래로 콘텐츠가 자연스럽게 지나가도록
          상단 페이드(그라데이션 마스크)도 함께 적용. */}
      <div className="relative min-h-0 flex-1">
        {!isBlankRoom && (
          <div className="pointer-events-none absolute inset-x-0 top-16 z-10 mx-auto flex w-full justify-end px-4 pt-2 xl:max-w-4xl">
            <button
              type="button"
              onClick={() => (timePasses.length > 0 ? setTimePassListOpen(true) : setNoTimePassModalOpen(true))}
              aria-label="보유 시간제 이용권"
              className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full ${
                timePasses.length > 0
                  ? "bg-point text-white dark:h-9 dark:w-9 dark:border dark:border-point dark:bg-point-bg dark:text-point"
                  : "bg-[#79678f] text-white dark:h-9 dark:w-9 dark:border dark:border-icon-muted dark:bg-transparent dark:text-icon-muted"
              }`}
            >
              <TicketIcon className="h-5 w-6 dark:h-4 dark:w-5" />
            </button>
          </div>
        )}
        <div
          className={`mx-auto flex h-full w-full flex-col gap-3 overflow-y-auto p-4 xl:max-w-4xl ${
            isBlankRoom ? "pt-[76px]" : "pt-[120px]"
          }`}
        >
        {!historyLoaded && (
          <div className="self-start text-sm text-text">이전 대화를 불러오는 중...</div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              <div key={i} className="animate-fade-in self-end rounded-2xl bg-point px-4 py-2 text-white">
                {msg.text}
              </div>
            );
          }
          if (msg.role === "error") {
            return (
              <div key={i} className="animate-fade-in self-start rounded-2xl bg-urgent/10 px-4 py-2 text-urgent">
                {msg.text}
              </div>
            );
          }
          const greetingIndex = msg.isGreeting
            ? messages.slice(0, i).filter((message) => message.role === "assistant" && message.isGreeting).length
            : 0;
          const animateGreeting = msg.isGreeting && greetingAnimationRoomId === activeRoomId;
          return (
            <div
              key={i}
              className="animate-fade-in flex w-full flex-col items-start"
              style={animateGreeting ? { animationDelay: `${greetingIndex}s`, animationFillMode: "backwards" } : undefined}
            >
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
              {msg.cards.length > 0 && msg.spread && (
                <div className="mb-1 flex flex-col items-center gap-1">
                  <span className="rounded-full border border-border px-3 py-1 text-base font-semibold text-text">
                    {SPREADS[msg.spread].label}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold text-text">
                    {msg.cards.map((c, j) => (
                      <span key={j} className="rounded-full bg-text px-3 py-1 font-semibold text-surface">
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
              {!msg.isGreeting && !msg.charged && !msg.guidanceOnly && (
                <div className="mt-1 w-full text-xs">
                  <p className="px-1 text-text">해당 답변은 이용권 횟수가 차감되지 않습니다.</p>
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
                    ? "이번 답변에는 사주·자미두수 해석이 포함되지 않아 타로 기준으로만 이용권이 차감됐어요."
                    : msg.sajuFree
                      ? "이번 답변에는 사주 해석이 포함되지 않아 타로 기준으로만 이용권이 차감됐어요."
                      : "이번 답변에는 자미두수 해석이 포함되지 않아 타로 기준으로만 이용권이 차감됐어요."}
                </p>
              )}
              {msg.charged && msg.timePassApplied && (
                <p className="mt-1 w-full px-1 text-xs text-point">시간제 이용권으로 이용한 리딩이에요.</p>
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
        {showLoading && <ReadingLoadingMessage />}
        <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="mx-auto w-full shrink-0 px-4 pb-4 xl:max-w-4xl">
        {timePassActive && activeTimePass && (
          <div className="mb-2 flex items-center gap-2.5 rounded-2xl bg-chip-fill px-2.5 py-2">
            <span className="text-sm font-semibold text-white">시간제 사용중</span>
            <span className="text-sm font-semibold text-white">
              남은 시간: {formatRemaining(new Date(activeTimePass.expiresAt).getTime() - now)}
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 rounded-[40px] border border-border bg-surface px-[12px] pt-3 pb-[12px]"
        >
          <input
            ref={questionInputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onFocus={() => {
              if (noUsableTicket) {
                questionInputRef.current?.blur();
                setPurchaseTicketOpen(true);
              }
            }}
            placeholder="궁금한 것을 물어보세요"
            className="h-14 min-w-0 flex-1 bg-transparent px-3.5 text-base font-semibold text-bold-text placeholder-placeholder outline-none"
            disabled={showLoading}
          />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSpreadSheetOpen(true)}
              className="flex h-12 min-w-0 shrink items-center overflow-hidden rounded-full bg-chip-fill px-7 text-base font-semibold whitespace-nowrap text-white"
            >
              <span className="truncate">{inputModeLabel}</span>
            </button>
            <span className="min-w-0 flex-1" />
            <button
              type="submit"
              disabled={showLoading}
              aria-label="질문하기"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cta-fill text-cta-text disabled:opacity-50"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>

        <div className="flex flex-col items-start gap-1 px-1 pt-1.5 text-xs">
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
          {activeCountPass ? (
            <button type="button" onClick={() => setCountPassUsageOpen(true)} className="flex items-center gap-1 whitespace-nowrap text-icon-muted">
              <InfoCircleIcon className="h-4 w-4" />
              <span>{countPassFullName(activeCountPass)} / 남은 횟수: {activeCountPassRemaining}회</span>
            </button>
          ) : (
            <span className="whitespace-nowrap text-icon-muted">
            {spreadCoveredDisplay && activeTimePass
              ? `${activeTimePass.minutes}분 무제한 이용권 사용 중`
              : "보유 이용권 없음"}
            </span>
          )}
        </div>
      </div>
      <CompanyInfoBar />
    </div>
  );
}
