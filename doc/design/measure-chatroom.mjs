// 피그마 "New/Chattingroom_UsingCountPass_{Dark,Light}" 실측 (2026-09-24).
// 말풍선 폭·정렬·면색을 본다. 1236x2196 = 412x732 @3x.
import { load, px, hex, DPR } from "./measure-lib.mjs";

const css = (v) => +(v / DPR).toFixed(1);
const FILES = {
  dark: "asset/Screen/New/Chattingroom_UsingCountPass_Dark.png",
  light: "asset/Screen/New/Chattingroom_UsingCountPass_Light.png",
};

for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} ===`);
  const bg = px(img, 4, 900);
  console.log("배경(좌측여백 y300):", hex(...bg));

  // 분홍 말풍선: 배경과 크게 다른 색이 연속으로 나오는 행을 찾는다.
  const far = (p) => Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - px(img, 4, yCur)[c])));
  let yCur = 0;
  const rows = [];
  for (let y = 300; y < img.h - 300; y += 3) {
    yCur = y;
    const rowBg = px(img, 4, y);
    let run = 0, best = 0, lo = null, bestLo = null;
    for (let x = 0; x < img.w; x++) {
      const p = px(img, x, y);
      const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - rowBg[c])));
      if (d > 60) { if (run === 0) lo = x; run++; if (run > best) { best = run; bestLo = lo; } }
      else run = 0;
    }
    rows.push({ y, best, lo: bestLo });
  }
  // 채워진 면(연속 100px 이상)만 = 말풍선
  const fills = rows.filter((r) => r.best > 100);
  const groups = [];
  for (const r of fills) {
    const last = groups[groups.length - 1];
    if (last && r.y - last.y1 <= 9) { last.y1 = r.y; last.rows.push(r); }
    else groups.push({ y0: r.y, y1: r.y, rows: [r] });
  }
  for (const g of groups) {
    const mid = g.rows[Math.floor(g.rows.length / 2)];
    const fill = hex(...px(img, mid.lo + Math.floor(mid.best / 2), mid.y));
    console.log(
      `  면: top ${css(g.y0)} ~ ${css(g.y1)} (h ${css(g.y1 - g.y0)})  x ${css(mid.lo)}~${css(mid.lo + mid.best)}` +
        `  폭 ${css(mid.best)}  색 ${fill}`
    );
  }
}

// --- 2차: 사용자 말풍선의 진짜 좌우 끝(면색 기준) ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  const fill = mode === "dark" ? [245, 58, 99] : [224, 78, 110];
  const near = (p, tol = 40) => p.every((v, i) => Math.abs(v - fill[i]) <= tol);
  console.log(`\n=== ${mode} 말풍선 좌우 ===`);
  for (const yCss of [355, 370, 385, 400, 60, 62]) {
    const y = Math.round(yCss * DPR);
    let lo = null, hi = null;
    for (let x = 0; x < img.w; x++) if (near(px(img, x, y))) { if (lo === null) lo = x; hi = x; }
    if (lo !== null) console.log(`  y ${yCss}: x ${css(lo)}~${css(hi + 1)} 폭 ${css(hi - lo + 1)}`);
  }
  // AI 답변 줄이 배경 위에 그대로 있는지(면 없음) 확인
  console.log("  AI 답변 영역 배경 샘플 y=120,150 x=40,200,360:",
    [120, 150].map((yy) => [40, 200, 360].map((xx) => hex(...px(img, Math.round(xx * DPR), Math.round(yy * DPR)))).join(",")).join(" | "));
}

// --- 3차: AI 답변 텍스트의 좌우 끝(면이 없으므로 잉크로) ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} AI 텍스트 ===`);
  for (const yCss of [118, 133, 178, 193, 208]) {
    const y = Math.round(yCss * DPR);
    const bg = px(img, 4, y);
    let lo = null, hi = null;
    for (let x = 0; x < img.w; x++) {
      const p = px(img, x, y);
      if (Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c]))) > 30) { if (lo === null) lo = x; hi = x; }
    }
    console.log(`  y ${yCss}: ${lo === null ? "-" : `x ${css(lo)}~${css(hi + 1)}`}`);
  }
}

// --- 4차: AI 답변 영역 전체의 좌/우 극단 ---
{
  const img = await load(FILES.dark);
  let minLo = 9999, maxHi = 0;
  const lines = [];
  for (let yCss = 100; yCss <= 300; yCss += 1) {
    const y = Math.round(yCss * DPR);
    const bg = px(img, 4, y);
    let lo = null, hi = null;
    for (let x = 0; x < img.w; x++) {
      const p = px(img, x, y);
      if (Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c]))) > 30) { if (lo === null) lo = x; hi = x; }
    }
    if (lo !== null) { minLo = Math.min(minLo, lo); maxHi = Math.max(maxHi, hi); lines.push(`${yCss}:${css(lo)}~${css(hi + 1)}`); }
  }
  console.log("\n=== dark AI 영역 극단 ===");
  console.log("  좌 최소:", css(minLo), "/ 우 최대:", css(maxHi + 1));
  console.log(" ", lines.filter((_, i) => i % 7 === 0).join("  "));
}

// --- 5차: "이어서 물어보기" 제안 블록의 바깥 stroke 두께·색·반경 ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} 제안 블록 ===`);
  // 블록 중앙 세로선을 훑어 "배경과 다른 얇은 띠"를 찾는다.
  const xProbe = Math.round(img.w / 2);
  const runs = [];
  let cur = null;
  for (let y = Math.round(480 * DPR); y < Math.round(640 * DPR); y++) {
    const bg = px(img, 4, y);
    const p = px(img, xProbe, y);
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c])));
    if (d > 12) { if (!cur) cur = { y0: y, y1: y }; else cur.y1 = y; }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  for (const r of runs) {
    const h = r.y1 - r.y0 + 1;
    const mid = Math.round((r.y0 + r.y1) / 2);
    console.log(`  세로 ${css(r.y0)} ~ ${css(r.y1 + 1)}  두께 ${h}px(raw) = ${css(h)}css  색 ${hex(...px(img, xProbe, mid))}`);
  }
  // 가로로도: 블록 좌우 테두리
  const yProbe = Math.round(560 * DPR);
  const hruns = [];
  let hc = null;
  const bgRow = px(img, 4, yProbe);
  for (let x = 0; x < img.w; x++) {
    const p = px(img, x, yProbe);
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bgRow[c])));
    if (d > 12) { if (!hc) hc = { x0: x, x1: x }; else hc.x1 = x; }
    else if (hc) { hruns.push(hc); hc = null; }
  }
  if (hc) hruns.push(hc);
  console.log("  가로(y 560):", hruns.map((r) => `${css(r.x0)}~${css(r.x1 + 1)}(${r.x1 - r.x0 + 1}px raw, ${hex(...px(img, r.x0, yProbe))})`).join("  "));
}

// --- 6차: stroke 단면(안티앨리어싱 제외한 실두께) ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  const x = Math.round(img.w / 2);
  const out = [];
  for (let y = Math.round(514 * DPR); y <= Math.round(521 * DPR); y++) out.push(`${y}:${hex(...px(img, x, y))}`);
  console.log(`\n${mode} 상단 stroke 단면(x=${x}):`, out.join(" "));
  const y2 = Math.round(560 * DPR);
  const out2 = [];
  for (let xx = Math.round(38 * DPR); xx <= Math.round(45 * DPR); xx++) out2.push(`${xx}:${hex(...px(img, xx, y2))}`);
  console.log(`${mode} 좌측 stroke 단면(y=${y2}):`, out2.join(" "));
}
