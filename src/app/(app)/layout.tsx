"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
import { BrandBi } from "@/components/BrandBi";
import { NewChatIcon, ChevronRightIcon } from "./tarot/icons";

const SIDEBAR_COLLAPSED_KEY = "tayeon-sidebar-collapsed";

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoomsProvider>
      <AppShell>{children}</AppShell>
    </RoomsProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // hori.chat 실제 확인(2026-09-14): /terms, /support 같은 하위 페이지는 사이드바가 아예 없는
  // 별도의 단순한 화면이고, 상시 사이드바는 메인 채팅 화면에만 있다. 타연도 같은 원칙 —
  // "뒤로가기"로 들어가는 서브페이지(SubPageTopBar 쓰는 화면들)는 사이드바 없이 단순 중앙정렬.
  const isMainRoute = pathname === "/tarot";
  const {
    user,
    profileImage,
    countPasses,
    activeTimePass,
    timePasses,
    rooms,
    activeRoomId,
    selectRoom,
    createRoom,
    authChecked,
  } = useRooms();
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // 데스크탑(lg+)에서만 의미 있는 상시 사이드바 접기 상태 — hori.chat 참조(2026-09-14).
  // 모바일 오버레이 드로어(menuOpen)와는 별개 개념.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  );

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    if (authChecked && !user) router.replace("/login");
  }, [authChecked, user, router]);

  useEffect(() => onOpenMenu(() => setMenuOpen(true)), []);

  useEffect(() => {
    if (!activeTimePass) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTimePass]);

  async function handleNewRoom() {
    const created = await createRoom();
    setMenuOpen(false);
    if (created) router.push(`/tarot?room=${created.id}`);
  }

  function handleSelectRoom(roomId: string) {
    selectRoom(roomId);
    setMenuOpen(false);
    router.push(`/tarot?room=${roomId}`);
  }

  function handleGoCharge() {
    setMenuOpen(false);
    router.push("/charge");
  }

  if (!authChecked || !user) return null;

  // 서브페이지(/me, /settings, /charge 등)는 사이드바 없이 단순 중앙정렬 — hori.chat의 /terms,
  // /support와 동일한 원칙(위 isMainRoute 주석 참고). 사이드바+플렉스로 관련 복잡한 폭 계산이
  // 전혀 필요 없어서 별도의 단순한 트리로 일찍 반환한다.
  // 여기서는 폭을 아예 제한하지 않는다 — hori.chat 실측(/terms): 상단바(SubPageTopBar 해당)는
  // 뷰포트 폭 그대로(풀블리드), 그 아래 본문만 max-w-5xl(960px)로 중앙정렬됨. 상단바까지 같이
  // 좁혀버리면 다시 "탑바가 잘려 보인다"는 문제가 재현되므로(2026-09-14), 각 서브페이지가 자기
  // 본문 영역에만 개별적으로 폭을 건다.
  if (!isMainRoute) {
    return (
      <div className="flex h-dvh w-full flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  const timePassLabel = activeTimePass
    ? `${formatRemaining(new Date(activeTimePass.expiresAt).getTime() - now)} 남음`
    : timePasses.length > 0
      ? `보유 ${timePasses.length}개`
      : "보유 이용권 없음";

  return (
    <div className="flex h-dvh flex-col overflow-hidden xl:flex-row">
      {/* 모바일(<lg): 햄버거로 여닫는 오버레이 드로어(fixed, translate로 슬라이드).
          데스크탑(lg+): 상시 노출되는 좌측 사이드바로 전환 — PC 브라우저에서 412px 모바일 프레임이
          화면 가운데 떠 있고 양옆이 텅 비어 보이던 문제(2026-09-14, 사용자 피드백) 해결용. 같은
          엘리먼트를 항상 DOM에 두고 브레이크포인트별로 포지셔닝만 바꾼다(조건부 렌더링이면 lg에서
          "항상 보이기"가 안 됨). */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity xl:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[85%] flex-col bg-topbar transition-transform duration-200 xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:border-r xl:border-border ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "xl:w-20" : "xl:w-[300px]"}`}
      >
        {/* 피그마 "Screen / MenuOpen" 기반 + hori.chat 레이아웃 참조(2026-09-14) — 데스크탑에서
            로고 옆 화살표로 사이드바를 아이콘 전용 레일로 접을 수 있음(hori.chat과 동일 동작) */}
        <div className="shrink-0">
          <div className={`flex h-16 items-center px-4 ${sidebarCollapsed ? "xl:justify-center xl:px-0" : "justify-between"}`}>
            <span className={sidebarCollapsed ? "xl:hidden" : ""}>
              <BrandBi />
            </span>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-muted hover:bg-chip-fill hover:text-white xl:flex"
            >
              <ChevronRightIcon
                className={`h-3 w-2 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              />
            </button>
          </div>
          <div className={sidebarCollapsed ? "xl:hidden" : ""}>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-sm font-semibold text-icon-muted">횟수제 이용권</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="text-lg font-bold text-bold-text dark:text-gold">
                    {countPasses.length ? `보유 ${countPasses.length}개` : "없음"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleGoCharge}
                  className="rounded-full bg-point px-4 py-1.5 text-sm font-semibold text-white"
                >
                  구입
                </button>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-sm font-semibold text-icon-muted">시간제 이용권</span>
              <span className="flex items-center gap-3">
                <span className="text-sm font-semibold text-bold-text">{timePassLabel}</span>
                <button
                  type="button"
                  onClick={handleGoCharge}
                  className="rounded-full bg-point px-4 py-1.5 text-sm font-semibold text-white"
                >
                  구입
                </button>
              </span>
            </div>
          </div>
          <div className="mt-2 h-px bg-border" />
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={handleNewRoom}
              aria-label="새 대화"
              className="mt-2 hidden h-10 w-10 items-center justify-center self-center rounded-full bg-cta-fill text-cta-text xl:mx-auto xl:flex"
            >
              <NewChatIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          <div className={sidebarCollapsed ? "xl:hidden" : ""}>
            <p className="px-2 py-2 text-sm font-semibold text-icon-muted">최근 대화</p>
            <div className="flex flex-col gap-1">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handleSelectRoom(room.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                    room.id === activeRoomId
                      ? "bg-chip-fill text-white"
                      : "text-bold-text hover:bg-chip-fill hover:text-white"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-bold-text" />
                  <span className="truncate">{room.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`flex shrink-0 items-center gap-2 p-4 ${sidebarCollapsed ? "xl:justify-center xl:px-2" : ""}`}
        >
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/me");
            }}
            aria-label="내 정보"
            className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-border bg-chip-fill"
          >
            {profileImage && (
              <img src={profileImage} alt="" className="h-full w-full object-cover" />
            )}
          </button>
          <button
            type="button"
            onClick={handleNewRoom}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-cta-fill text-sm font-semibold text-cta-text ${
              sidebarCollapsed ? "xl:hidden" : ""
            }`}
          >
            <NewChatIcon className="h-4 w-4" />새 대화
          </button>
        </div>
      </div>

      {/* 사이드바 옆 남는 공간은 여기서 전부 채운다(풀블리드) — hori.chat처럼 탑바/컴포저 배경은
          화면 끝까지, 그 안의 실제 콘텐츠만 중앙정렬하는 2단 구조는 /tarot 자신(TarotChat)이
          내부적으로 처리한다(서브페이지들이 각자 mx-auto max-w-2xl을 거는 것과 같은 패턴).
          예전엔 이 wrapper에 xl:max-w-4xl을 걸어서 /tarot의 탑바까지 통째로 좁아졌었음
          (2026-09-14 발견, 사용자 피드백: "상단바가 왜 안 고쳐지냐") — 제거함. */}
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
