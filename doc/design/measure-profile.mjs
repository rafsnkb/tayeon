// 메뉴 드로어 "마이 페이지" 행의 프로필 원 실측 (New/MenuOpen_{Dark,Light}).
import { load, px, hex, DPR } from "./measure-lib.mjs";
const css = (v) => +(v / DPR).toFixed(1);
const FILES = {
  dark: "asset/Screen/New/MenuOpen_Dark.png",
  light: "asset/Screen/New/MenuOpen_Light.png",
};
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} ===`);
  // 마이페이지 행: 실측 top 603, 높이 48 → css y 603~651. 그 안에서 좌측 원을 찾는다.
  const pillBg = px(img, Math.round(150 * DPR), Math.round(627 * DPR)); // 알약 면(라벨 왼쪽 빈 곳)
  console.log("  알약 면:", hex(...pillBg));
  for (const yCss of [615, 621, 627, 633, 639]) {
    const y = Math.round(yCss * DPR);
    let lo = null, hi = null;
    for (let x = Math.round(10 * DPR); x < Math.round(120 * DPR); x++) {
      const p = px(img, x, y);
      const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - pillBg[c])));
      if (d > 14) { if (lo === null) lo = x; hi = x; }
    }
    console.log(`  y ${yCss}: ${lo === null ? "-" : `원 x ${css(lo)}~${css(hi + 1)} 지름 ${css(hi - lo + 1)} 색 ${hex(...px(img, Math.round((lo + hi) / 2), y))}`}`);
  }
  // 세로 지름
  const xMid = Math.round(40 * DPR);
  let t = null, b = null;
  for (let y = Math.round(595 * DPR); y < Math.round(660 * DPR); y++) {
    const p = px(img, xMid, y);
    const d = Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - pillBg[c])));
    if (d > 14) { if (t === null) t = y; b = y; }
  }
  if (t !== null) console.log(`  세로: top ${css(t)} ~ ${css(b + 1)} 지름 ${css(b - t + 1)}`);
}

// --- 2차: 알약 안에서만 본다(알약 x 16~212, y 603~651) ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  const fill = px(img, Math.round(150 * DPR), Math.round(627 * DPR));
  const differs = (x, y) => {
    const p = px(img, Math.round(x), Math.round(y));
    return Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - fill[c]))) > 14;
  };
  console.log(`\n=== ${mode} 프로필 원 ===`);
  const y = Math.round(627 * DPR);
  let lo = null, hi = null;
  for (let x = Math.round(17 * DPR); x < Math.round(110 * DPR); x++) {
    if (differs(x, y)) { if (lo === null) lo = x; hi = x; }
  }
  console.log(`  가로(y 627): x ${css(lo)}~${css(hi + 1)} 지름 ${css(hi - lo + 1)}`);
  const xMid = Math.round(((lo + hi) / 2));
  let t = null, b = null;
  for (let yy = Math.round(600 * DPR); yy < Math.round(656 * DPR); yy++) {
    if (differs(xMid, yy)) { if (t === null) t = yy; b = yy; }
  }
  console.log(`  세로(x ${css(xMid)}): top ${css(t)} ~ ${css(b + 1)} 지름 ${css(b - t + 1)}`);
}

// --- 3차: 연속 런으로 원만 집어낸다(2차는 라벨까지 min/max 로 뭉뚱그려 틀렸다) ---
for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  const fill = px(img, Math.round(150 * DPR), Math.round(627 * DPR));
  const differs = (x, y) => {
    const p = px(img, Math.round(x), Math.round(y));
    return Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - fill[c]))) > 14;
  };
  const runs = (probe, from, to) => {
    const out = [];
    let cur = null;
    for (let v = from; v <= to; v++) {
      if (probe(v)) { if (!cur) cur = { a: v, b: v }; else cur.b = v; }
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  };
  console.log(`\n=== ${mode} 프로필 원(연속 런) ===`);
  const y = Math.round(627 * DPR);
  const hr = runs((x) => differs(x, y), Math.round(17 * DPR), Math.round(210 * DPR));
  console.log("  가로 런:", hr.map((r) => `${css(r.a)}~${css(r.b + 1)}(${css(r.b - r.a + 1)})`).join("  "));
  const first = hr[0];
  const xMid = Math.round((first.a + first.b) / 2);
  const vr = runs((yy) => differs(xMid, yy), Math.round(598 * DPR), Math.round(658 * DPR));
  console.log(`  세로 런(x ${css(xMid)}):`, vr.map((r) => `${css(r.a)}~${css(r.b + 1)}(${css(r.b - r.a + 1)})`).join("  "));
}
