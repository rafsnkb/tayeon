"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";
import { onOpenMenu } from "@/lib/ui/menuBus";
import { RoomsProvider, useRooms } from "@/lib/tarot/RoomsContext";
import { MenuIcon, NewChatIcon, PlusIcon } from "./tarot/icons";
import {
  COMPANY_NAME_EN,
  COMPANY_NAME_KO,
  CEO_NAME,
  BUSINESS_REGISTRATION_NUMBER,
  MAIL_ORDER_BUSINESS_NUMBER,
  COMPANY_ADDRESS,
  SUPPORT_EMAIL,
} from "@/lib/company";

const NAV_ITEMS = [
  { href: "/me", label: "내 정보" },
  { href: "/compatibility", label: "궁합 상대 정보" },
];

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
  const {
    user,
    nickname,
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
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

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

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
      {/* /tarot는 방 이름ㆍ새 대화 버튼이 포함된 자체 TopBar를 그리므로 공통 헤더를 숨긴다 —
          햄버거는 menuBus를 통해 이 레이아웃의 메뉴 드로어를 그대로 연다. */}
      {pathname !== "/tarot" && (
        <header className="flex shrink-0 items-center border-b border-border bg-surface px-2 py-2">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
            className="flex h-12 w-12 items-center justify-center text-text"
          >
            <MenuIcon className="h-3 w-5" />
          </button>
        </header>
      )}

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
                <span className="text-2xl font-bold text-white">타연</span>
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
                <span className="text-sm font-light text-icon-muted">보유코인</span>
                <span className="flex items-center gap-1">
                  <img src="/icons/coin.png" alt="" className="h-5 w-5" />
                  <span className="text-lg font-bold text-gold">{coins ?? "-"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-1.5">
                <span className="text-sm font-light text-icon-muted">시간제 이용권</span>
                <span className="text-sm font-semibold text-white">{timePassLabel}</span>
              </div>
              <div className="mt-2 h-px bg-border" />
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              <p className="px-2 py-2 text-sm font-light text-icon-muted">최근 대화</p>
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

            {/* 피그마엔 없지만(아직 별도 "설정" 화면을 안 만듦), 기존에 있던 내 정보/궁합/다크모드/
                로그아웃/약관 접근을 잃지 않도록 접이식으로 남겨둔다. */}
            <div className="shrink-0 border-t border-border">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-light text-icon-muted"
              >
                <span>{nickname ?? "더보기"}</span>
                <span>{moreOpen ? "접기" : "더보기"}</span>
              </button>
              {moreOpen && (
                <div className="flex flex-col gap-2 px-4 pb-4 text-xs">
                  <nav className="flex flex-col">
                    {NAV_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`py-2 text-sm ${
                          pathname === item.href ? "font-bold text-bold-text" : "text-icon-muted"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </nav>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-icon-muted">다크 모드</span>
                    <button
                      type="button"
                      onClick={handleToggleTheme}
                      aria-label="다크 모드 전환"
                      className={`h-6 w-11 rounded-full transition-colors ${
                        theme === "dark" ? "bg-point" : "bg-border"
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
                          theme === "dark" ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      signOut(auth);
                    }}
                    className="py-2 text-left text-sm text-icon-muted"
                  >
                    로그아웃
                  </button>
                  <p className="pt-2 text-icon-muted">
                    {COMPANY_NAME_KO}({COMPANY_NAME_EN}) | 대표: {CEO_NAME} | 사업자등록번호:{" "}
                    {BUSINESS_REGISTRATION_NUMBER} | 통신판매업신고번호: {MAIL_ORDER_BUSINESS_NUMBER}
                    <br />
                    주소: {COMPANY_ADDRESS} | 이메일: {SUPPORT_EMAIL}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/privacy" onClick={() => setMenuOpen(false)} className="text-point underline">
                      개인정보처리방침
                    </Link>
                    <Link href="/terms" onClick={() => setMenuOpen(false)} className="text-point underline">
                      이용약관
                    </Link>
                    <Link href="/support" onClick={() => setMenuOpen(false)} className="text-point underline">
                      고객센터
                    </Link>
                    <a
                      href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2771902371"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-point underline"
                    >
                      사업자 정보확인
                    </a>
                  </div>
                  <p className="text-icon-muted">Copyright Rafraum Inc. 2026.</p>
                </div>
              )}
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
