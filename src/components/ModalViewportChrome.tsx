"use client";

import { useEffect } from "react";

const MODAL_SELECTOR = '[data-modal-overlay="true"]';

/**
 * iOS Safari는 웹 콘텐츠 밖의 상태바 영역을 별도의 브라우저 표면으로 그린다.
 * 팝업이 열려 있을 때 theme-color를 딤드 톤으로 함께 바꿔 노치 안전영역까지
 * 하나의 오버레이처럼 보이게 한다.
 */
export default function ModalViewportChrome() {
  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) return;

    const baseThemeColor = () =>
      document.documentElement.classList.contains("dark") ? "#141517" : "#f7f4fb";
    const syncThemeColor = () => {
      const modalOpen = Boolean(document.querySelector(MODAL_SELECTOR));
      if (!modalOpen) {
        themeColor.content = baseThemeColor();
        return;
      }

      const isDark = document.documentElement.classList.contains("dark");
      themeColor.content = isDark ? "#0a0b0c" : "#89878d";
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      themeColor.content = baseThemeColor();
    };
  }, []);

  return null;
}
