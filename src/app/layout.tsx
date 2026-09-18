import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import ModalViewportChrome from "@/components/ModalViewportChrome";

const pretendard = localFont({
  src: [
    { path: "../../asset/font/Pretendard-SemiBold.otf", weight: "600", style: "normal" },
    { path: "../../asset/font/Pretendard-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "타연 - 당신의 고민을 타연하세요";
const DESCRIPTION = "AI 타로ㆍ사주ㆍ자미두수로 당신의 고민을 상담해드립니다.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tayeon.kr"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "타연",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// iPhone의 노치·홈 인디케이터 영역까지 웹앱 뷰포트에 포함한다.
// 그래야 fixed 모달 딤드가 안전영역 안에서 끊기지 않고 화면 전체를 덮는다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f4fb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${pretendard.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ModalViewportChrome />
        {children}
      </body>
    </html>
  );
}
