// 피그마 Redesign 페이지(파일 rl4MznUnbb0MiKVOcsEM98, 프레임 6개)를 PNG 실측한다.
//   node doc/design/measure-redesign.mjs
//
// REST API 를 쓰면 수치를 바로 받을 수 있지만 429(rate limit)가 걸려 있어, 3배 내보낸
// PNG(asset/Screen/New/*.png, 1236x2196 = 412x732 css)에서 픽셀로 되짚는다.
//
// 어려운 점 하나: 다크 프레임은 컴포저 면(#1d1818)과 그 자리의 페이지 배경(#1f1819)이
// 3밖에 차이 나지 않는다. 고정 색으로 경계를 찾으면 상자가 통째로 안 잡힌다.
// 그래서 "같은 행의 좌측 여백 픽셀"을 그 행의 배경 기준값으로 삼아 비교한다.
// 배경이 세로 그라데이션이라 행마다 값이 달라지는 것도 이 방식이면 저절로 따라간다.
// 테두리(#282323)는 배경과 합 29 만큼 벌어지고 면은 3 뿐이라, 임계 18로 테두리만 걸린다.

import fs from "node:fs";
import { load, px, pxHex, hex, inkHeight, inkColor, DPR } from "./measure-lib.mjs";
import { toOklch } from "./build-point-ramp.mjs";

const FRAMES = [
  ["Main_Dark", "다크"],
  ["Main_Light", "라이트"],
  ["Chattingroom_UsingCountPass_Dark", "다크"],
  ["Chattingroom_UsingCountPass_Light", "라이트"],
  ["Chattingroom_UsingTimePass_Dark", "다크"],
  ["Chattingroom_UsingTimePass_Light", "라이트"],
];

const c = (n) => +(n / DPR).toFixed(1); // device px → css
const bar = (n = 78) => "=".repeat(n);
const o = (h) => toOklch(h);
const THRESH = 18; // 채널 합 기준. 테두리는 넘고 면은 못 넘는다.

const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
/** 그 행의 배경 기준값 — 콘텐츠가 닿지 않는 좌측 여백. */
const rowBg = (img, y) => px(img, 4, y);
const isContent = (img, x, y) => dist(px(img, x, y), rowBg(img, y)) >= THRESH;

/** 영역 최빈색. 한 점만 찍으면 글자·테두리에 걸리므로 면은 항상 이걸로 잡는다. */
function dominant(img, { x0, y0, x1, y1 }, keep = () => true) {
  const m = new Map();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      if (!keep(...p)) continue;
      const k = (p[0] << 16) | (p[1] << 8) | p[2];
      m.set(k, (m.get(k) || 0) + 1);
    }
  const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return e ? { hex: hex((e[0] >> 16) & 255, (e[0] >> 8) & 255, e[0] & 255), n: e[1] } : null;
}

const near = (p, h, t = 6) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return Math.abs(p[0] - r) <= t && Math.abs(p[1] - g) <= t && Math.abs(p[2] - b) <= t;
};

/**
 * 원의 지름. 열마다 조건에 맞는 세로 구간을 재서 가장 긴 열을 지름으로 본다.
 * 원 위에 아이콘이나 배지가 얹혀도 가장 긴 열은 살아남는다.
 * 보내기 버튼은 그라데이션이라 단색 비교로는 절반만 잡힌다 — 그래서 조건을 함수로 받는다.
 */
function circleBy(img, { x0, y0, x1, y1 }, test) {
  let best = 0, X0 = 1e9, X1 = -1, Y0 = 1e9, Y1 = -1;
  for (let x = x0; x < x1; x++) {
    let a = -1, b = -1;
    for (let y = y0; y < y1; y++) if (test(px(img, x, y))) { if (a < 0) a = y; b = y; }
    if (a < 0) continue;
    if (x < X0) X0 = x;
    if (x > X1) X1 = x;
    if (a < Y0) Y0 = a;
    if (b > Y1) Y1 = b;
    if (b - a + 1 > best) best = b - a + 1;
  }
  if (X1 < 0) return null;
  return {
    d: c(best), w: c(X1 - X0 + 1), dPx: best,
    x0: X0, x1: X1, y0: Y0, y1: Y1,
    cx: c((X0 + X1) / 2), cy: c((Y0 + Y1) / 2), cyPx: ((Y0 + Y1) / 2) | 0,
  };
}
const circleOf = (img, box, fillHex, tol = 3) => circleBy(img, box, (p) => near(p, fillHex, tol));

/**
 * 원 안에 얹힌 글리프의 크기. 창을 원의 내접 정사각형 안쪽으로 물려야 한다 —
 * 외접 사각형을 그대로 쓰면 네 모서리의 원 바깥 픽셀이 전부 "글리프"로 잡힌다.
 * 내접 정사각형의 여백은 지름의 0.146배라 0.16배를 물린다.
 */
function glyphInCircle(img, circle, bgHex, tol = 14) {
  const inset = Math.ceil(circle.dPx * 0.16);
  const cx = (circle.x0 + circle.x1) / 2, cy = (circle.y0 + circle.y1) / 2;
  const half = circle.dPx / 2 - inset;
  let a = 1e9, b = 1e9, cc = -1, d = -1;
  for (let y = Math.ceil(cy - half); y <= cy + half; y++)
    for (let x = Math.ceil(cx - half); x <= cx + half; x++)
      if (!near(px(img, x, y), bgHex, tol)) { if (x < a) a = x; if (x > cc) cc = x; if (y < b) b = y; if (y > d) d = y; }
  return cc < 0 ? null : { w: c(cc - a + 1), h: c(d - b + 1) };
}

const out = {};

for (const [name, mode] of FRAMES) {
  const img = await load(`asset/Screen/New/${name}.png`);
  const W = img.w, H = img.h;
  const isChat = name.startsWith("Chatting");
  const r = { frame: `${c(W)}x${c(H)}`, mode };

  console.log("\n" + bar());
  console.log(`${name}   ${c(W)} x ${c(H)} css`);
  console.log(bar());

  // ── 배경 램프 ────────────────────────────────────────────────────────────
  console.log("\n[배경] 좌측 여백 세로 램프");
  const ramp = [];
  for (let y = 20; y < H - 20; y += Math.floor((H - 40) / 10)) {
    const h = pxHex(img, 6, y);
    ramp.push({ y: c(y), hex: h });
    const k = o(h);
    console.log(`   y ${String(c(y)).padStart(5)}   ${h}   L ${k.L.toFixed(3)} C ${k.C.toFixed(3)}${k.C > 0.012 ? ` H ${k.H.toFixed(0)}°` : ""}`);
  }
  r.bgRamp = ramp;

  // ── 상단바 ───────────────────────────────────────────────────────────────
  const topFill = pxHex(img, 6, 30);
  let cut = -1;
  for (let y = 30; y < 400; y++) if (!near(px(img, 6, y), topFill, 3)) { cut = y; break; }
  if (cut > 0) {
    const lineHex = pxHex(img, 6, cut);
    let end = cut;
    while (end < cut + 30 && near(px(img, 6, end), lineHex, 6)) end++;
    console.log(`\n[상단바] 면 ${topFill}  높이 ${c(cut)}  구분선 ${lineHex} 두께 ${c(end - cut)}`);
    r.topbar = { fill: topFill, height: c(cut), line: lineHex, lineWidth: c(end - cut) };
  }

  if (!isChat) { out[name] = r; continue; }

  // ── 보내기 버튼 — 코랄이라 하단 우측에서 유일하다. 여기부터 컴포저를 되짚는다. ──
  // 컴포저를 먼저 고정한다. 사용자 말풍선도 코랄이라 보내기 버튼부터 찾으면 그걸 문다.
  // 화면 맨 아래 콘텐츠 띠가 컴포저 바닥선이다 — 그 아래는 배경뿐이다.
  let bBot = -1;
  for (let y = H - 2; y > H - 400; y--) {
    let n = 0;
    for (let x = 0; x < W; x += 4) if (isContent(img, x, y)) n++;
    if (n > 30) { bBot = y; break; }
  }
  let bL = -1, bR = -1;
  for (let x = 0; x < W / 2; x++) if (isContent(img, x, bBot - 6)) { bL = x; break; }
  for (let x = W - 1; x > W / 2; x--) if (isContent(img, x, bBot - 6)) { bR = x; break; }
  const probe = bL + 8; // 좌측 테두리 안쪽, 칩보다 왼쪽 — 콘텐츠가 없는 열
  const yMid = bBot - 6;
  // 라이트는 상자 면(#ffffff)이 배경과 크게 달라 "콘텐츠"로 잡히고, 다크는 면이 배경과
  // 3밖에 차이 나지 않아 테두리만 잡힌다. 그래서 탐색 방향을 극성에 따라 뒤집는다.
  const insideIsContent = isContent(img, probe, bBot - 20);
  let bTop = -1;
  if (insideIsContent) {
    for (let y = bBot - 20; y > 2; y--) if (!isContent(img, probe, y)) { bTop = y + 1; break; }
  } else {
    for (let y = bBot - 20; y > 2; y--) if (isContent(img, probe, y)) { bTop = y; while (bTop > 2 && isContent(img, probe, bTop - 1)) bTop--; break; }
  }
  const boxFill = pxHex(img, probe, bBot - 20);

  // 좌우폭은 상자 세로 중앙에서 다시 잰다 — 아래쪽 모서리에서 재면 둥근 모서리만큼 좁게 나온다.
  const yMidBox = ((bTop + bBot) / 2) | 0;
  for (let x = 0; x < W / 2; x++) if (isContent(img, x, yMidBox)) { bL = x; break; }
  for (let x = W - 1; x > W / 2; x--) if (isContent(img, x, yMidBox)) { bR = x; break; }

  // 보내기 버튼 — 이제 상자 안으로 창을 좁혔으니 말풍선에 걸리지 않는다.
  const coral = (p) => p[0] > 140 && p[0] - p[1] > 50 && p[0] - p[2] > 15;
  const send = circleBy(img, { x0: (bL + bR) >> 1, y0: bTop + 3, x1: bR - 2, y1: bBot - 2 }, coral);
  // 그라데이션 축이 가로일 수 있어 세로로만 찍으면 두 값이 같게 나온다. 대각으로 찍는다.
  const sIn = Math.ceil(send.dPx * 0.16);
  const sendGrad = [pxHex(img, send.x0 + sIn, send.y1 - sIn), pxHex(img, send.x1 - sIn, send.y0 + sIn)];
  const strokeHex = pxHex(img, bL + 1, yMid);
  console.log(`\n[컴포저] ${c(bR - bL + 1)} x ${c(bBot - bTop + 1)}  좌 ${c(bL)} 우 ${c(bR)}  면 ${boxFill}  테두리 ${strokeHex}`);
  r.composer = { w: c(bR - bL + 1), h: c(bBot - bTop + 1), left: c(bL), fill: boxFill, stroke: strokeHex };

  // ── 칩 원 / 보내기 원 ────────────────────────────────────────────────────
  // 칩 채움은 "상자 면이 아닌 것 중 가장 넓은 색"으로 잡는다. 아이콘 글리프와 배지도
  // 후보에 들지만 면적이 칩보다 훨씬 작아 최빈에서 밀린다.
  // 창을 테두리 안쪽으로 물린다. 라이트는 테두리(#eae3e2)가 칩 채움(#e7e2e1)과 3밖에
  // 차이 나지 않아, 세로로 긴 좌측 테두리가 그대로 "지름"으로 잡혀버린다.
  const cWin = { x0: bL + 12, y0: bTop + 5, x1: bL + 200, y1: bBot - 4 };
  const chipHex = dominant(img, cWin, (rr, g, b) => !near([rr, g, b], boxFill, 6)).hex;
  const chip = circleOf(img, cWin, chipHex, 3);
  console.log(`         칩 원    ${chip.d} 지름  ${chipHex}  중심 (${chip.cx}, ${chip.cy})`);
  console.log(`         보내기   ${send.d} 지름  그라데이션 ${sendGrad[0]} → ${sendGrad[1]}  중심 (${send.cx}, ${send.cy})`);
  r.chip = { d: chip.d, fill: chipHex, cx: chip.cx, cy: chip.cy };
  r.send = { d: send.d, grad: sendGrad, cx: send.cx, cy: send.cy };

  const g1 = glyphInCircle(img, chip, chipHex);
  if (g1) { console.log(`         스프레드 아이콘 ${g1.w} x ${g1.h}`); r.spreadIcon = g1; }
  const g2 = glyphInCircle(img, send, sendGrad[1], 46);
  if (g2) { console.log(`         보내기 아이콘   ${g2.w} x ${g2.h}`); r.sendIcon = g2; }

  // ── 궁합 배지 ────────────────────────────────────────────────────────────
  const badgeHex = mode === "다크" ? "#f53a63" : "#e04e6e";
  const badge = circleOf(img, { x0: chip.x0, y0: chip.y0 - 40, x1: chip.x1 + 50, y1: chip.y0 + 70 }, badgeHex, 8);
  if (badge) {
    const bg = glyphInCircle(img, badge, badgeHex, 40);
    console.log(`         궁합 배지 ${badge.d} 지름  ${badgeHex}  글리프 ${bg ? bg.w + " x " + bg.h : "—"}`);
    console.log(`                   칩 밖으로 위 ${c(chip.y0 - badge.y0)} / 오른쪽 ${c(badge.x1 - chip.x1)}`);
    r.badge = { d: badge.d, fill: badgeHex, glyph: bg, overTop: c(chip.y0 - badge.y0), overRight: c(badge.x1 - chip.x1) };
  } else {
    console.log("         궁합 배지 없음 (궁합 off)");
  }

  // ── 입력 글자 ────────────────────────────────────────────────────────────
  const tBox = { x0: chip.x1 + 30, y0: bTop + 12, x1: send.x0 - 30, y1: bBot - 12 };
  const ph = inkHeight(img, tBox);
  if (ph) {
    console.log(`         입력 글자  잉크 ${ph.inkCss.toFixed(2)}  ${inkColor(img, tBox).ink}`);
    r.composerText = { inkCss: +ph.inkCss.toFixed(2), color: inkColor(img, tBox).ink };
  }

  // ── 이용권 바 ────────────────────────────────────────────────────────────
  // 컴포저 위쪽으로 올라가며 다음 콘텐츠 덩어리를 찾는다.
  let pBot = -1, pTop = -1;
  for (let y = bTop - 6; y > bTop - 260; y--) if (isContent(img, probe, y)) { pBot = y; break; }
  if (pBot > 0) for (let y = pBot; y > pBot - 260; y--) if (!isContent(img, probe, y)) { pTop = y + 1; break; }
  if (pTop > 0) {
    let pL = -1, pR = -1;
    const pMid = ((pTop + pBot) / 2) | 0;
    for (let x = 0; x < W / 2; x++) if (isContent(img, x, pMid)) { pL = x; break; }
    for (let x = W - 1; x > W / 2; x--) if (isContent(img, x, pMid)) { pR = x; break; }
    const pFill = dominant(img, { x0: pL + 30, y0: pTop + 6, x1: pL + 60, y1: pBot - 6 }).hex;
    const ptBox = { x0: pL + 130, y0: pTop + 5, x1: pR - 30, y1: pBot - 5 };
    const pt = inkHeight(img, ptBox);
    console.log(`\n[이용권 바] ${c(pR - pL + 1)} x ${c(pBot - pTop + 1)}  좌 ${c(pL)}  면 ${pFill}`);
    if (pt) console.log(`            글자 잉크 ${pt.inkCss.toFixed(2)}  ${inkColor(img, ptBox).ink}`);
    r.passBar = {
      w: c(pR - pL + 1), h: c(pBot - pTop + 1), fill: pFill,
      inkCss: pt ? +pt.inkCss.toFixed(2) : null, color: pt ? inkColor(img, ptBox).ink : null,
    };
  }

  out[name] = r;
}

fs.writeFileSync(new URL("./_redesign-measured.json", import.meta.url), JSON.stringify(out, null, 2));
console.log("\n" + bar());
console.log("_redesign-measured.json 저장");
