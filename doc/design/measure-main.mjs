// 피그마 "New/Main_{Dark,Light}" 실측 (2026-09-24 갱신본).
// 메인 화면 = 대화방과 분리된 초기 화면. 하단에 사업자정보 전문이 들어왔다.
//
// 1236x2196 = 412x732 @3x. 사용법: node doc/design/measure-main.mjs
import { load, px, hex, inkHeight, inkColor, bands, DPR } from "./measure-lib.mjs";

const css = (v) => +(v / DPR).toFixed(1);

const FILES = {
  dark: "asset/Screen/New/Main_Dark.png",
  light: "asset/Screen/New/Main_Light.png",
};

/** 화면 전체 폭에서 행별 잉크를 세어 가로 줄들을 찾는다(배경은 그라데이션이라 행마다 새로 잰다). */
function rowBands(img, { x0, x1, y0, y1, thresh = 26, gap = 4 }) {
  const out = [];
  let cur = null;
  let blank = 0;
  for (let y = y0; y < y1; y++) {
    // 해당 행의 좌측 여백을 그 행의 배경 기준색으로 쓴다 — 세로 그라데이션이라 고정색은 못 쓴다.
    const bg = px(img, x0 - 20 > 0 ? x0 - 20 : 2, y);
    let ink = 0;
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      if (Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c]))) > thresh) ink++;
    }
    if (ink >= 3) {
      if (!cur) cur = { first: y, last: y, peak: ink };
      else { cur.last = y; cur.peak = Math.max(cur.peak, ink); }
      blank = 0;
    } else if (cur && ++blank > gap) { out.push(cur); cur = null; blank = 0; }
  }
  if (cur) out.push(cur);
  return out;
}

/** 한 행에서 잉크가 있는 x 범위 */
function spanX(img, y, { x0 = 0, x1, thresh = 26 } = {}) {
  const bg = px(img, 2, y);
  let lo = null;
  let hi = null;
  for (let x = x0; x < (x1 ?? img.w); x++) {
    const p = px(img, x, y);
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c]))) > thresh) {
      if (lo === null) lo = x;
      hi = x;
    }
  }
  return lo === null ? null : { lo, hi, loCss: css(lo), hiCss: css(hi), wCss: css(hi - lo + 1) };
}

for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} (${img.w}x${img.h} = ${css(img.w)}x${css(img.h)} css) ===`);
  console.log("배경 top:", hex(...px(img, 6, 400)), "/ 바닥:", hex(...px(img, 6, img.h - 6)));
  console.log("상단바:", hex(...px(img, 600, 60)), "/ 본문 시작:", hex(...px(img, 600, 600)));

  // 하단 1/3 의 가로 줄 전부 — 컴포저와 사업자정보 줄들이 여기 있다.
  const rows = rowBands(img, { x0: 40, x1: img.w - 40, y0: Math.round(img.h * 0.7), y1: img.h });
  console.log("\n하단 줄 (top / 높이 / x범위):");
  for (const b of rows) {
    const mid = Math.round((b.first + b.last) / 2);
    const s = spanX(img, mid, { x0: 20, x1: img.w - 20 });
    console.log(
      `  top ${String(css(b.first)).padStart(6)}  h ${String(css(b.last - b.first + 1)).padStart(5)}` +
        `  x ${s ? `${s.loCss}~${s.hiCss}` : "-"}  peak ${b.peak}`
    );
  }

  // 중앙 카피
  const mid = rowBands(img, { x0: 200, x1: img.w - 200, y0: Math.round(img.h * 0.33), y1: Math.round(img.h * 0.52) });
  console.log("\n중앙 카피 줄:");
  for (const b of mid) {
    const m = Math.round((b.first + b.last) / 2);
    const s = spanX(img, m, { x0: 100, x1: img.w - 100 });
    console.log(`  top ${css(b.first)}  잉크 ${css(b.last - b.first + 1)}  x ${s ? `${s.loCss}~${s.hiCss}` : "-"}`);
    console.log(`    색:`, inkColor(img, { x0: b.first && 150, y0: b.first, x1: img.w - 150, y1: b.last + 1 }));
  }

  // 로고 · 햄버거
  const top = rowBands(img, { x0: 20, x1: img.w - 20, y0: 0, y1: 500 });
  console.log("\n상단 줄:");
  for (const b of top.slice(0, 4)) {
    const m = Math.round((b.first + b.last) / 2);
    const s = spanX(img, m, { x0: 0, x1: img.w });
    console.log(`  top ${css(b.first)}  h ${css(b.last - b.first + 1)}  x ${s ? `${s.loCss}~${s.hiCss}` : "-"}`);
  }
}

// --- 2차: 색·그라데이션 ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} 색 ===`);
  const ys = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2100, 2190];
  console.log("좌측 여백 세로 그라데이션:", ys.map((y) => `${css(y)}:${hex(...px(img, 4, y))}`).join(" "));
  console.log("컴포저 면:", hex(...px(img, 600, 1830)), "/ 카드칩:", hex(...px(img, 355, 1830)));
  console.log("전송버튼:", hex(...px(img, 3010 / 3 * 1 | 0, 1830)));
  for (const [name, box] of Object.entries({
    "사업자정보 1줄": { x0: 280, y0: 1980, x1: 960, y1: 2007 },
    "사업자정보 4줄": { x0: 480, y0: 2090, x1: 760, y1: 2118 },
    "링크 줄": { x0: 350, y0: 2134, x1: 890, y1: 2172 },
    "placeholder": { x0: 600, y0: 1810, x1: 1000, y1: 1850 },
  })) {
    console.log(name, inkColor(img, box));
  }
}
