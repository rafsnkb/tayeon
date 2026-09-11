"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";

const NAV_ITEMS = [
  { href: "/tarot", label: "타로 보기" },
  { href: "/me", label: "내 정보" },
  { href: "/compatibility", label: "궁합 상대 정보" },
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

  function handleToggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setStoredTheme(next);
  }

  if (!authed) return null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center border-b border-border bg-surface px-4 py-3">
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="메뉴 열기"
          className="text-2xl leading-none"
        >
          ☰
        </button>
      </header>

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
                라프라움(Rafraum) | 대표: 이정희 | 사업자등록번호: 277-19-02371 | 통신판매업신고번호: 기입예정
                <br />
                주소: 서울특별시 송파구 거마로20길 18, 507호 | 이메일: admin@rafraum.com
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
