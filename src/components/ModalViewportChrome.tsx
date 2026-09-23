"use client";

import { useEffect } from "react";

const MODAL_SELECTOR = '[data-modal-overlay="true"]';

/** 팝업이 열렸을 때 상태바에 쓸 톤 — 배경색에 이 비율을 곱한다(검정 45% 를 덮은 것과 같다).
 *  예전엔 두 모드의 결과값(`#0a0808` / `#898686`)을 직접 박아 뒀는데, 그러면 --bg 가 바뀌는
 *  날 상태바만 옛 색으로 남는다. 0.55 는 그 두 값을 정확히 되돌려 주는 비율이다. */
const MODAL_DIM = 0.55;

function readBackground(): [number, number, number] | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(raw);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

const toHex = (c: [number, number, number]) =>
  "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");

/**
 * iOS Safari는 웹 콘텐츠 밖의 상태바 영역을 별도의 브라우저 표면으로 그린다.
 * 팝업이 열려 있을 때 theme-color를 딤드 톤으로 함께 바꿔 노치 안전영역까지
 * 하나의 오버레이처럼 보이게 한다.
 *
 * 색은 전부 `--bg` 토큰에서 끌어온다 — 다크/라이트 판정도 여기 딸려 온다(.dark 가 붙으면
 * getComputedStyle 이 알아서 다크 쪽 값을 준다). 토큰을 못 읽으면 아무것도 건드리지 않고
 * 물러난다: `app/layout.tsx` 의 metadata.themeColor 가 이미 라이트 배경색으로 깔려 있어서,
 * 잘못된 색을 덮어쓰는 것보다 그대로 두는 편이 낫다.
 */
export default function ModalViewportChrome() {
  useEffect(() => {
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) return;

    const syncThemeColor = () => {
      const bg = readBackground();
      if (!bg) return;
      const modalOpen = Boolean(document.querySelector(MODAL_SELECTOR));
      themeColor.content = toHex(modalOpen ? (bg.map((v) => v * MODAL_DIM) as [number, number, number]) : bg);
    };

    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.body, { childList: true, subtree: true });
    // 테마를 바꾸면 --bg 가 바뀌는데 body 아래가 아니라 <html> 의 class 가 움직이므로
    // 위 옵저버가 못 잡는다. 예전 코드도 같은 구멍이 있었다.
    const themeObserver = new MutationObserver(syncThemeColor);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      const bg = readBackground();
      if (bg) themeColor.content = toHex(bg);
    };
  }, []);

  return null;
}
