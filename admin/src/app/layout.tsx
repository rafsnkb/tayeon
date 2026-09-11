import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "타연 관리자",
  description: "타연 내부 운영 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
