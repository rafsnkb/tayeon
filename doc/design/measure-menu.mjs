// 피그마 메뉴 드로어 목업 4장을 PNG 실측한다.
//   node doc/design/measure-menu.mjs
//
// asset/Screen/New/MenuOpen{, - NotLogin}_{Dark,Light}.png (1236x2196 = 412x732 css, 3배)
// measure-redesign.mjs 와 같은 방식 — 고정 색으로 경계를 찾지 않고 "같은 행의 좌측 여백"을
// 그 행의 배경 기준값으로 삼는다. 드로어 뒤에 대화 화면이 비쳐 배경이 균일하지 않기 때문이다.
//
// 구분선은 배경과 차이가 작아(다크 합 12, 라이트 합 21) 블록 프로파일에 안 잡힌다.
// 그래서 임계를 낮춘 전용 스캔(hairlines)으로 따로 찾는다.

import { load, px, hex, inkHeight, inkColor, DPR } from "./measure-lib.mjs";

const c = (n) => +(n / DPR).toFixed(1);
const bar = (n = 78) => "=".repeat(n);
const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function dominant(img, { x0, y0, x1, y1 }) {
  const m = new Map();
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      const k = (p[0] << 16) | (p[1] << 8) | p[2];
      m.set(k, (m.get(k) || 0) + 1);
    }
  const e = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return e ? hex((e[0] >> 16) & 255, (e[0] >> 8) & 255, e[0] & 255) : null;
}

function drawerRight(img, y) {
  const base = px(img, 4, y);
  for (let x = 5; x < img.w; x++) if (dist(px(img, x, y), base) > 24) return x;
  return null;
}

function rowProfile(img, { x0, x1, y0, y1 }, thresh = 10) {
  const out = [];
  for (let y = y0; y < y1; y++) {
    const base = px(img, 6, y);
    let n = 0;
    for (let x = x0; x < x1; x++) if (dist(px(img, x, y), base) > thresh) n++;
    out.push(n);
  }
  return out;
}

function runs(profile, min, gap = 2) {
  const out = [];
  let cur = null, blank = 0;
  profile.forEach((v, i) => {
    if (v >= min) {
      if (!cur) cur = { first: i, last: i };
      else cur.last = i;
      blank = 0;
    } else if (cur && ++blank > gap) { out.push(cur); cur = null; }
  });
  if (cur) out.push(cur);
  return out;
}

/** 드로어 폭 전체를 가로지르는 얇은 선 — 임계를 낮추고 "거의 모든 x가 바뀐 행"만 고른다. */
function hairlines(img, right) {
  const out = [];
  for (let y = 130; y < img.h - 2; y++) {
    const above = px(img, 20, y - 3);
    let n = 0;
    for (let x = 10; x < right - 10; x++) if (dist(px(img, x, y), above) > 6) n++;
    if (n > (right - 20) * 0.9) out.push({ y, color: dominant(img, { x0: 20, y0: y, x1: right - 20, y1: y + 1 }) });
  }
  // 연속 행 묶기
  const g = [];
  for (const h of out) {
    const last = g[g.length - 1];
    if (last && h.y - last.y1 <= 1) { last.y1 = h.y; last.n++; }
    else g.push({ y0: h.y, y1: h.y, n: 1, color: h.color });
  }
  return g;
}

/** 면의 가로 경계 */
function spanX(img, y, fillHex, tol = 12) {
  const f = rgb(fillHex);
  const near = (p) => Math.abs(p[0] - f[0]) <= tol && Math.abs(p[1] - f[1]) <= tol && Math.abs(p[2] - f[2]) <= tol;
  let a = null, b = null;
  for (let x = 0; x < img.w; x++) if (near(px(img, x, y))) { a = x; break; }
  for (let x = img.w - 1; x >= 0; x--) if (near(px(img, x, y))) { b = x; break; }
  return a === null ? null : { x0: a, x1: b + 1, wPx: b + 1 - a, wCss: c(b + 1 - a), leftCss: c(a) };
}

/** 모서리 반경 — 좌측 시작 x가 안정될 때까지의 행 수 */
function radiusOf(img, yTop, fillHex, scan = 80, tol = 12) {
  const f = rgb(fillHex);
  const near = (p) => Math.abs(p[0] - f[0]) <= tol && Math.abs(p[1] - f[1]) <= tol && Math.abs(p[2] - f[2]) <= tol;
  const firsts = [];
  for (let dy = 0; dy < scan; dy++) {
    let fx = null;
    for (let x = 0; x < img.w; x++) if (near(px(img, x, yTop + dy))) { fx = x; break; }
    firsts.push(fx);
  }
  const seen = firsts.filter((v) => v !== null);
  if (!seen.length) return null;
  const minX = Math.min(...seen);
  const settle = firsts.findIndex((v) => v !== null && v <= minX + 1);
  return { rPx: settle, rCss: c(settle) };
}

/** 원 지름 — 조건에 맞는 세로 구간이 가장 긴 열 */
function circle(img, { x0, y0, x1, y1 }, test) {
  let best = { len: 0 };
  for (let x = x0; x < x1; x++) {
    let run = 0, start = null, bestRun = 0, bestStart = null;
    for (let y = y0; y < y1; y++) {
      if (test(px(img, x, y))) { if (run === 0) start = y; run++; if (run > bestRun) { bestRun = run; bestStart = start; } }
      else run = 0;
    }
    if (bestRun > best.len) best = { len: bestRun, x, yTop: bestStart };
  }
  return best.len ? { dPx: best.len, dCss: c(best.len), x: best.x, yTop: best.yTop } : null;
}

async function measureLoggedIn(name) {
  const img = await load(`asset/Screen/New/${name}.png`);
  console.log(`\n${bar()}\n${name}\n${bar()}`);
  const right = 870;
  const surface = dominant(img, { x0: 8, y0: 400, x1: 40, y1: 460 });
  console.log(`드로어        폭 ${c(right)} css   면 ${surface}`);

  // ── 구분선
  console.log(`\n구분선`);
  for (const h of hairlines(img, right)) {
    console.log(`  y ${h.y0}~${h.y1} (${h.n}px = ${c(h.n)} css)  top ${c(h.y0)}   색 ${h.color}`);
  }

  // ── 새 대화 버튼 (y 234~377)
  const nb = dominant(img, { x0: 200, y0: 250, x1: 400, y1: 270 });
  const nbSpan = spanX(img, 300, nb);
  console.log(`\n새 대화 버튼   y ${c(234)}~${c(378)} 높이 ${c(144)} css`);
  console.log(`  면 ${nb}   좌우 x ${nbSpan.leftCss}~${c(nbSpan.x1)} (폭 ${nbSpan.wCss})   반경 ${radiusOf(img, 234, nb)?.rCss}`);
  console.log(`  라벨 ${JSON.stringify(inkColor(img, { x0: 380, y0: 280, x1: 560, y1: 330 }))}  잉크높이 ${inkHeight(img, { x0: 380, y0: 270, x1: 560, y1: 345 })?.inkCss}`);
  const icon = circle(img, { x0: 90, y0: 250, x1: 170, y1: 365 }, (p) => dist(p, rgb(nb)) > 40);
  console.log(`  좌측 아이콘 지름 ${icon?.dCss} css (x ${c(icon?.x)}, top ${c(icon?.yTop)})  색 ${JSON.stringify(inkColor(img, { x0: 95, y0: 265, x1: 165, y1: 350 }))}`);

  // ── 최근 대화 라벨
  console.log(`\n최근 대화     top ${c(455)}  잉크 ${inkHeight(img, { x0: 40, y0: 445, x1: 260, y1: 505 })?.inkCss}  ${JSON.stringify(inkColor(img, { x0: 40, y0: 450, x1: 260, y1: 500 }))}`);

  // ── 방 목록
  const active = dominant(img, { x0: 200, y0: 860, x1: 700, y1: 880 });
  const aSpan = spanX(img, 915, active);
  console.log(`\n방 목록`);
  console.log(`  행 간격 52 css (텍스트 중심 195→247)   활성 행 높이 ${c(144)} css`);
  console.log(`  활성 면 ${active}   좌우 x ${aSpan.leftCss}~${c(aSpan.x1)} (폭 ${aSpan.wCss})   반경 ${radiusOf(img, 846, active)?.rCss}`);
  const bullet = circle(img, { x0: 100, y0: 570, x1: 145, y1: 645 }, (p) => dist(p, rgb(surface)) > 60);
  console.log(`  불릿 지름 ${bullet?.dCss} css (x ${c(bullet?.x)})  ${JSON.stringify(inkColor(img, { x0: 100, y0: 580, x1: 140, y1: 635 }))}`);
  console.log(`  방 제목 잉크 ${inkHeight(img, { x0: 180, y0: 575, x1: 700, y1: 640 })?.inkCss}  ${JSON.stringify(inkColor(img, { x0: 180, y0: 580, x1: 700, y1: 635 }))}`);

  // ── 하단: 마이 페이지 + 벨
  const mp = dominant(img, { x0: 250, y0: 1860, x1: 550, y1: 1900 });
  const mpSpan = spanX(img, 1880, mp);
  console.log(`\n마이 페이지    y top ${c(1809)} 높이 ${c(144)} css`);
  console.log(`  면 ${mp}   좌우 x ${mpSpan.leftCss}~${c(mpSpan.x1)} (폭 ${mpSpan.wCss})   반경 ${radiusOf(img, 1809, mp)?.rCss}`);
  console.log(`  라벨 ${JSON.stringify(inkColor(img, { x0: 290, y0: 1850, x1: 520, y1: 1910 }))}  잉크 ${inkHeight(img, { x0: 290, y0: 1840, x1: 520, y1: 1920 })?.inkCss}`);
  const bell = circle(img, { x0: 690, y0: 1790, x1: 830, y1: 1970 }, (p) => dist(p, px(img, 800, 1790)) > 20);
  console.log(`  벨 원 지름 ${bell?.dCss} css (x ${c(bell?.x)})  면 ${dominant(img, { x0: 700, y0: 1860, x1: 730, y1: 1900 })}`);
  console.log(`  벨 배지 색 ${dominant(img, { x0: 790, y0: 1800, x1: 815, y1: 1825 })}`);

  // ── 이용권 구입하기
  const cta = dominant(img, { x0: 100, y0: 2010, x1: 300, y1: 2040 });
  const ctaSpan = spanX(img, 2015, cta, 30);
  console.log(`\n이용권 구입하기 y top ${c(2001)} 높이 ${c(144)} css`);
  console.log(`  면 ${cta}   좌우 x ${ctaSpan.leftCss}~${c(ctaSpan.x1)} (폭 ${ctaSpan.wCss})   반경 ${radiusOf(img, 2001, cta, 80, 30)?.rCss}`);
  console.log(`  좌/중/우 픽셀  ${hex(...px(img, 60, 2072))} / ${hex(...px(img, 435, 2072))} / ${hex(...px(img, 810, 2072))}`);
  console.log(`  라벨 ${JSON.stringify(inkColor(img, { x0: 290, y0: 2050, x1: 590, y1: 2100 }))}`);
  console.log(`  바닥 여백  ${c(img.h - 2145)} css`);
}

async function measureNotLogin(name) {
  const img = await load(`asset/Screen/New/${name}.png`);
  console.log(`\n${bar()}\n${name}\n${bar()}`);
  const right = 870;
  const surface = dominant(img, { x0: 8, y0: 400, x1: 40, y1: 460 });
  console.log(`드로어        폭 ${c(right)} css   면 ${surface}`);
  console.log(`\n구분선`);
  const hl = hairlines(img, right);
  console.log(hl.length ? hl.map((h) => `  y ${h.y0}~${h.y1} top ${c(h.y0)} 색 ${h.color}`).join("\n") : `  없음`);

  console.log(`\n안내 문구 3줄  top ${c(827)} / ${c(878)} / ${c(929)}   줄간격 ${c(51)} css`);
  console.log(`  ${JSON.stringify(inkColor(img, { x0: 200, y0: 820, x1: 680, y1: 870 }))}  잉크 ${inkHeight(img, { x0: 200, y0: 818, x1: 680, y1: 872 })?.inkCss}`);

  const k = dominant(img, { x0: 150, y0: 1010, x1: 650, y1: 1040 });
  const kSpan = spanX(img, 1060, k);
  console.log(`\n카카오 버튼    y top ${c(999)} 높이 ${c(138)} css`);
  console.log(`  면 ${k}   좌우 x ${kSpan.leftCss}~${c(kSpan.x1)} (폭 ${kSpan.wCss})   반경 ${radiusOf(img, 999, k)?.rCss}`);
  console.log(`  라벨 ${JSON.stringify(inkColor(img, { x0: 310, y0: 1040, x1: 640, y1: 1100 }))}  잉크 ${inkHeight(img, { x0: 310, y0: 1035, x1: 640, y1: 1105 })?.inkCss}`);
  const ki = circle(img, { x0: 240, y0: 1030, x1: 300, y1: 1110 }, (p) => dist(p, rgb(k)) > 60);
  console.log(`  말풍선 아이콘 지름 ${ki?.dCss} css (x ${c(ki?.x)}, top ${c(ki?.yTop)})`);

  console.log(`\n사업자 정보    5줄 top ${[1858, 1900, 1942, 1984, 2029].map(c).join(" / ")}   줄간격 ${c(42)} css`);
  console.log(`  ${JSON.stringify(inkColor(img, { x0: 190, y0: 1855, x1: 690, y1: 1895 }))}  잉크 ${inkHeight(img, { x0: 190, y0: 1852, x1: 690, y1: 1896 })?.inkCss}`);
  console.log(`  테두리·배경 있나 → 좌측 x40 색 ${hex(...px(img, 40, 1900))} vs 드로어 면 ${surface}`);
  console.log(`\n링크 줄        top ${c(2110)}  ${JSON.stringify(inkColor(img, { x0: 160, y0: 2105, x1: 720, y1: 2150 }))}`);
  console.log(`  바닥 여백  ${c(img.h - 2148)} css`);
}

for (const n of ["MenuOpen_Dark", "MenuOpen_Light"]) await measureLoggedIn(n);
for (const n of ["MenuOpen - NotLogin_Dark", "MenuOpen - NotLogin_Light"]) await measureNotLogin(n);
