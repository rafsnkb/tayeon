"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
import { BrandBi } from "@/components/BrandBi";
import RoomLimitModal from "@/components/RoomLimitModal";
import { CompanyFooter } from "@/components/CompanyFooter";
import { kakaoAuthorizeUrl } from "@/components/LoginPanel";
import { NewChatIcon, ChevronRightIcon, BellIcon } from "./tarot/icons";

const SIDEBAR_COLLAPSED_KEY = "tayeon-sidebar-collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoomsProvider>
      <AppShell>{children}</AppShell>
    </RoomsProvider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // hori.chat 실제 확인(2026-09-14): /terms, /support 같은 하위 페이지는 사이드바가 아예 없는
  // 별도의 단순한 화면이고, 상시 사이드바는 메인 채팅 화면에만 있다. 타연도 같은 원칙 —
  // "뒤로가기"로 들어가는 서브페이지(SubPageTopBar 쓰는 화면들)는 사이드바 없이 단순 중앙정렬.
  const isMainRoute = pathname === "/tarot";
  const {
    user,
    profileImage,
    hasUnreadNotifications,
    rooms,
    activeRoomId,
    selectRoom,
    createRoom,
    authChecked,
  } = useRooms();
  const [menuOpen, setMenuOpen] = useState(false);
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

  // 비로그인이어도 대화 화면은 그대로 보여준다 — 로그인 유도는 입력을 시도했을 때 뜨는
  // LoginModal과, 아래 드로어의 로그인 CTA가 맡는다(피그마 "Screen / LoginModal",
  // "MenuOpen - NotLogin"). /me·/charge 같은 나머지 화면은 볼 내용 자체가 계정에 딸려 있어서
  // 예전처럼 /login으로 보낸다.
  useEffect(() => {
    if (authChecked && !user && !isMainRoute) router.replace("/login");
  }, [authChecked, user, isMainRoute, router]);

  useEffect(() => onOpenMenu(() => setMenuOpen(true)), []);
  const [roomLimitOpen, setRoomLimitOpen] = useState(false);
  const [roomLimitBusy, setRoomLimitBusy] = useState(false);

  async function handleNewRoom() {
    try {
      const created = await createRoom();
      setMenuOpen(false);
      if (created) router.push(`/tarot?room=${created.id}`);
    } catch (error) {
      if (error instanceof Error && error.message === "ROOM_LIMIT") setRoomLimitOpen(true);
    }
  }

  async function confirmRoomLimit() {
    setRoomLimitBusy(true);
    try {
      const created = await createRoom(true);
      setRoomLimitOpen(false);
      setMenuOpen(false);
      if (created) router.push(`/tarot?room=${created.id}`);
    } finally {
      setRoomLimitBusy(false);
    }
  }

  function handleSelectRoom(roomId: string) {
    selectRoom(roomId);
    setMenuOpen(false);
    router.push(`/tarot?room=${roomId}`);
  }

  if (!authChecked) return null;
  if (!user && !isMainRoute) return null;

  // 서브페이지(/me, /settings, /charge 등)는 사이드바 없이 단순 중앙정렬 — hori.chat의 /terms,
  // /support와 동일한 원칙(위 isMainRoute 주석 참고). 사이드바+플렉스로 관련 복잡한 폭 계산이
  // 전혀 필요 없어서 별도의 단순한 트리로 일찍 반환한다.
  // 여기서는 폭을 아예 제한하지 않는다 — hori.chat 실측(/terms): 상단바(SubPageTopBar 해당)는
  // 뷰포트 폭 그대로(풀블리드), 그 아래 본문만 max-w-5xl(960px)로 중앙정렬됨. 상단바까지 같이
  // 좁혀버리면 다시 "탑바가 잘려 보인다"는 문제가 재현되므로(2026-09-14), 각 서브페이지가 자기
  // 본문 영역에만 개별적으로 폭을 건다.
  if (!isMainRoute) {
    return (
      <div className="flex min-h-dvh w-full flex-col overflow-visible xl:h-dvh xl:overflow-hidden">
        {children}
      </div>
    );
  }

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
        className={`fixed inset-y-0 left-0 z-50 flex w-[292px] max-w-[85%] flex-col bg-bg transition-transform duration-200 dark:bg-topbar xl:static xl:z-auto xl:max-w-none xl:translate-x-0 xl:border-r xl:border-border ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        } ${sidebarCollapsed ? "xl:w-20" : "xl:w-[300px]"}`}
      >
        {/* 피그마 "Screen / MenuOpen" 기반 + hori.chat 레이아웃 참조(2026-09-14) — 데스크탑에서
            로고 옆 화살표로 사이드바를 아이콘 전용 레일로 접을 수 있음(hori.chat과 동일 동작) */}
        <div className="shrink-0">
          <div className={`flex h-16 items-center border-b border-border px-4 ${sidebarCollapsed ? "xl:justify-center xl:px-0" : "justify-between"}`}>
            <span className={sidebarCollapsed ? "xl:hidden" : ""}>
              <BrandBi className="h-7 w-14 translate-y-[2px]" />
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
        </div>

        {/* 피그마 "Screen / MenuOpen - NotLogin" — 비로그인 드로어는 대화 목록 대신 가운데
            로그인 유도, 아래에 사업자 정보를 둔다. 여긴 모달을 띄우지 않고 카카오로 바로 보낸다:
            드로어를 열어 버튼까지 누른 사람에게 같은 내용을 한 번 더 카드로 보여줄 이유가 없다. */}
        {!user ? (
          <div className={`flex flex-1 flex-col justify-center px-4 ${sidebarCollapsed ? "xl:hidden" : ""}`}>
            <p className="text-center text-sm font-semibold leading-6 text-text">
              카카오 로그인으로
              <br />
              타연에서 여러분의 고민을
              <br />
              얘기해보세요
            </p>
            <a
              href={kakaoAuthorizeUrl()}
              className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-[#fae100] text-base font-bold text-black"
            >
              로그인ㆍ회원가입
            </a>
          </div>
        ) : (
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
                  <span className="h-2 w-2 shrink-0 rounded-full bg-current" />
                  <span className="truncate">{room.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        )}

        {!user ? (
          <div className={`shrink-0 p-4 ${sidebarCollapsed ? "xl:hidden" : ""}`}>
            <CompanyFooter />
          </div>
        ) : (
        <div
          className={`flex shrink-0 flex-col gap-2 p-4 ${sidebarCollapsed ? "xl:items-center xl:px-2" : ""}`}
        >
          {/* 피그마 "Screen / MenuOpen" — 마이페이지 + 알림 벨이 한 행에 나란히. 데스크탑에서
              사이드바를 아이콘 레일로 접으면(sidebarCollapsed) 폭이 좁아 나란히 둘 수 없으므로
              flex-col-reverse로 순서만 뒤집어 벨을 마이페이지 위에 세로로 쌓는다. */}
          <div className={`flex items-center justify-between gap-2 ${sidebarCollapsed ? "xl:flex-col-reverse xl:justify-center" : ""}`}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/me");
              }}
              aria-label="마이 페이지"
              className={`flex h-12 shrink-0 items-center gap-2.5 overflow-hidden rounded-full border border-border bg-chip-fill pr-4 ${
                sidebarCollapsed ? "xl:w-12 xl:justify-center xl:pr-0" : "w-fit"
              }`}
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-border">
                {profileImage && (
                  <img src={profileImage} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className={`truncate text-sm font-semibold text-white ${sidebarCollapsed ? "xl:hidden" : ""}`}>
                마이 페이지
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                router.push("/notifications");
              }}
              aria-label="알림"
              className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-icon-muted text-icon-muted"
            >
              <BellIcon className="h-5 w-5" />
              {hasUnreadNotifications && (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-point" />
              )}
            </button>
          </div>
          {/* 피그마 "Screen / MenuOpen" — 마이페이지 행과 "새 대화" 사이의 포인트 컬러 CTA.
              목업 실측(sharp): 배경 #ff007f(--point), 글자 흰색. 접힌 아이콘 레일에는 이 버튼을
              넣을 자리가 없어 데스크탑 접힘 상태에서만 숨긴다(모바일 드로어에는 항상 보인다). */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push("/charge");
            }}
            className={`flex h-12 w-full shrink-0 items-center justify-center rounded-full bg-point text-sm font-bold text-white ${
              sidebarCollapsed ? "xl:hidden" : ""
            }`}
          >
            이용권 구입하기
          </button>
          <button
            type="button"
            onClick={handleNewRoom}
            className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-cta-fill text-sm font-semibold text-cta-text ${
              sidebarCollapsed ? "xl:w-12" : "w-full"
            }`}
          >
            <NewChatIcon className="h-4 w-4" />
            <span className={sidebarCollapsed ? "xl:hidden" : ""}>새 대화</span>
          </button>
        </div>
        )}
      </div>

      {/* 사이드바 옆 남는 공간은 여기서 전부 채운다(풀블리드) — hori.chat처럼 탑바/컴포저 배경은
          화면 끝까지, 그 안의 실제 콘텐츠만 중앙정렬하는 2단 구조는 /tarot 자신(TarotChat)이
          내부적으로 처리한다(서브페이지들이 각자 mx-auto max-w-2xl을 거는 것과 같은 패턴).
          예전엔 이 wrapper에 xl:max-w-4xl을 걸어서 /tarot의 탑바까지 통째로 좁아졌었음
          (2026-09-14 발견, 사용자 피드백: "상단바가 왜 안 고쳐지냐") — 제거함. */}
      <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {roomLimitOpen && (
        <RoomLimitModal
          busy={roomLimitBusy}
          onConfirm={confirmRoomLimit}
          onClose={() => setRoomLimitOpen(false)}
        />
      )}
    </div>
  );
}
