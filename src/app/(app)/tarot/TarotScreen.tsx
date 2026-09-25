"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withReturnTo } from "@/lib/navigation";
import Link from "next/link";
import { useRooms, type TimePass } from "@/lib/tarot/RoomsContext";
import { DEFAULT_ROOM_TITLE } from "@/lib/tarot/room";
import { availableCount, COMBOS, SPREADS, type SpreadKey } from "@/lib/tarot/pricing";
import { openMenu } from "@/lib/ui/menuBus";
import ConfirmModal from "@/components/ConfirmModal";
import RoomLimitModal from "@/components/RoomLimitModal";
import SuspensionModal, { parseSuspensionError, type SuspensionInfo } from "@/components/SuspensionModal";
import { BrandBi } from "@/components/BrandBi";
import { MainCompanyInfo } from "@/components/MainCompanyInfo";
import LoginModal from "@/components/LoginModal";
import {
  MenuIcon,
  SendIcon,
  RoomInfoIcon,
  CompatibilityIcon,
  CloseIcon,
  PencilIcon,
  TrashIcon,
} from "./icons";
import {
  countPassFullName,
  PassBar,
  PassUsageModal,
  HeldTimepassUseModal,
  PurchaseTicketModal,
} from "./passes";
import {
  ReadingLoadingMessage,
  SpreadCards,
  TypewriterText,
  TYPING_SPEED_MS,
  renderInterpretation,
  type ChatMessage,
  type TarotCardInfo,
} from "./reading";
import {
  INPUT_MODE_SPREAD_LABEL,
  SPREAD_ICONS,
  SpreadSelectSheet,
  useTypingPlaceholder,
} from "./composer";


/** /api/tarot/reading 스트림의 마지막 `done` 이벤트. 예전 비스트리밍 응답 본문과 같은 모양이다. */
type ReadingDonePayload = {
  interpretation: string;
  spread: SpreadKey | null;
  cards: TarotCardInfo[];
  includeSaju: boolean;
  includeZiwei: boolean;
  includeCompatibility: boolean;
  partnerNickname: string | null;
  charged: boolean;
  countPassApplied?: boolean;
  sajuFree?: boolean;
  ziweiFree?: boolean;
  guidanceOnly?: boolean;
  flaggedForAbuse?: boolean;
  timePassApplied?: boolean;
  suggestions?: string[];
  roomTitle?: string | null;
};
/** 마지막으로 고른 스프레드. 기기별 화면 설정이라 계정이 아니라 브라우저에 둔다 —
 *  개인정보처리방침이 이미 "다크모드 등 일부 화면 설정값은 localStorage 에 저장된다"고
 *  고지하고 있어 이 용도는 그 범위 안이다(src/lib/legal/content.ts). */
const SPREAD_STORAGE_KEY = "tayeon.tarot.spread";
/** 인사말 말풍선 사이의 쉼. 앞 줄을 다 찍고 이만큼 쉬었다가 다음 줄이 시작한다. */
const GREETING_LINE_GAP_MS = 400;

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WelcomePopup({ onClose }: { onClose: () => void }) {
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
            <a href="/terms" target="_blank" className="text-point-text underline">
              이용약관
            </a>{" "}
            및{" "}
            <a href="/privacy" target="_blank" className="text-point-text underline">
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
/** 피그마 "Screen / ChatroomNameEdit" — 대화방 이름 변경. 기존엔 브라우저 기본 prompt()를 썼음. */
export function RenameRoomModal({
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
/** 메인(`/`)과 대화방(`/tarot/[roomId]`)이 공유하는 화면. 둘의 차이는 roomId 하나뿐이다 —
 *  null 이면 메인(상단바에 제목·더보기 없음, 중앙 카피, 하단 사업자정보, 이용권 바 없음),
 *  값이 있으면 그 방의 대화방이다(피그마 New/Main_*, New/Chattingroom_*, 2026-09-24).
 *
 *  예전엔 한 라우트(`/tarot`)가 "제목이 기본값이고 메시지가 0개인 방"을 메인처럼 보이게
 *  흉내냈다(isBlankRoom). 화면은 비슷했지만 **들어오자마자 빈 방이 하나 만들어지고** 그 방에
 *  머무는 구조라, 초기 화면과 대화방이 URL로도 개념으로도 구분되지 않았다. */
export function TarotScreen() {
  return (
    <Suspense fallback={null}>
      <TarotChat />
    </Suspense>
  );
}

function TarotChat() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // 방 id 는 프롭이 아니라 **경로에서 직접** 읽는다. 첫 질문을 보내면 방을 만들고 URL 을
  // `/tarot/{id}` 로 바꾸는데, router.push 를 쓰면 라우트 세그먼트가 달라져 이 컴포넌트가
  // 통째로 재마운트된다 — 방금 띄운 질문 말풍선과 로딩이 날아가고 히스토리를 다시 받아올
  // 때까지 빈 화면이 된다. 그래서 window.history.replaceState 로 URL 만 바꾸는데(Next 가
  // 공식 지원하는 방식이라 usePathname 이 따라온다), 그러면 프롭은 옛 값 그대로라 경로를
  // 진실의 원천으로 두어야 한다. 새로고침하면 `[roomId]` 라우트가 정상적으로 렌더된다.
  const roomId = pathname.startsWith("/tarot/") ? pathname.slice("/tarot/".length) : null;
  const {
    user,
    countPasses,
    setCountPasses,
    activeCountPass: activeCountPassInfo,
    refreshMe,
    rooms,
    activeRoomId,
    selectRoom,
    createRoom,
    loaded: roomsLoaded,
    loadFailed: roomsLoadFailed,
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
  const spreadRestoredRef = useRef(false);
  /** 고른 스프레드를 브라우저에 붙들어 둔다(2026-09-26 사용자 요청).
   *
   *  이 화면은 메인↔대화방 사이를 오갈 땐 재마운트되지 않지만, /charge 나 /me 처럼 타로 밖으로
   *  나갔다 들어오면 새로 마운트된다. 그때 useState 초깃값 "one" 이 다시 깔려서, 켈틱크로스로
   *  맞춰 둔 사람이 매번 원카드로 되돌아가 있는 걸 본다.
   *
   *  lazy 초기화(useState(() => localStorage…))로 읽지 않는 이유는 SupportCenter 의 임시저장과
   *  같다 — 이 컴포넌트는 서버에서도 렌더되므로 서버(값 없음)와 클라이언트(값 있음)가 갈리면
   *  하이드레이션이 어긋난다. useLayoutEffect 는 페인트 **전에** 돌아서, 말풍선의 "현재 타로
   *  모드: 원카드"가 한 프레임 스쳤다 바뀌는 일도 없다. */
  useLayoutEffect(() => {
    if (spreadRestoredRef.current) return;
    spreadRestoredRef.current = true;
    const saved = window.localStorage.getItem(SPREAD_STORAGE_KEY);
    // 저장 이후 스프레드 목록이 바뀌었을 수 있다 — SPREADS 에 없는 값이면 버린다.
    // 이펙트 안 setState 는 이 자리에선 의도한 것이다: localStorage 는 렌더 중에 읽을 수 없고
    // (하이드레이션), ref 로 한 번만 돌게 막아 두었다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved && saved in SPREADS) setSpread(saved as SpreadKey);
  }, []);
  const chooseSpread = (next: SpreadKey) => {
    setSpread(next);
    window.localStorage.setItem(SPREAD_STORAGE_KEY, next);
  };
  const [passUsageOpen, setPassUsageOpen] = useState(false);
  const [includeCompatibility, setIncludeCompatibility] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [greetingAnimationRoomId, setGreetingAnimationRoomId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [startingPass, setStartingPass] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [spreadSheetOpen, setSpreadSheetOpen] = useState(false);
  /** 스프레드 버튼 위에 뜨는 "현재 타로 모드" 말풍선(2026-09-26 사용자 요청). 아이콘만으로는
   *  지금 어느 스프레드인지 알 수 없어서, 진입할 때 한 번 이름을 적어 알려준다.
   *
   *  **열림/닫힘을 boolean 으로 들면 안 된다.** 메인과 대화방은 같은 화면을 재사용해서
   *  라우트가 바뀌어도 재마운트되지 않기 때문에(실측 확인), state 를 true 로 시작해 봤자
   *  한 번 닫으면 다른 방으로 들어가도 다시 뜨지 않는다. 그래서 "어느 방에서 닫았는가"를 들고
   *  지금 방과 다르면 열린 것으로 본다 — 그러면 메인↔대화방, 방↔방 어느 쪽으로 옮겨도
   *  "진입 시 한 번"이 저절로 성립한다. 초깃값 `undefined` 는 roomId(문자열 또는 null)와 절대
   *  같지 않아 첫 진입에서 열린다. */
  const [hintDismissedFor, setHintDismissedFor] = useState<string | null | undefined>(undefined);
  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [purchaseTicketOpen, setPurchaseTicketOpen] = useState(false);
  const [timePassToUse, setTimePassToUse] = useState<TimePass | null>(null);
  const [renameModalRoomId, setRenameModalRoomId] = useState<string | null>(null);
  const [deleteModalRoomId, setDeleteModalRoomId] = useState<string | null>(null);
  const [suspension, setSuspension] = useState<SuspensionInfo | null>(null);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  // 방 개수 상한에 걸리면 질문을 여기 잠깐 맡겨두고 모달을 띄운다 — 확인하면 가장 오래된 방을
  // 지우고 이 질문 그대로 이어서 보낸다(예전엔 드로어의 "새 대화"가 이 모달을 띄웠다).
  const [roomLimitOpen, setRoomLimitOpen] = useState(false);
  const [roomLimitBusy, setRoomLimitBusy] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 마지막 질문 말풍선 — 스크롤을 이 말풍선 윗변에 건다. */
  const lastUserRef = useRef<HTMLDivElement>(null);
  /** 대화 위에 떠 있는 상단바. 높이만큼 스크롤을 더 내려야 질문이 바에 안 가린다. */
  const topBarRef = useRef<HTMLDivElement>(null);
  /** 그 말풍선을 화면 맨 위로 올릴 수 있도록 아래에 채워 넣는 빈 공간. */
  const tailSpacerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  /** 스트리밍 중 쌓이는 본문. 델타마다 setState 하면 대화 트리 전체가 다시 그려져서, 여기 모아
   *  두고 프레임당 한 번만 화면 상태로 넘긴다. */
  const streamBufferRef = useRef("");
  const [streamingText, setStreamingText] = useState<string | null>(null);
  /** 서버가 형식이 깨진 답을 다시 만드는 중 — 글이 갑자기 바뀌는 이유를 미리 알려준다. */
  const [redoing, setRedoing] = useState(false);
  /** 해석보다 먼저 도착한 카드 그림. */
  const [streamingCards, setStreamingCards] = useState<{ spread: SpreadKey | null; cards: TarotCardInfo[] } | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  useTypingPlaceholder(questionInputRef);

  // textarea는 스스로 늘어나지 않는다. 높이를 auto로 되돌려 scrollHeight를 다시 재고(줄어드는
  // 경우까지 반영하려면 이 초기화가 필요하다) 그 값을 높이로 준다. 최소·최대 높이와 넘칠 때의
  // 스크롤은 CSS(min-h-14 / max-h-40 / overflow-y-auto)가 맡는다.
  useEffect(() => {
    const el = questionInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [question]);

  // 컴포저가 화면 바닥에 떠 있으므로, 가려지는 높이만큼 스크롤 영역에 아래 여백을 준다.
  // 이용권 바의 유무와 입력칸이 늘어난 정도에 따라 높이가 바뀌어서 ResizeObserver 로 쫓는다.
  // 상태 대신 스타일을 직접 쓰는 이유는 타이핑 placeholder 와 같다 — 트리가 커서 리렌더가 비싸다.
  useEffect(() => {
    const composer = composerRef.current;
    const scroll = scrollRef.current;
    if (!composer || !scroll) return;
    const sync = () => {
      const h = composer.offsetHeight;
      scroll.style.paddingBottom = `${h + 8}px`;
      // 하단 페이드가 시작하는 지점 — 이용권 바 윗선(=컴포저 상단)이다.
      // 실제 그라데이션은 globals.css 의 .chat-scroll 이 그린다.
      scroll.style.setProperty("--fade-bottom", `${h}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(composer);
    return () => ro.disconnect();
  }, []);
  const greetedRoomIdsRef = useRef<Set<string>>(new Set());
  // 이 방에서 진행 중인 리딩 요청이 있는지 — 이 인스턴스가 직접 시작했든(loading), 로딩 중
  // 페이지 이동 후 돌아와서 다른(재마운트 전) 인스턴스가 시작한 걸 뒤늦게 알게 됐든
  // (isRoomPending) 상관없이 UI는 동일하게 "응답 대기 중"으로 보여줘야 한다.
  const isRoomPending = Boolean(activeRoomId && pendingReadingRoomIds.has(activeRoomId));
  const showLoading = loading || isRoomPending;

  /* 스크롤 (2026-09-26 전면 수정).
   *
   * 동작: **질문을 보내면 그 질문 말풍선이 상단바 바로 아래로 올라가고, 이후 답변은 그 자리에서
   * 아래로 찍힌다 — 스크롤은 더 움직이지 않는다.** 답변이 2,000자를 넘어서, 끝으로 따라가면
   * 사용자는 결론부터 읽게 되고 읽던 자리도 계속 빼앗긴다.
   *
   * 질문을 화면 맨 위로 올리려면 그 아래에 최소 한 화면만큼의 내용이 있어야 한다. 대화 끝에
   * 빈 공간(tailSpacer)을 그만큼 깔아 두고, 답변이 자라는 만큼 그 공간을 줄인다. 줄이기만 하고
   * 스크롤은 건드리지 않으므로 읽던 위치가 흔들리지 않는다.
   *
   * 예전엔 맨 끝 sentinel 에 scrollIntoView({block:"end"}) 하나였는데, 그건 sentinel 의 아랫변을
   * 스크롤 영역 아랫변에 맞춰서 컴포저에 가리지 말라고 준 paddingBottom 을 화면 밖으로 밀어냈다
   * — 마지막 말풍선이 이용권 바·입력창 뒤로 들어가던 원인이다. */
  const QUESTION_TOP_GAP = 12;
  // useLayoutEffect: 빈 공간 높이와 스크롤 위치를 **페인트 전에** 확정한다. useEffect 로 두면
  // 내용이 바뀐 프레임이 한 번 그려진 뒤에 보정이 들어가서, 그 한 프레임이 튐으로 보인다.
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const spacer = tailSpacerRef.current;
    if (!scroll) return;
    const grew = messages.length > prevMessageCountRef.current;
    const askedJustNow = grew && messages[messages.length - 1]?.role === "user";
    prevMessageCountRef.current = messages.length;

    const anchor = lastUserRef.current;
    if (spacer && anchor) {
      // 상단바는 대화 위에 떠 있는 오버레이(absolute h-16)라, 스크롤 영역의 0 지점은 **바 뒤**다.
      // 바 높이만큼 더 내려야 질문이 바 아래로 나온다 — 높이를 상수로 박지 않고 재는 이유는,
      // 바가 바뀌면 여기도 같이 틀어지기 때문이다.
      const topOffset = (topBarRef.current?.offsetHeight ?? 64) + QUESTION_TOP_GAP;
      // 빈 공간을 0 으로 되돌린 뒤 재야 "지금 부족한 만큼"이 나온다.
      spacer.style.height = "0px";
      const top = anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
      const need = scroll.clientHeight - topOffset - (scroll.scrollHeight - top);
      spacer.style.height = `${Math.max(0, need)}px`;
      if (askedJustNow) scroll.scrollTop = top - topOffset;
      return;
    }
    // 아직 질문이 하나도 없는 방(인사말만 있는 상태)에서는 빈 공간이 필요 없다.
    if (spacer) spacer.style.height = "0px";
    scroll.scrollTop = scroll.scrollHeight;
  }, [messages, streamingText, showLoading]);

  useEffect(() => {
    if (!activeTimePass || new Date(activeTimePass.expiresAt).getTime() <= now) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTimePass]);


  // 활성 방은 **라우트가 정한다**. 예전엔 `?room=` 쿼리를 읽어 컨텍스트 상태로 밀어넣었는데,
  // 그러면 "방을 만든 직후"와 "URL이 갱신된 직후" 사이에 컨텍스트와 URL이 어긋나는 구간이
  // 생겨서 방금 만든 방이 옛 방으로 되돌아가는 경쟁 상태가 있었다(2026-09-15). 이제 방 id가
  // 경로에 있으므로 단방향이다 — 경로 → 컨텍스트.
  useEffect(() => {
    selectRoom(roomId);
  }, [roomId, selectRoom]);

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

  // 메인에서 첫 질문을 보내 **방금 만든** 방의 id. 아래 히스토리 로딩이 이 방을 건너뛰게 하는
  // 용도다 — URL 이 `/tarot/{새 방}` 으로 바뀌는 순간 히스토리 이펙트가 돌면서, 아직 서버에
  // 저장되지도 않은 리딩 대신 인사말만 들어 있는 히스토리로 setMessages 를 덮어써서 방금 띄운
  // 질문 말풍선이 사라졌다(2026-09-24 분리 중 실제로 냄). 이 방의 대화는 handleSubmit 이 직접
  // 들고 있으므로 서버에서 다시 받아올 이유가 없다.
  const skipHistoryRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !activeRoomId) return;
    if (skipHistoryRoomIdRef.current === activeRoomId) {
      skipHistoryRoomIdRef.current = null;
      setHistoryLoaded(true);
      return;
    }

    // 응답이 돌아왔을 때 **아직 그 방을 보고 있는지** 확인한다(2026-09-26).
    //
    // 이게 없어서 "대화방에서 좌상단 새 대화 → 메인에 이전 대화가 그대로" 버그가 났다. 경로를
    // `/` 로 바꾸면 이 화면은 먼저 옛 activeRoomId(컨텍스트 값은 selectRoom 이펙트가 돈 뒤에야
    // null 이 된다)로 한 번 렌더되고, 그 사이에 여기서 **옛 방의 히스토리 조회가 출발한다**.
    // 그 뒤 activeRoomId 가 null 이 되어 화면이 메인으로 정리돼도, 늦게 도착한 응답이
    // setMessages 로 옛 대화를 도로 붙여 넣었다. 방 A → 방 B 를 빠르게 눌러도 같은 종류의
    // 어긋남이 난다(A 의 응답이 늦게 오면 B 화면에 A 의 대화가 뜬다).
    let cancelled = false;
    (async () => {
      setHistoryLoaded(false);
      const history = await fetchRoomHistory(activeRoomId);
      if (cancelled) return;
      if (history) {
        const hasOnlyGreeting = history.length > 0 && history.every((message) => message.role === "assistant" && message.isGreeting);
        const shouldAnimateGreeting = hasOnlyGreeting && !greetedRoomIdsRef.current.has(activeRoomId);
        greetedRoomIdsRef.current.add(activeRoomId);
        setGreetingAnimationRoomId(shouldAnimateGreeting ? activeRoomId : null);
        setMessages(history);
      }
      setHistoryLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeRoomId]);

  useEffect(() => {
    if (!greetingAnimationRoomId) return;
    // 타이핑이 끝나기 전에 이 값이 풀리면 글자가 끝까지 튀어 버린다 — 네 줄을 다 찍는 데 드는
    // 시간(대략 3.5초)보다 넉넉히 잡는다. 어차피 두 번째 방문은 greetedRoomIdsRef 가 막는다.
    const timeout = setTimeout(() => setGreetingAnimationRoomId(null), 10_000);
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

  async function confirmDeleteRoom() {
    if (!deleteModalRoomId) return;
    setRoomActionBusy(true);
    try {
      const deletedActive = deleteModalRoomId === roomId;
      await deleteRoom(deleteModalRoomId);
      setDeleteModalRoomId(null);
      // 지금 보고 있던 방을 지웠으면 갈 곳이 없다 — 메인으로. 예전엔 컨텍스트가 남은 방 중
      // 하나를 알아서 골라줬는데, 이제 활성 방은 경로가 정한다.
      if (deletedActive) router.replace("/");
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
    if (!trimmed || showLoading) return;
    // 비로그인 상태로도 이 화면을 볼 수 있으므로(AppShell 참고), 조용히 무시하지 말고
    // 로그인 모달로 연결한다 — 피그마 "Screen / LoginModal".
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    if (includeCompatibility && !hasPartner) {
      setMessages((prev) => [
        ...prev,
        { role: "error", text: "궁합을 보려면 메뉴 > 궁합 상대 정보에서 상대방 정보를 먼저 저장해주세요." },
      ]);
      return;
    }

    // 메인에서 보낸 첫 질문이면 여기서 방이 생긴다. 예전엔 드로어의 "새 대화"가 미리 방을
    // 만들어뒀지만, 말을 걸지 않고 나가면 빈 방만 쌓여서 생성 시점을 여기로 옮겼다
    // (2026-09-24). 방 개수 상한도 따라와서, 상한 모달은 이제 이 자리에서 뜬다.
    let targetRoomId = activeRoomId;
    if (!targetRoomId) {
      try {
        const created = await createRoom();
        if (!created) return;
        targetRoomId = created.id;
      } catch (error) {
        if (error instanceof Error && error.message === "ROOM_LIMIT") {
          setPendingQuestion(trimmed);
          setRoomLimitOpen(true);
          return;
        }
        setMessages((prev) => [...prev, { role: "error", text: "대화방을 만들지 못했어요." }]);
        return;
      }
      enterRoom(targetRoomId);
    }

    setQuestion("");
    await runReading(targetRoomId, trimmed);
  }

  /** 방을 만든 직후 그 방으로 "들어간다". router.push 가 아니라 URL 만 갈아끼우는 이유:
   *  라우트 세그먼트가 바뀌면 이 컴포넌트가 통째로 재마운트되어 방금 띄운 질문 말풍선과
   *  로딩이 날아간다. Next 가 공식 지원하는 방식이라 usePathname 이 따라오고, 위쪽 roomId
   *  계산이 그대로 대화방 모드로 넘어간다. */
  function enterRoom(id: string) {
    skipHistoryRoomIdRef.current = id;
    // 닫아 둔 안내를 새 방으로 이어 준다. 이 경로는 재마운트 없이 roomId 만 바뀌므로, 안 옮기면
    // 방금 질문을 보낸 사람 눈앞에서 말풍선이 되살아난다.
    setHintDismissedFor(id);
    selectRoom(id);
    window.history.replaceState(null, "", `/tarot/${id}`);
  }

  /** 방 개수 상한에 걸려서 멈춰 세웠던 질문을, 가장 오래된 방을 지우고 이어서 보낸다. */
  async function confirmRoomLimit() {
    if (!pendingQuestion) return;
    setRoomLimitBusy(true);
    try {
      const created = await createRoom(true);
      if (!created) return;
      setRoomLimitOpen(false);
      enterRoom(created.id);
      const q = pendingQuestion;
      setPendingQuestion(null);
      setQuestion("");
      await runReading(created.id, q);
    } finally {
      setRoomLimitBusy(false);
    }
  }

  async function runReading(targetRoomId: string, trimmed: string) {
    if (!user) return;
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setLoading(true);
    startedHereRef.current.add(targetRoomId);
    markReadingPending(targetRoomId);

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
          roomId: targetRoomId,
          includeCompatibility: effectiveIncludeCompatibility,
        }),
      });
      // 스트림이 열리기 전에 걸린 것들(이용권 없음·정지·형식 오류)은 예전처럼 상태코드 + JSON 이다.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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

      /* 여기서부터는 NDJSON 스트림이다 — {"t":"delta"|"done"|"error"} 가 줄 단위로 온다.
       *
       * 델타마다 setState 를 때리면 대화 트리 전체가 초당 수십 번 다시 그려진다. ref 에 모아 두고
       * 프레임당 한 번만 흘려보낸다. */
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no-stream");
      const decoder = new TextDecoder();
      let buffered = "";
      let data: ReadingDonePayload | null = null;
      let streamError: string | null = null;
      let frame = 0;
      const flushToScreen = () => {
        frame = 0;
        setStreamingText(streamBufferRef.current);
      };

      streamBufferRef.current = "";
      setStreamingText("");
      setRedoing(false);
      setStreamingCards(null);

      readLoop: for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffered.indexOf("\n")) !== -1) {
          const line = buffered.slice(0, nl).trim();
          buffered = buffered.slice(nl + 1);
          if (!line) continue;
          const event = JSON.parse(line) as Record<string, unknown>;
          if (event.t === "cards") {
            // 카드는 LLM 이전에 확정된다 — 해석 첫 글자보다 먼저 깔린다.
            setStreamingCards({
              spread: (event.spread as SpreadKey | null) ?? null,
              cards: (event.cards as TarotCardInfo[]) ?? [],
            });
          } else if (event.t === "delta") {
            streamBufferRef.current += String(event.v ?? "");
            if (!frame) frame = requestAnimationFrame(flushToScreen);
          } else if (event.t === "redo") {
            // 카드가 빠지는 등 형식이 깨져서 서버가 한 번 더 만드는 중. 다시 만든 쪽이 온전하면
            // replace 가 오고, 아니면 지금 글이 그대로 남는다.
            setRedoing(true);
          } else if (event.t === "replace") {
            streamBufferRef.current = String(event.v ?? "");
            setRedoing(false);
            if (!frame) frame = requestAnimationFrame(flushToScreen);
          } else if (event.t === "error") {
            streamError = String(event.error ?? "오류가 발생했어요.");
            break readLoop;
          } else if (event.t === "done") {
            data = event as unknown as ReadingDonePayload;
            break readLoop;
          }
        }
      }
      if (frame) cancelAnimationFrame(frame);
      // 스트리밍 표시를 여기서 끄면 안 된다(2026-09-26). 바로 아래 refreshMe() 를 await 하는 순간
      // 렌더가 한 번 도는데, 그때는 스트리밍 글이 사라졌고 완성된 메시지는 아직 안 붙은 상태다 —
      // 답변이 통째로 없어졌다가 다시 나타나면서 스크롤이 튄다. 끄는 건 finally 한 곳에서만 한다.
      if (streamError) {
        setMessages((prev) => [...prev, { role: "error", text: streamError }]);
        return;
      }
      if (!data) throw new Error("stream-ended-early");

      if (data.countPassApplied) await refreshMe();
      if (data.roomTitle) setRoomTitleLocal(targetRoomId, data.roomTitle);
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
      const recovered = await fetchRoomHistory(targetRoomId).catch(() => null);
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
      // 완성된 메시지를 붙인 **같은 렌더**에서 스트리밍 표시를 끈다 — 사이에 await 가 없으므로
      // React 가 한 번에 묶는다. 둘이 갈라지면 답변이 한 프레임 사라졌다 나타난다.
      streamBufferRef.current = "";
      setStreamingText(null);
      setStreamingCards(null);
      setRedoing(false);
      setLoading(false);
      markReadingDone(targetRoomId);
    }
  }

  const timePassActive = Boolean(
    activeTimePass && new Date(activeTimePass.expiresAt).getTime() > now
  );
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
  const SpreadIcon = SPREAD_ICONS[spread];

  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  /* 스크롤이 붙잡는 기준점 — **가장 최근 질문 말풍선**이다.
   *
   * "마지막 메시지가 질문일 때"로 잡으면 안 된다(2026-09-26 실제로 냈다). 답변이 붙는 순간
   * 마지막은 답변이 되어 기준점이 사라지고, 그러면 아래 이펙트가 "맨 아래로" 예비 경로를 타서
   * 읽고 있던 사람을 끝으로 끌고 간다. 답변이 와도 기준점은 그 질문 그대로여야 한다. */
  const lastQuestionIndex = messages.reduce((found, message, index) => (message.role === "user" ? index : found), -1);
  // 메인(`/`)이냐 대화방(`/tarot/[roomId]`)이냐. 예전엔 "제목이 기본값이고 메시지가 0개인 방"
  // 으로 메인을 흉내냈는데(isBlankRoom), 이제 경로가 직접 말해준다.
  const isMain = roomId === null;

  return (
    <div className="chat-glow relative flex h-full flex-col overflow-hidden bg-bg">
      {showWelcome && <WelcomePopup onClose={() => setShowWelcome(false)} />}
      {passUsageOpen && (
        <PassUsageModal
          timePasses={timePasses}
          activeTimePass={activeTimePass}
          timePassActive={timePassActive}
          countPass={activeCountPass}
          now={now}
          onUse={(pass) => {
            setPassUsageOpen(false);
            setTimePassToUse(pass);
          }}
          onGoCharge={() => {
            setPassUsageOpen(false);
            router.push(withReturnTo("/charge?tab=time", pathname));
          }}
          onClose={() => setPassUsageOpen(false)}
        />
      )}
      {spreadSheetOpen && (
        <SpreadSelectSheet
          spread={spread}
          remainingBySpread={remainingBySpread}
          timePassActive={timePassActive}
          onSelect={chooseSpread}
          includeCompatibility={effectiveIncludeCompatibility}
          hasPartner={hasPartner}
          onToggleCompatibility={() => setIncludeCompatibility((v) => !v)}
          onClose={() => setSpreadSheetOpen(false)}
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
      {purchaseTicketOpen && (
        <PurchaseTicketModal
          onClose={() => setPurchaseTicketOpen(false)}
          onInvite={() => {
            setPurchaseTicketOpen(false);
            router.push("/invite");
          }}
          onPurchase={() => {
            setPurchaseTicketOpen(false);
            router.push(withReturnTo("/charge", pathname));
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
      {suspension && <SuspensionModal info={suspension} onClose={() => setSuspension(null)} />}
      <div
        ref={topBarRef}
        className="app-topbar-glass absolute inset-x-0 top-0 z-20 flex h-16 items-center border-b border-border"
      >
        <div className="flex h-full w-full items-center xl:mx-auto xl:max-w-4xl xl:pl-4">
        <button
          type="button"
          onClick={openMenu}
          aria-label="메뉴 열기"
          className="relative flex h-16 w-16 shrink-0 items-center justify-center text-icon-muted xl:hidden"
        >
          <MenuIcon className="h-3 w-5" />
          {/* 초기값 false 는 "새 알림 없음"이라는 단언이다 — 로드 전엔 아무 말도 하지 않는다. */}
          {roomsLoaded && hasUnreadNotifications && (
            <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-point" />
          )}
        </button>
        {/* 방 목록은 메뉴 드로어((app)/layout.tsx)에 있음 — 방 이름을 누르면 그 드로어를 연다.
            아직 한 번도 안 쓴 방("새 대화" 기본 제목 그대로)은 피그마 "Screen / Main"처럼 제목 대신
            타연 워드마크를 중앙에 보여주고, 방 컨트롤(이름변경/삭제/새대화/이용권뱃지)도 감춘다. */}
        {isMain ? (
          <>
            <button
              type="button"
              onClick={openMenu}
              className="flex flex-1 items-center justify-center"
            >
              <BrandBi className="h-6 w-12" />
            </button>
            {/* 워드마크를 **바의 한가운데**에 놓기 위한 빈 칸 — 왼쪽에 있는 것과 같은 폭이어야
                한다. flex-1 은 "왼쪽 것을 뺀 나머지"의 가운데를 잡으므로, 짝이 없으면 그 폭의
                절반만큼 오른쪽으로 밀린다(2026-09-25 실측: 모바일 32px, 데스크탑 8px).
                모바일은 햄버거 64, 데스크탑은 햄버거가 숨고 대신 감싸는 칸의 xl:pl-4(16)이 남는다. */}
            <div className="w-16 shrink-0 xl:w-4" aria-hidden="true" />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={openMenu}
              className="min-w-0 flex-1 truncate text-center text-base font-semibold text-bold-text"
            >
              {/* 로드 전에 DEFAULT_ROOM_TITLE 로 떨어뜨리면 안 된다(2026-09-26) — `rooms` 가
                  []  이고 activeRoomId 도 아직 없어서, 제목이 있는 방을 열어도 상단바가 먼저
                  "새 대화"라고 말한다. 방금 이름을 바꾼 사람에게는 되돌아간 것처럼 보인다. */}
              {roomsLoaded ? activeRoom?.title ?? DEFAULT_ROOM_TITLE : ""}
            </button>
            {/* 시안(피그마 Redesign)의 상단바는 좌측 메뉴와 우측 더보기 둘뿐이다.
                여기 있던 "새 대화" 버튼은 메뉴 드로어로만 두고 뺐다(2026-09-23). */}
            <div className="flex shrink-0 items-center gap-2 pr-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoomInfoOpen((v) => !v)}
                  aria-label="대화방 정보"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
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
        <div
          ref={scrollRef}
          className={`chat-scroll mx-auto flex h-full w-full flex-col gap-3 overflow-y-auto px-6 py-4 xl:max-w-4xl ${
            isMain ? "pt-[76px]" : "pt-[120px]"
          }`}
        >
        {/* 비로그인은 불러올 대화 자체가 없다 — historyLoaded는 false로 남으므로 여기서
            같이 본다. 이펙트에서 setState로 뒤집으면 렌더가 한 번 더 도는 데다 eslint의
            동기 setState 규칙에도 걸린다(2026-09-22).
            activeRoomId도 같이 보는 이유: 방이 없으면 히스토리 이펙트가 시작조차 하지 않아
            historyLoaded가 영원히 false다 — 예전엔 그래서 이 줄이 안 사라졌다. 방 목록을
            받는 동안(!roomsLoaded)은 그대로 로딩으로 보여준다. */}
        {/* 한 번도 안 쓴 방(제목이 기본값 그대로)에는 **불러올 이전 대화가 없다** — 서버가 인사말을
            합성해서 내려줄 뿐이다. 그런데도 이 줄을 띄우면, "새 대화"로 방금 만든 방에서 있지도
            않은 대화를 찾는 것처럼 보인다(2026-09-26). */}
        {user &&
          (!roomsLoaded ||
            (activeRoomId !== null && !historyLoaded && activeRoom?.title !== DEFAULT_ROOM_TITLE)) && (
          <div className="self-start text-sm text-text">이전 대화를 불러오는 중...</div>
        )}
        {/* 메인에서는 숨긴다(2026-09-25). 실패한 건 방 "목록"인데 메인엔 불러올 대화가
            애초에 없어서, 이 문구가 대화 내용이 날아간 것처럼 읽혔다. 대화방에서는 실제로
            그 방의 히스토리를 못 여는 상황이라 그대로 둔다. */}
        {user && roomsLoadFailed && !isMain && (
          <div className="self-start text-sm text-text">
            대화를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </div>
        )}
        {/* 메인의 중앙 카피. 원래 목업 실측값은 24px/줄간격 29 였는데, 사용자 지시로 1.5배
            키웠다(2026-09-25) — 36px/줄간격 44. 대화방에는 없다: 방을 열면 그 자리를 대화가 채운다. */}
        {isMain && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-center text-[36px] font-bold leading-[44px] text-bold-text">
              고민이 있거나 힘들땐
              <br />
              <span className="text-point">타연</span> 하세요
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === "user") {
            return (
              // 실측(피그마 New/Chattingroom_*, 2026-09-24): 말풍선 x 104~388, 폭 284.
              // 오른쪽 끝은 대화 영역 패딩(24)에 딱 붙고 폭은 컨텐츠 폭 364의 78%에서 잘린다 —
              // max-w 가 없으면 긴 질문이 좌우를 꽉 채워 "오른쪽 말풍선"으로 안 보인다.
              <div
                key={i}
                ref={i === lastQuestionIndex ? lastUserRef : undefined}
                className="animate-fade-in max-w-[78%] self-end rounded-2xl bg-point px-4 py-2 text-white"
              >
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
          const animateGreeting = msg.isGreeting && greetingAnimationRoomId === activeRoomId;
          /* 인사말은 앞 줄이 다 찍힌 다음 줄이 시작한다 — 앞 줄들의 글자 수로 시작 시각을 누적한다.
             예전엔 말풍선마다 1초씩 고정으로 밀었는데, 줄 길이가 제각각이라 짧은 줄 뒤에는 뜸이
             남고 긴 줄 뒤에는 겹쳤다. */
          const greetingDelayMs = msg.isGreeting
            ? messages
                .slice(0, i)
                .filter((message) => message.role === "assistant" && message.isGreeting)
                .reduce((acc, message) => acc + message.text.length * TYPING_SPEED_MS + GREETING_LINE_GAP_MS, 0)
            : 0;
          return (
            <div
              key={i}
              className="animate-fade-in flex w-full flex-col items-start"
              style={
                animateGreeting
                  ? { animationDelay: `${greetingDelayMs}ms`, animationFillMode: "backwards" }
                  : undefined
              }
            >
              {/* AI 답변에는 **말풍선 면이 없다**(피그마 New/Chattingroom_*, 2026-09-24 실측:
                  답변 영역의 x 40/200/360 전부 순수 배경색). 사용자 말풍선만 코랄 면을 갖고,
                  답변은 배경 위에 글자만 얹힌다. 들여쓰기(px-4)와 최대 폭은 유지 — 실측상
                  글자 기둥이 x 40.3~288.7 이라 패딩 16이 그대로 있고 폭은 사용자 말풍선과
                  같은 78%다. */}
              <div className="max-w-[78%] px-4 py-3">
              <SpreadCards spread={msg.spread} cards={msg.cards} />
              {msg.cards.length > 0 && msg.spread && (
                /* 이 줄은 "무엇으로 본 리딩인가"만 알려준다 — 스프레드와 함께 켠 옵션을 같은 칩으로
                   나란히 놓는다(2026-09-26 사용자 지시). 예전엔 뽑힌 카드 이름을 칩으로 죽 늘어놨는데,
                   해석 본문이 "뽑힌 카드 목록"을 이미 글로 적어 줘서 같은 내용이 두 번 나왔다.
                   토큰도 이때 함께 정리했다: border-border 테두리는 다크에서 배경과 거의 같아 안
                   보였고, bg-text 칩은 혼자 라이트 모드처럼 떴다. */
                <div className="mb-1 flex flex-wrap items-center justify-center gap-2">
                  {[
                    SPREADS[msg.spread].label,
                    ...(msg.includeSaju ? ["사주"] : []),
                    ...(msg.includeZiwei ? ["자미두수"] : []),
                    ...(msg.includeCompatibility
                      ? [`궁합${msg.partnerNickname ? ` · ${msg.partnerNickname}` : ""}`]
                      : []),
                  ].map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-chip-soft px-3 py-1 text-base font-semibold text-chip-soft-text"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">
                {animateGreeting ? (
                  <TypewriterText text={msg.text} startDelayMs={greetingDelayMs} />
                ) : (
                  renderInterpretation(msg.text)
                )}
              </div>
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
                <p className="mt-1 w-full px-1 text-xs text-point-text">시간제 이용권으로 이용한 리딩이에요.</p>
              )}
              {/* 시안(피그마 Redesign) 실측: 라벨 + 코랄 30% 테두리 컨테이너(안쪽 여백 10,
                  채움 없음) + 그 안에 가로 그라데이션 알약(높이 43, 간격 8). 글자색은 모드에
                  따라 뒤집힌다 — globals.css 의 .suggest-pill 참고. */}
              {msg.charged && i === messages.length - 1 && (msg.suggestions?.length ?? 0) > 0 && (
                /* px-4 는 답변 본문과 같은 들여쓰기다 — 실측상 제안 블록은 x 40~372 로
                   대화 영역 패딩(24) 안에서 16 씩 더 들어가 있다(답변 글자 기둥이 시작하는
                   x 40.3 과 같은 선). 예전엔 이 들여쓰기가 없어 24~388 로 꽉 차 있었다. */
                <div className="mt-3 w-full px-4">
                  <p className="mb-1.5 text-sm font-semibold text-placeholder">이어서 물어보기</p>
                  {/* 바깥 테두리는 **2px** 이다(피그마 New/Chattingroom_* 실측 2026-09-24:
                      단면이 raw 6px 로 안티앨리어싱 없이 딱 떨어진다 = 2css). 색은 그 자리
                      배경 위에 --point 를 30% 로 얹은 값과 정확히 맞아서 그대로 둔다.
                      실측 기하도 지금 값과 맞는다 — 바깥 x 40~372, 알약 x 51.7~360.3 이라
                      안쪽 여백 12 = p-2.5(10) + border(2), 알약 높이 43, 간격 8. */}
                  <div className="flex flex-col gap-2 rounded-[32px] border-2 border-point/30 p-2.5">
                    {msg.suggestions!.map((s, j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => {
                          setQuestion(s);
                          questionInputRef.current?.focus();
                        }}
                        className="suggest-pill rounded-full px-5 py-3 text-left text-base font-bold"
                      >
                        {j + 1}. {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* 스트리밍 중인 본문. 첫 글자가 닿기 전까지만 "카드를 섞고 있습니다..." 를 보여준다. */}
        {(streamingCards || (streamingText !== null && streamingText.length > 0)) && (
          <div className="flex w-full flex-col items-start">
            {streamingCards && (
              <div className="w-full max-w-[78%] px-4 pt-3">
                <SpreadCards spread={streamingCards.spread} cards={streamingCards.cards} stagger />
              </div>
            )}
            <div className="whitespace-pre-wrap px-4 text-text">{renderInterpretation(streamingText ?? "")}</div>
            {redoing && (
              <p aria-live="polite" className="mt-2 text-sm text-icon-muted">
                빠진 카드가 있어 해석을 다시 정리하고 있어요...
              </p>
            )}
          </div>
        )}
        {showLoading && (streamingText === null || streamingText.length === 0) && <ReadingLoadingMessage />}
        {/* 질문 말풍선을 화면 맨 위까지 밀어 올리기 위한 빈 공간 — 높이는 위 스크롤 이펙트가 잰다. */}
        <div ref={tailSpacerRef} aria-hidden className="shrink-0" />
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 컴포저는 흐름에서 빼 화면 바닥에 띄운다. 흐름 안에 두면 스크롤 영역이 이용권 바
          윗선에서 끊겨, 대화가 입력창 뒤로 지나가지 못하고 그 위에서 잘렸다(2026-09-23).
          가려지는 만큼의 여백은 아래 ResizeObserver 가 스크롤 영역에 직접 넣는다. */}
      <div
        ref={composerRef}
        className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full px-4 pb-4 xl:max-w-4xl"
      >
        {/* 시간제와 횟수제가 같은 바를 쓴다. 횟수제가 남아 있어도 시간제가 켜지면
            시간제 쪽으로 바뀐다 — 실제 차감 우선순위와 같은 순서다. */}
        {/* 메인에는 이용권 바가 없다(피그마 New/Main_*) — 아직 어느 방에서 뭘 쓸지 정해지기
            전이라 보여줄 잔량도 없다. */}
        {/* 로드 전에는 바 **자리만** 비워 둔다(2026-09-26). 초기값이 null/[] 이라 그냥 두면
            "이용권 없음"으로 렌더돼 바가 사라졌다가 나타나고, 그때마다 컴포저가 40px
            (h-8 + mb-2) 튄다. 대화방까지 온 사람은 대개 이용권 보유자라, 자리를 비워 두는
            쪽이 튀는 사람 수가 적다. */}
        {isMain ? null : !roomsLoaded ? (
          <div className="mb-2 h-8" />
        ) : timePassActive && activeTimePass ? (
          <PassBar
            label={`${activeTimePass.minutes}분 ${COMBOS[activeTimePass.combo].label}`}
            value={`남은 시간: ${formatRemaining(new Date(activeTimePass.expiresAt).getTime() - now)}`}
            ringPercent={
              ((new Date(activeTimePass.expiresAt).getTime() - now) / (activeTimePass.minutes * 60_000)) * 100
            }
            onOpen={() => setPassUsageOpen(true)}
          />
        ) : activeCountPass ? (
          /* 횟수제는 "남은 횟수 N회"가 아니라 **비율**을 보여준다(피그마 New/Chattingroom_
             UsingCountPass, 2026-09-24 갱신). 회차는 스프레드·옵션을 바꿀 때마다 달라져서
             (켈틱크로스로 바꾸면 338회가 90회로 줄어든다) 바에 띄우면 잔량이 깎인 것처럼
             보인다. remaining 은 이미 0~1 비율이라 조합과 무관하게 한 값으로 고정된다 —
             이용권 모달의 링도 같은 값을 쓴다. */
          <PassBar
            label={countPassFullName(activeCountPass)}
            value={`남은 사용량: ${(activeCountPass.remaining * 100).toFixed(1)}%`}
            onOpen={() => setPassUsageOpen(true)}
          />
        ) : (
          /* 이용권이 없을 때도 바를 띄운다(2026-09-26 사용자 요청). 예전엔 여기서 null 을
             돌려 바가 통째로 사라지고 안내는 화면 맨 아래 "보유 이용권 없음" 한 줄이었는데,
             정작 이용권 얘기를 하는 자리는 입력창 바로 위다. 덤으로 바가 사라졌다 나타나며
             컴포저가 40px 튀던 것도 같이 없어진다. */
          <PassBar label="보유 이용권이 없습니다." onOpen={() => setPassUsageOpen(true)} />
        )}

        {/* 시안(피그마 Redesign)의 MessageBox 는 382x57 한 줄이다 — 칩·입력·보내기가
            같은 줄에 선다. 예전엔 입력칸 아래에 버튼 줄이 따로 있어 두 줄이었다.
            여러 줄로 늘어나면 버튼은 바닥에 붙는다(items-end). */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 rounded-[28px] border border-border bg-surface p-2"
        >
          {/* 스프레드 버튼을 가리키는 말풍선. 버튼 **안**에 넣을 수 없다 — 닫기 X 가 버튼이라
              button 중첩이 된다. 그래서 form 을 기준으로 띄우고 left-2 로 버튼(p-2 안쪽)에 맞춘다.
              꼬리는 같은 면색 사각형을 45도 돌려 알약 아래에 반쯤 걸친 것이다.

              면색은 **내 질문 말풍선과 같은 것**을 쓴다(bg-point + 흰 글자, 2026-09-26 사용자
              지시) — 토큰이라 다크/라이트가 각각 따라온다. 그라데이션·글로우는 button.bg-point
              규칙이라 div 인 여기에는 안 걸리고, 대화의 질문 말풍선(div.bg-point)과 같은 평면이다. */}
          {hintDismissedFor !== roomId && (
            <div
              role="status"
              className="absolute bottom-full left-2 z-10 -mb-1 flex h-8 items-center gap-1 rounded-full bg-point pl-3 pr-1 text-xs font-semibold text-white"
            >
              <span className="whitespace-nowrap">현재 타로 모드: {INPUT_MODE_SPREAD_LABEL[spread]}</span>
              <button
                type="button"
                onClick={() => setHintDismissedFor(roomId)}
                aria-label="현재 타로 모드 안내 닫기"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
              <span
                aria-hidden
                className="absolute -bottom-1.5 left-4 h-2.5 w-2.5 rotate-45 bg-point"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              // 시트를 열었다는 건 스프레드를 직접 확인하러 갔다는 뜻이라, 안내는 할 일을
              // 다 했다(2026-09-26 사용자 지시). 게다가 말풍선이 가리키던 버튼을 누른 것이다.
              setHintDismissedFor(roomId);
              setSpreadSheetOpen(true);
            }}
            aria-label={inputModeLabel}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
          >
            <SpreadIcon className="h-5 w-5" />
            {/* 스프레드 아이콘만으로는 궁합이 켜졌는지 안 보여서 피그마 Redesign 이 더한 표식.
                16px 코랄 원이 40px 칩 우상단으로 4px 튀어나온다(실측). 면은 평면이다 — 그라데이션·글로우는
                button.bg-point 규칙이라 span 에는 걸리지 않는다. */}
            {effectiveIncludeCompatibility && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-point text-white">
                <CompatibilityIcon className="h-2.5 w-3" />
              </span>
            )}
          </button>
          {/* 예전엔 <input>이라 긴 질문이 한 줄 안에서 옆으로 밀려 앞부분이 보이지 않았다.
              textarea로 바꾸되, 채팅 입력이므로 Enter는 그대로 전송이고 줄바꿈은 Shift+Enter다
              (textarea의 기본 동작과 반대라 명시적으로 처리해야 한다). 한글 입력 중의 Enter는
              조합 확정이므로 전송하지 않는다(isComposing). */}
          <textarea
            ref={questionInputRef}
            value={question}
            rows={1}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            onFocus={() => {
              // 입력을 시작하면 안내는 할 일을 다 했다. 아래 조기 return 들보다 먼저 닫는다 —
              // 로그인·이용권 모달이 뜨는 경우에도 그 뒤에 말풍선이 남아 있을 이유가 없다.
              setHintDismissedFor(roomId);
              if (!user) {
                questionInputRef.current?.blur();
                setLoginModalOpen(true);
                return;
              }
              if (noUsableTicket) {
                questionInputRef.current?.blur();
                setPurchaseTicketOpen(true);
              }
            }}
            placeholder="궁금한 것을 물어보세요"
            className="max-h-40 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-[10px] text-base font-semibold leading-5 text-bold-text outline-none typing-placeholder"
            disabled={showLoading}
          />
          <button
            type="submit"
            disabled={showLoading}
            aria-label="질문하기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-point text-white disabled:opacity-50"
          >
            <SendIcon className="h-5 w-5" />
          </button>
        </form>

        {/* 생년월일시·궁합 상대·보유 이용권은 전부 계정에 딸린 안내라 비로그인에는 띄우지
            않는다 — 링크를 눌러봤자 /login으로 튕긴다.

            셋 다 roomsLoaded 를 같이 본다(2026-09-25). 전부 "없을 때" 뜨는 안내인데 세 값의
            초기값이 없음(false/null)이라, `/api/user/me` 가 오기 전 수백 ms 동안 **이미 다
            갖춘 사람에게도** 세 줄이 떴다가 사라진다 — 컴포저 아래가 세 줄만큼 밀렸다 돌아온다.
            서브페이지는 레이아웃에서 통째로 늦추지만(app/layout.tsx) 여기는 비로그인도
            머무는 화면이라 그럴 수 없어 자리마다 건다. noUsableTicket 이 이미 같은 이유로
            roomsLoaded 를 보고 있다. */}
        {user && (
        <div className="flex flex-col items-start gap-1 px-1 pt-1.5 text-xs">
          <div className="flex flex-col gap-0.5">
            {roomsLoaded && !hasBirthInfo && (
              <p className="text-placeholder">
                <Link href="/me" className="text-point-text underline">
                  내 정보
                </Link>
                에서 생년월일시를 입력하면 사주/자미두수도 함께 볼 수 있어요.
              </p>
            )}
            {roomsLoaded && !hasPartner && (
              <p className="text-placeholder">
                <Link href="/compatibility" className="text-point-text underline">
                  궁합 상대 정보
                </Link>
                를 저장하면 궁합도 함께 볼 수 있어요.
              </p>
            )}
          </div>
          {/* 보유 이용권 표시는 전부 컴포저 위 PassBar 로 옮겼다 — 없을 때의 안내도 거기 있다
              (2026-09-26). 화면 맨 아래는 이용권 얘기를 읽는 자리가 아니다. */}
        </div>
        )}
        {/* 사업자정보는 **메인에만** 둔다(피그마 New/Main_*, 2026-09-24). 전자상거래법
            제10조①·시행규칙 제7조①의 표시 의무가 "초기 화면" 기준이라, 대화방까지 달고 다닐
            이유가 없다. 예전엔 "회사 정보" 링크 한 줄이었는데, 시행규칙 제7조③이 링크 갈음을
            허용하는 건 대표자 성명·사업자등록번호·약관뿐이고 상호·주소·전화·이메일은 화면에
            나타나야 해서 전문을 펼쳤다. 비로그인에도 보이도록 user 블록 밖에 둔다. */}
        {isMain && <MainCompanyInfo />}
      </div>
      {loginModalOpen && <LoginModal onClose={() => setLoginModalOpen(false)} />}
      {roomLimitOpen && (
        <RoomLimitModal
          busy={roomLimitBusy}
          onConfirm={confirmRoomLimit}
          onClose={() => {
            setRoomLimitOpen(false);
            // 취소하면 맡아둔 질문을 입력창에 돌려준다 — 사라지면 다시 타이핑해야 한다.
            if (pendingQuestion) setQuestion(pendingQuestion);
            setPendingQuestion(null);
          }}
        />
      )}
    </div>
  );
}
