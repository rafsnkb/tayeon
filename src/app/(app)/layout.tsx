"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
import { NewChatIcon, PlusIcon } from "./tarot/icons";

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
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* (app)/ 아래 모든 페이지가 이제 자체 TopBar를 그린다 — /tarot는 햄버거+방이름 있는 TopBar,
          나머지는 SubPageTopBar(뒤로가기+제목, 피그마 MyPage 등이 실제로 뒤로가기만 쓰고 햄버거가
          없었음). 그래서 공용 헤더는 더 이상 필요 없어 없앰(2026-09-14) — 햄버거는 menuBus를 통해
          /tarot의 TopBar에서 이 레이아웃의 메뉴 드로어를 그대로 연다. */}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 피그마 "Screen / MenuOpen" — 왼쪽에서 슬라이드(기존 앱과 동일한 쪽, 피그마 Menu 프레임도
              화면 왼쪽에 고정된 x좌표였음), 292px 폭, 상단(로고+코인+이용권) / 중단(최근 대화 목록,
              스크롤) / 하단(그라디언트+아바타+새 대화)으로 구성 */}
          <div className="flex w-[292px] max-w-[85%] flex-col bg-topbar">
            <div className="shrink-0">
              <div className="flex h-16 items-center justify-between px-4">
                <span className="text-2xl font-bold">
                  <span className="text-white">타</span>
                  <span className="text-point">연</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/charge");
                  }}
                  aria-label="코인 충전"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cta-fill text-cta-text"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
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
              <div className="mt-2 h-px bg-border" />
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
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

            <div className="flex shrink-0 items-center gap-2 p-4">
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
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-cta-fill text-sm font-semibold text-cta-text"
              >
                <NewChatIcon className="h-4 w-4" />새 대화
              </button>
            </div>

          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
