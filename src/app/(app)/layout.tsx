"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
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
  const {
    user,
    profileImage,
    coins,
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

  if (!authChecked || !user) return null;

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
            <span className={`text-2xl font-bold ${sidebarCollapsed ? "xl:hidden" : ""}`}>
              <span className="text-white">타</span>
              <span className="text-point">연</span>
            </span>
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-icon-muted hover:bg-[#26272c] xl:flex"
            >
              <ChevronRightIcon
                className={`h-3 w-2 transition-transform ${sidebarCollapsed ? "" : "rotate-180"}`}
              />
            </button>
          </div>
          <div className={sidebarCollapsed ? "xl:hidden" : ""}>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-sm font-semibold text-icon-muted">보유코인</span>
              <span className="flex items-center gap-1">
                <img src="/icons/coin.png" alt="" className="h-5 w-5" />
                <span className="text-lg font-bold text-gold">{coins ?? "-"}</span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-sm font-semibold text-icon-muted">시간제 이용권</span>
              <span className="text-sm font-semibold text-white">{timePassLabel}</span>
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
                      ? "bg-[#40424a] text-bold-text"
                      : "text-[#dcdee3] hover:bg-[#26272c]"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-white" />
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

      {/* hori.chat은 사이드바가 나타나는 폭(~1200px) 전까지 헤더/본문이 전부 풀블리드로 화면을
          꽉 채운다 — 여기서 max-w를 걸면 모바일도 아니고 데스크탑도 아닌 중간 폭(예: 900px)에서
          탑바·하단바가 좁은 칼럼 안에 갇혀 양옆에 빈 검은 배경만 남는 문제가 있었다
          (2026-09-14, 사용자 피드백: "탑바/하단바가 잘려있다"). 사이드바가 뜨는 xl부터만 폭을
          제한하고 가운데 정렬한다. */}
      <div className="flex w-full flex-1 flex-col overflow-hidden xl:mx-auto xl:max-w-4xl">
        {children}
      </div>
    </div>
  );
}
