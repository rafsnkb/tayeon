"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";
import { onOpenMenu } from "@/lib/ui/menuBus";
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
  { href: "/tarot", label: "타로 보기" },
  { href: "/me", label: "내 정보" },
  { href: "/compatibility", label: "궁합 상대 정보" },
  { href: "/charge", label: "코인 충전" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.replace("/login");
        return;
      }
      setUser(u);
      setAuthed(true);

      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNickname(data.nickname);
      }
    });
  }, [router]);

  useEffect(() => onOpenMenu(() => setMenuOpen(true)), []);

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  if (!authed) return null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* /tarot는 방 이름ㆍ새 대화 버튼이 포함된 자체 TopBar를 그리므로 공통 헤더를 숨긴다 —
          햄버거는 menuBus를 통해 이 레이아웃의 메뉴 드로어를 그대로 연다. */}
      {pathname !== "/tarot" && (
        <header className="flex shrink-0 items-center border-b border-border bg-surface px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
            className="text-2xl leading-none"
          >
            ☰
          </button>
        </header>
      )}

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-72 max-w-[80%] flex-col bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="font-medium text-bold-text">{nickname ?? "타연"}</span>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="메뉴 닫기"
                className="text-xl leading-none text-text"
              >
                ✕
              </button>
            </div>

            <nav className="flex flex-col py-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`px-4 py-3 text-sm ${
                    pathname === item.href
                      ? "font-bold text-bold-text"
                      : "text-text"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-text">다크 모드</span>
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

            <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-4 text-xs text-text">
              <p>
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
              <p>Copyright Rafraum Inc. 2026.</p>
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
