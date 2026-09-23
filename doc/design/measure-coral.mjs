// 사용자가 토스 챗봇 화면을 직접 코랄 톤으로 리컬러한 판(asset/Screen/sample_003.webp)에서
// 색을 실측한다. "이런 컬러가 좋겠다, 코랄 느낌"이 확정 방향이므로 이 값이 기준이 된다.
//   node doc/design/measure-coral.mjs
//
// 이 파일은 1179x2556 원본을 923x2000으로 균일 축소한 것이다. 넓은 단색 면은 축소해도
// 값이 유지되므로 색 측정에는 문제가 없다(글자 크기는 원본에서 이미 쟀다).
// 좌표는 원본 대비 923/1179 = 0.7829 배.

import { load, px, pxHex, hex, inkColor } from "./measure-lib.mjs";
import { toOklch, contrast } from "./build-point-ramp.mjs";

const img = await load("asset/Screen/sample_003.webp");
const o = (h) => toOklch(h);
const f3 = (n) => n.toFixed(3);
const bar = (n = 84) => "=".repeat(n);

/** 한 점만 찍으면 글자에 걸린다 — 영역 최빈색으로 면을 잡는다. */
function dominant({ x0, y0, x1, y1 }) {
  const counts = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const [r, g, b] = px(img, x, y);
    const k = (r << 16) | (g << 8) | b;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const [k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return hex((k >> 16) & 255, (k >> 8) & 255, k & 255);
}

const show = (label, h, extra = "") => {
  const c = o(h);
  console.log(
    `  ${label.padEnd(24)}${h}   L ${f3(c.L)}  C ${f3(c.C)}` +
      `${c.C > 0.012 ? `  H ${c.H.toFixed(1)}°` : "  (무채)"}${extra ? "   " + extra : ""}`,
  );
};

// ── 1. 워시 ─────────────────────────────────────────────────────────────────
console.log(bar());
console.log("아래쪽 워시 — 왼쪽 가장자리 x=9 세로 스캔");
console.log(bar());
console.log("  y      색        L      C      H");
let peak = { C: -1 };
for (let y = 800; y < 1999; y += 80) {
  const h = pxHex(img, 9, y);
  const c = o(h);
  if (c.C > peak.C) peak = { ...c, hex: h, y };
  console.log(`  ${String(y).padStart(4)}   ${h}  ${f3(c.L)}  ${f3(c.C)}  ${c.H.toFixed(0).padStart(5)}°`);
}
console.log(`\n  가장 진한 지점: ${peak.hex} (y ${peak.y}, L ${f3(peak.L)} C ${f3(peak.C)} H ${peak.H.toFixed(1)}°)`);

// ── 2. 면과 채움 ────────────────────────────────────────────────────────────
console.log("\n" + bar());
console.log("면과 채움 — 영역 최빈색");
console.log(bar());
const pageTop = dominant({ x0: 5, y0: 420, x1: 60, y1: 620 });
show("페이지 (워시 밖)", pageTop);
const bubble = dominant({ x0: 520, y0: 690, x1: 870, y1: 745 });
show("사용자 말풍선 채움", bubble);
const disFill = dominant({ x0: 90, y0: 1480, x1: 500, y1: 1545 });
show("선택 CTA 면 (비활성)", disFill);
const field = dominant({ x0: 120, y0: 1760, x1: 700, y1: 1830 });
show("입력창 면", field);
const washBottom = dominant({ x0: 5, y0: 1930, x1: 120, y1: 1990 });
show("워시 맨 아래", washBottom);

// 선택 카드 테두리: 카드 왼쪽 가장자리를 가로로 훑어 페이지와 가장 다른 픽셀을 찾는다.
console.log("");
{
  const y = 1250;
  let best = null;
  let bestD = -1;
  for (let x = 20; x < 60; x++) {
    const p = px(img, x, y);
    const q = px(img, 8, y); // 같은 높이의 페이지 배경
    const d = Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
    if (d > bestD) { bestD = d; best = { x, hex: hex(...p) }; }
  }
  show("선택 카드 테두리", best.hex, `x=${best.x}`);
}

// ── 3. 글자 ─────────────────────────────────────────────────────────────────
console.log("\n" + bar());
console.log("글자 — 상자 안에서 배경과 가장 먼 픽셀");
console.log(bar());
const TEXTS = [
  ["봇 글", { x0: 25, y0: 835, x1: 620, y1: 895 }],
  ["말풍선 글", { x0: 530, y0: 690, x1: 860, y1: 745 }],
  ["선택 카드 줄", { x0: 75, y0: 1020, x1: 500, y1: 1075 }],
  ["선택 CTA 글자", { x0: 250, y0: 1480, x1: 480, y1: 1540 }],
  ["상담 종료", { x0: 740, y0: 155, x1: 900, y1: 205 }],
  ["안내 (보관돼요)", { x0: 265, y0: 235, x1: 650, y1: 285 }],
  ["말풍선 시각", { x0: 795, y0: 775, x1: 890, y1: 815 }],
  ["입력창 자리표시", { x0: 55, y0: 1755, x1: 400, y1: 1815 }],
  ["AI 고지", { x0: 290, y0: 1890, x1: 640, y1: 1940 }],
];
for (const [label, box] of TEXTS) {
  const c = inkColor(img, box);
  show(label, c.ink, `bg ${c.bg}`);
}

// ── 4. 정리 ─────────────────────────────────────────────────────────────────
console.log("\n" + bar());
console.log("정리 — 대비와 관계");
console.log(bar());
const bubbleText = inkColor(img, { x0: 530, y0: 690, x1: 860, y1: 745 }).ink;
const botText = inkColor(img, { x0: 25, y0: 835, x1: 620, y1: 895 }).ink;
const disText = inkColor(img, { x0: 250, y0: 1480, x1: 480, y1: 1540 }).ink;
console.log(`  말풍선 글 ${bubbleText} on ${bubble}  → ${contrast(bubbleText, bubble).toFixed(2)}`);
console.log(`  봇 글 ${botText} on 페이지 ${pageTop}  → ${contrast(botText, pageTop).toFixed(2)}`);
console.log(`  비활성 CTA ${disText} on ${disFill}  → ${contrast(disText, disFill).toFixed(2)}`);
console.log(`  워시 최고점이 페이지에서 떨어진 정도: OKLab ΔL ${f3(peak.L - o(pageTop).L)}`);
console.log(`\n  타연 기존 핑크 #ff007f = H ${o("#ff007f").H.toFixed(1)}°`);
console.log(`  이 판의 말풍선       = H ${o(bubble).H.toFixed(1)}°  → 색상각 차이 ${(o(bubble).H - o("#ff007f").H).toFixed(1)}°`);
