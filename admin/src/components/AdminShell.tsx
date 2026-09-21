"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "개요" },
  { href: "/users", label: "사용자" },
  { href: "/moderation", label: "검토" },
  { href: "/refund-requests", label: "환불" },
  { href: "/analytics", label: "분석" },
  { href: "/notices", label: "공지" },
  { href: "/retained-data", label: "보관" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  if (isLogin) return <>{children}</>;

  return <>
    <header className="admin-nav">
      <div className="admin-nav__inner">
        <Link href="/" className="admin-wordmark" aria-label="타연 관리자 개요">타연 <span>관리자</span></Link>
        <nav className="admin-nav__links" aria-label="관리자 메뉴">
          {navigation.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? "is-active" : undefined}>{item.label}</Link>)}
        </nav>
        <span className="admin-nav__status"><i /> 운영 중</span>
      </div>
    </header>
    {children}
  </>;
}
