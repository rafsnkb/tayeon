// 토스 앱 스크린샷 5장에서 색과 글자 크기를 실측한다. 짐작 금지 — 값은 전부 픽셀에서 나온다.
//   node doc/design/measure-toss.mjs
//
// 사용자 확인: 아이폰 15 Pro 캡처 = 1179x2556, DPR 3, CSS 뷰포트 393x852pt.
// 따라서 잰 px를 3으로 나누면 그대로 CSS px다.
//
// 한글은 em 박스를 거의 채우므로 "잉크 높이 / 0.73"을 font-size 추정에 쓴다. 이 비율은
// Pretendard/토스체 계열 한글 글자 높이 기준이고, 결과는 어차피 상용 단계로 반올림한다.

import sharp from "sharp";
import { toOklch } from "./build-point-ramp.mjs";

const DIR = "C:/Users/redte/.claude/uploads/5d4da222-b761-59e8-89d7-3615ccbd5334/";
const SHOTS = {
  home: "f20be255-image.png",
  settings: "16bc6c98-image.png",
  bank: "91da57d4-image.png",
  alerts: "695f96fa-image.png",
  card: "2f05f948-image.png",
};
const DPR = 3;
const HANGUL_INK = 0.73;

const hex = (r, g, b) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

async function load(name) {
  const { data, info } = await sharp(DIR + SHOTS[name])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

const px = (img, x, y) => {
  const i = (y * img.w + x) * img.ch;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

/** 전체 픽셀 히스토그램. 면 색(페이지·카드·바)은 면적이 크므로 상위에 그대로 뜬다. */
function histogram(img, topN = 14) {
  const counts = new Map();
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const [r, g, b] = px(img, x, y);
      const k = (r << 16) | (g << 8) | b;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const total = img.w * img.h;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k, n]) => ({
      hex: hex((k >> 16) & 255, (k >> 8) & 255, k & 255),
      pct: (n / total) * 100,
    }));
}

/** 파란 픽셀만 골라 히스토그램. 토스 키 컬러가 어느 값인지 추정 없이 뽑기 위함. */
function blues(img, topN = 8) {
  const counts = new Map();
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const [r, g, b] = px(img, x, y);
      if (b - r < 55 || b < 110) continue; // 확실히 파란 쪽만
      const k = (r << 16) | (g << 8) | b;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k, n]) => ({ hex: hex((k >> 16) & 255, (k >> 8) & 255, k & 255), n }));
}

/**
 * 주어진 상자 안에서 배경과 다른 "잉크" 행을 찾아 글자 높이를 잰다.
 * 배경은 상자 가장자리 행의 중앙값으로 잡는다.
 */
function inkHeight(img, { x0, y0, x1, y1 }, thresh = 28) {
  const edge = [];
  for (const y of [y0, y1 - 1]) {
    for (let x = x0; x < x1; x++) edge.push(px(img, x, y));
  }
  const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const bg = [0, 1, 2].map((c) => med(edge.map((p) => p[c])));

  const rows = [];
  for (let y = y0; y < y1; y++) {
    let ink = 0;
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c])));
      if (d > thresh) ink++;
    }
    rows.push(ink);
  }
  const min = Math.max(2, Math.round((x1 - x0) * 0.01)); // 잡티 제외
  // 상자를 좁히면 글자가 잘리고, 넓히면 위아래 이웃 요소를 문다. 그래서 전역 최초/최후가
  // 아니라 "연속된 잉크 덩어리"들로 쪼갠 뒤, 상자 중심이 들어있는 덩어리만 고른다.
  // 한글 자소 사이의 한두 줄 틈은 같은 글자로 봐야 하므로 GAP 만큼은 이어 붙인다.
  const GAP = 3;
  const bands = [];
  let cur = null;
  let blank = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] >= min) {
      if (!cur) cur = { first: i, last: i };
      else cur.last = i;
      blank = 0;
    } else if (cur) {
      if (++blank > GAP) { bands.push(cur); cur = null; }
    }
  }
  if (cur) bands.push(cur);
  if (!bands.length) return null;

  const mid = Math.floor(rows.length / 2);
  const band =
    bands.find((b) => mid >= b.first && mid <= b.last) ??
    bands.reduce((a, b) =>
      Math.abs((b.first + b.last) / 2 - mid) < Math.abs((a.first + a.last) / 2 - mid) ? b : a,
    );
  const { first, last } = band;
  const inkPx = last - first + 1;
  // 고른 덩어리가 상자 경계에 닿으면 여전히 잘린 것 — 그 측정값은 못 쓴다.
  const clipped = (first === 0 ? "위" : "") + (last === rows.length - 1 ? "아래" : "");
  return {
    bg: hex(...bg),
    inkPx,
    inkCss: inkPx / DPR,
    fontPx: inkPx / HANGUL_INK / DPR,
    clipped,
  };
}

// ── 1. 면 색 ────────────────────────────────────────────────────────────────
console.log("=".repeat(80));
console.log("면 색 — 전체 히스토그램 상위 (면적 %)");
console.log("=".repeat(80));
const imgs = {};
for (const name of Object.keys(SHOTS)) {
  imgs[name] = await load(name);
  const top = histogram(imgs[name]);
  console.log(`\n[${name}]`);
  for (const { hex: h, pct } of top) {
    if (pct < 0.12) continue;
    const o = toOklch(h);
    const chroma = o.C < 0.012 ? "무채" : `C ${o.C.toFixed(3)} H ${o.H.toFixed(0)}°`;
    console.log(`  ${h}  ${pct.toFixed(2).padStart(6)}%   L ${o.L.toFixed(3)}  ${chroma}`);
  }
}

// ── 2. 토스 블루 ────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("토스 블루 — 파란 픽셀만 추린 히스토그램");
console.log("=".repeat(80));
for (const name of Object.keys(SHOTS)) {
  const b = blues(imgs[name]);
  if (!b.length) continue;
  console.log(`\n[${name}]`);
  for (const { hex: h, n } of b) {
    const o = toOklch(h);
    console.log(
      `  ${h}  ${String(n).padStart(7)}px   L ${o.L.toFixed(3)}  C ${o.C.toFixed(3)}  H ${o.H.toFixed(1)}°`,
    );
  }
}

// ── 3. 글자 크기 ────────────────────────────────────────────────────────────
// 상자는 스크린샷(1179x2556) 좌표. 각 항목은 한 줄짜리 텍스트만 들어가게 잡았다.
const TEXT = [
  ["home", "이성희 (헤더 이름)", { x0: 60, y0: 190, x1: 200, y1: 290 }, "이성희"],
  ["home", "신분증·인증 (헤더 보조)", { x0: 515, y0: 195, x1: 735, y1: 285 }, "신분증·인증"],
  ["home", "바로가기 (섹션 제목)", { x0: 60, y0: 520, x1: 230, y1: 615 }, "바로가기"],
  ["home", "미니앱 (아이콘 캡션)", { x0: 90, y0: 775, x1: 220, y1: 855 }, "미니앱"],
  ["home", "계좌 개설 (목록 제목)", { x0: 185, y0: 1885, x1: 370, y1: 1975 }, "계좌 개설"],
  ["home", "홈 (탭바 라벨)", { x0: 125, y0: 2392, x1: 180, y1: 2462 }, "홈"],
  ["settings", "이성희 (프로필)", { x0: 245, y0: 365, x1: 400, y1: 455 }, "이성희"],
  ["settings", "내 정보 · 주소 관리", { x0: 245, y0: 432, x1: 590, y1: 508 }, "내 정보 · 주소 관리"],
  ["settings", "언어 (행 라벨)", { x0: 130, y0: 650, x1: 215, y1: 740 }, "언어"],
  ["settings", "인증 및 보안 (섹션)", { x0: 130, y0: 1315, x1: 340, y1: 1410 }, "인증 및 보안"],
  // 제목 1줄째("이성희님,")는 콤마 디센더가 잉크에 섞여 21.67css로 부풀었다. 콤마 없는
  // 2줄째가 같은 줄 크기를 깨끗하게 준다 — 그쪽만 쓴다.
  ["bank", "가입해둔 보험이 있네요 (화면 제목)", { x0: 105, y0: 940, x1: 730, y1: 1035 }, "가입해둔 보험이 있네요"],
  ["bank", "보험 점검하기 (버튼)", { x0: 480, y0: 1112, x1: 730, y1: 1203 }, "보험 점검하기"],
  ["card", "878원 (금액 대, 콤마 뒤만)", { x0: 210, y0: 430, x1: 460, y1: 565 }, "878원"],
  ["card", "000원 (금액 소, 콤마 뒤만)", { x0: 278, y0: 1508, x1: 415, y1: 1602 }, "000원"],
];

/** 상자 안에서 배경과 가장 먼 픽셀 = 안티앨리어싱에 안 섞인 글자 본색. */
function inkColor(img, { x0, y0, x1, y1 }) {
  const bgSample = [];
  for (const bgY of [y0, y1 - 1]) {
    for (let x = x0; x < x1; x++) bgSample.push(px(img, x, bgY));
  }
  const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  const bg = [0, 1, 2].map((c) => med(bgSample.map((p) => p[c])));
  const bgLum = bg[0] + bg[1] + bg[2];

  let best = null;
  let bestD = -1;
  const counts = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      const d = Math.abs(p[0] + p[1] + p[2] - bgLum);
      if (d > bestD) { bestD = d; best = p; }
      // 본색은 글자 속을 채우므로 극단값 근처에서 최빈값을 함께 본다
      if (d > bestD * 0.92) {
        const k = (p[0] << 16) | (p[1] << 8) | p[2];
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    }
  }
  const mode = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    bg: hex(...bg),
    peak: hex(...best),
    mode: mode ? hex((mode[0] >> 16) & 255, (mode[0] >> 8) & 255, mode[0] & 255) : null,
  };
}

// 면 색을 좌표로 직접 확인한다 — 히스토그램 면적만으로는 페이지/카드 구분이 뒤집힐 수 있다.
const SURFACE = [
  ["settings", "페이지 배경 (카드 왼쪽 바깥)", 20, 700],
  ["settings", "페이지 배경 (그룹 사이 여백)", 590, 1230],
  ["settings", "카드 면 (그룹 박스)", 590, 700],
  ["settings", "카드 면 2 (인증 그룹)", 590, 1500],
  ["home", "홈 페이지 배경", 40, 600],
  ["home", "검색창 면", 590, 372],
  ["home", "탭바 배경", 590, 2470],
  ["bank", "뱅크 페이지 배경", 25, 1290],
  ["bank", "뱅크 카드 면", 590, 1450],
  ["card", "카드 페이지 배경", 25, 600],
  ["card", "카드 카드 면", 590, 900],
];

console.log("\n" + "=".repeat(80));
console.log("글자 크기 — 잉크 높이 실측 (CSS px = 실측 / 3, font ≈ 잉크 / 0.73)");
console.log("=".repeat(80));
console.log("샷       항목                       배경      잉크px  잉크CSS  글자색");
const inkTable = [];
for (const [shot, label, box, str] of TEXT) {
  const r = inkHeight(imgs[shot], box);
  if (!r) {
    console.log(`${shot.padEnd(9)}${label.padEnd(27)} — 잉크 못 찾음`);
    continue;
  }
  const c = inkColor(imgs[shot], box);
  inkTable.push({ shot, label, str, inkCss: r.inkCss, bg: r.bg, ink: c.peak, clipped: r.clipped });
  console.log(
    `${shot.padEnd(9)}${label.padEnd(27)}${r.bg}  ` +
      `${String(r.inkPx).padStart(6)}  ${r.inkCss.toFixed(2).padStart(7)}  ${c.peak}` +
      (r.clipped ? `   ⚠ 잘림(${r.clipped})` : ""),
  );
}

// 보정 스크립트가 그대로 읽어갈 수 있게 JSON으로도 남긴다.
const fs = await import("node:fs");
fs.writeFileSync(
  new URL("./_toss-ink.json", import.meta.url),
  JSON.stringify(inkTable, null, 2),
);

// ── 4. 면 색 좌표 확인 ──────────────────────────────────────────────────────
console.log("\n" + "=".repeat(80));
console.log("면 색 — 좌표 직접 샘플 (히스토그램 면적 해석을 검증)");
console.log("=".repeat(80));
for (const [shot, label, x, y] of SURFACE) {
  const [r, g, b] = px(imgs[shot], x, y);
  const h = hex(r, g, b);
  const o = toOklch(h);
  console.log(
    `${shot.padEnd(9)}${label.padEnd(30)}(${String(x).padStart(4)},${String(y).padStart(4)})  ` +
      `${h}   L ${o.L.toFixed(3)}  C ${o.C.toFixed(3)}`,
  );
}
