// 토스뱅크 챗봇 상담 화면 3장에서 대화방 구조를 실측한다.
//   node doc/design/measure-toss-chat.mjs
//
// 앞서 잰 홈·설정 화면과 결정적으로 다른 점이 몇 개 있어 따로 잰다:
//  - 봇 말풍선이 없다. 봇 글은 페이지 배경 위에 그냥 얹힌다. 말풍선은 사용자 쪽만 있다.
//  - 화면 아래쪽에 파란 워시가 있다(홈·설정은 완전한 무채색이었다).
//  - 제안 패널 / 선택 카드 / 종료 다이얼로그라는 새 구조가 나온다.

import { load, px, pxHex, hex, inkHeight, inkColor, radius, bands, DPR } from "./measure-lib.mjs";
import { toOklch, contrast } from "./build-point-ramp.mjs";
import fs from "node:fs";

const DIR = "C:/Users/redte/.claude/uploads/5d4da222-b761-59e8-89d7-3615ccbd5334/";
const SHOTS = {
  suggest: "485dfe26-image.png", // 제안 패널이 떠 있는 첫 화면
  choice: "eb4c7276-image.png", // 사용자 말풍선 + 선택 카드
  dialog: "fb59a8ad-image.png", // 상담 종료 다이얼로그
};
const imgs = {};
for (const [k, f] of Object.entries(SHOTS)) imgs[k] = await load(DIR + f);

const o = (h) => toOklch(h);
const f3 = (n) => n.toFixed(3);
const line = (n = 88) => "=".repeat(n);

// ── 1. 아래쪽 파란 워시 ─────────────────────────────────────────────────────
// 홈·설정은 C 0.004의 완전한 무채색이었다. 이 화면은 아래로 갈수록 푸르러진다.
// 패널을 피해 왼쪽 가장자리(x=12) 세로줄을 훑어 램프를 뜬다.
console.log(line());
console.log("아래쪽 워시 — 왼쪽 가장자리 x=12 세로 스캔 (suggest 화면)");
console.log(line());
console.log("  y(px)   y(css)   색        L      C      H");
for (let y = 1100; y < 2556; y += 130) {
  const h = pxHex(imgs.suggest, 12, y);
  const c = o(h);
  console.log(
    `  ${String(y).padStart(5)}  ${String((y / DPR).toFixed(0)).padStart(6)}   ${h}  ` +
      `${f3(c.L)}  ${f3(c.C)}  ${c.H.toFixed(0).padStart(5)}°`,
  );
}
const washTop = pxHex(imgs.suggest, 12, 1150);
const washBottom = pxHex(imgs.suggest, 12, 2545);
console.log(`\n  워시 위 ${washTop} (L ${f3(o(washTop).L)} C ${f3(o(washTop).C)})`);
console.log(`  워시 아래 ${washBottom} (L ${f3(o(washBottom).L)} C ${f3(o(washBottom).C)} H ${o(washBottom).H.toFixed(0)}°)`);

// ── 2. 면 ───────────────────────────────────────────────────────────────────
const SURFACE = [
  ["suggest", "페이지 배경 (위쪽, 워시 밖)", 12, 700],
  ["suggest", "제안 패널 면", 300, 1730],
  ["suggest", "보내기 버튼 채움", 1074, 2245],
  ["choice", "사용자 말풍선 채움", 690, 880],
  ["choice", "선택 카드 안쪽", 300, 1260],
  ["choice", "선택 CTA 면(비활성)", 160, 1930],
  ["choice", "입력창 면", 300, 2290],
  ["choice", "선택 카드 테두리", 46, 1600],
  ["dialog", "다이얼로그 면", 300, 1130],
  ["dialog", "닫기 버튼 면", 300, 1360],
  ["dialog", "종료하기 버튼 면", 800, 1360],
];
console.log("\n" + line());
console.log("면 — 좌표 직접 샘플");
console.log(line());
for (const [shot, label, x, y] of SURFACE) {
  const h = pxHex(imgs[shot], x, y);
  const c = o(h);
  console.log(
    `  ${label.padEnd(28)}(${String(x).padStart(4)},${String(y).padStart(4)})  ${h}   ` +
      `L ${f3(c.L)}  C ${f3(c.C)}${c.C > 0.012 ? `  H ${c.H.toFixed(0)}°` : ""}`,
  );
}

// ── 3. 글자 ─────────────────────────────────────────────────────────────────
const TEXT = [
  ["suggest", "상담 종료 (우상단)", { x0: 950, y0: 190, x1: 1140, y1: 275 }, "상담 종료"],
  ["suggest", "보관 안내 (최상단)", { x0: 330, y0: 300, x1: 830, y1: 370 }, "최근 3개월 대화만 보관돼요"],
  ["suggest", "날짜", { x0: 420, y0: 430, x1: 760, y1: 505 }, "2026년 9월 22일"],
  ["suggest", "시작 구분선 글자", { x0: 300, y0: 550, x1: 880, y1: 620 }, "상담을 시작했어요"],
  ["suggest", "봇 글 (말풍선 없음)", { x0: 35, y0: 655, x1: 800, y1: 745 }, "안녕하세요 토스뱅크 챗봇 상담이에요"],
  ["suggest", "제안 줄", { x0: 70, y0: 1750, x1: 700, y1: 1830 }, "개인사업자 카드를 만들고 싶어요"],
  ["suggest", "AI 고지 (최하단)", { x0: 380, y0: 2400, x1: 810, y1: 2495 }, "AI가 답변을 제공하고 있어요"],
  ["choice", "사용자 말풍선 글", { x0: 660, y0: 880, x1: 1110, y1: 955 }, "사업자 계좌를 만들었는데 폐업했어"],
  ["choice", "말풍선 시각", { x0: 1020, y0: 995, x1: 1130, y1: 1045 }, "20:55"],
  ["choice", "선택 카드 줄", { x0: 95, y0: 1300, x1: 700, y1: 1380 }, "개인사업자 통장을 만들고"],
  ["choice", "선택 CTA 글자", { x0: 350, y0: 1900, x1: 620, y1: 1975 }, "선택했어요"],
  ["choice", "입력창 자리표시", { x0: 75, y0: 2235, x1: 520, y1: 2345 }, "내용을 입력해주세요"],
  ["dialog", "다이얼로그 제목", { x0: 155, y0: 1140, x1: 640, y1: 1225 }, "상담을 종료할까요?"],
  ["dialog", "종료하기 (파괴적)", { x0: 700, y0: 1320, x1: 920, y1: 1400 }, "종료하기"],
];
console.log("\n" + line(96));
console.log("글자 — 잉크 높이와 본색");
console.log(line(96));
console.log("  항목                        배경      잉크px  잉크CSS  글자색     경고");
const inkTable = [];
for (const [shot, label, box, str] of TEXT) {
  const r = inkHeight(imgs[shot], box);
  if (!r) { console.log(`  ${label.padEnd(28)}— 잉크 못 찾음`); continue; }
  const c = inkColor(imgs[shot], box);
  inkTable.push({ shot, label, str, inkCss: r.inkCss, bg: r.bg, ink: c.ink });
  console.log(
    `  ${label.padEnd(28)}${r.bg}  ${String(r.inkPx).padStart(6)}  ` +
      `${r.inkCss.toFixed(2).padStart(7)}  ${c.ink}  ${r.clipped ? "⚠ 잘림 " + r.clipped : ""}`,
  );
}
fs.writeFileSync(new URL("./_toss-chat-ink.json", import.meta.url), JSON.stringify(inkTable, null, 2));

// ── 3b. 채움 면은 최빈색으로 — 한 점만 찍으면 글자에 걸린다 ───────────────────
function dominant(img, { x0, y0, x1, y1 }) {
  const counts = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const [r, g, b] = px(img, x, y);
    const k = (r << 16) | (g << 8) | b;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const [k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return hex((k >> 16) & 255, (k >> 8) & 255, k & 255);
}
console.log("\n" + line());
console.log("채움 면 — 영역 최빈색");
console.log(line());
for (const [label, shot, box] of [
  ["사용자 말풍선", "choice", { x0: 650, y0: 870, x1: 1120, y1: 965 }],
  ["보내기 버튼", "suggest", { x0: 1020, y0: 2225, x1: 1130, y1: 2335 }],
  ["종료하기 버튼", "dialog", { x0: 600, y0: 1300, x1: 1020, y1: 1420 }],
  ["닫기 버튼", "dialog", { x0: 170, y0: 1300, x1: 560, y1: 1420 }],
]) {
  const h = dominant(imgs[shot], box);
  const c = o(h);
  console.log(`  ${label.padEnd(16)}${h}   L ${f3(c.L)}  C ${f3(c.C)}${c.C > 0.012 ? `  H ${c.H.toFixed(0)}°` : ""}`);
}

// ── 4. 제안 줄 안의 파란 강조 ───────────────────────────────────────────────
// "개인사업자 카드를…"에서 '사업자'만 파랗다. 그 파랑이 토스 키 컬러와 같은지 본다.
console.log("\n" + line());
console.log("제안 줄 안 파란 강조 — 파란 픽셀만 추림");
console.log(line());
{
  const counts = new Map();
  for (let y = 1750; y < 1830; y++) {
    for (let x = 70; x < 700; x++) {
      const [r, g, b] = px(imgs.suggest, x, y);
      if (b - r < 55 || b < 110) continue;
      const k = (r << 16) | (g << 8) | b;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    const h = hex((k >> 16) & 255, (k >> 8) & 255, k & 255);
    const c = o(h);
    console.log(`  ${h}  ${String(n).padStart(6)}px   L ${f3(c.L)}  C ${f3(c.C)}  H ${c.H.toFixed(1)}°`);
  }
}

// ── 5. 모서리 ───────────────────────────────────────────────────────────────
console.log("\n" + line());
console.log("모서리 반경");
console.log(line());
const RADII = [
  ["제안 패널", "suggest", 1690, 1760, [30, 30, 33]],
  ["사용자 말풍선", "choice", 860, 880, [49, 130, 246]],
  ["입력창", "choice", 2230, 2260, [30, 30, 33]],
  ["다이얼로그", "dialog", 1080, 1110, [58, 58, 62]],
];
for (const [label, shot, from, to, fill] of RADII) {
  let top = null;
  for (let y = from; y < to + 60; y++) {
    const p = px(imgs[shot], 589, y);
    if (p.every((v, i) => Math.abs(v - fill[i]) <= 12)) { top = y; break; }
  }
  if (top === null) { console.log(`  ${label.padEnd(16)}상단 못 찾음`); continue; }
  const r = radius(imgs[shot], { yTop: top, fill, tol: 12 });
  console.log(`  ${label.padEnd(16)}상단 y ${String(top).padStart(4)}  좌측 ${String(r.left).padStart(4)}  반경 ${String(r.rPx).padStart(3)}px = ${r.rCss}css`);
}

// ── 6. 대비 ─────────────────────────────────────────────────────────────────
console.log("\n" + line());
console.log("대비 — 실측값끼리");
console.log(line());
const pageTop = pxHex(imgs.suggest, 12, 700);
const botText = inkColor(imgs.suggest, { x0: 35, y0: 655, x1: 800, y1: 745 }).ink;
const bubbleFill = pxHex(imgs.choice, 800, 915);
const bubbleText = inkColor(imgs.choice, { x0: 660, y0: 880, x1: 1110, y1: 955 }).ink;
console.log(`  봇 글 ${botText} on 페이지 ${pageTop}  → ${contrast(botText, pageTop).toFixed(2)}`);
console.log(`  말풍선 글 ${bubbleText} on 채움 ${bubbleFill} → ${contrast(bubbleText, bubbleFill).toFixed(2)}`);
console.log(`  말풍선 채움 ${bubbleFill} 대 페이지 ${pageTop} → OKLab ΔL ${f3(o(bubbleFill).L - o(pageTop).L)}`);
