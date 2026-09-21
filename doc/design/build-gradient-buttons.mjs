// 포인트 컬러를 단색이 아니라 그라데이션으로 쓰는 안.
//   node doc/design/build-gradient-buttons.mjs  →  doc/design/gradient-buttons.html
//
// 단색과 다른 점이 하나 있다: 대비를 평균이 아니라 **가장 불리한 지점**으로 재야 한다. 라벨이
// 그라데이션의 어느 구간 위에 놓일지 알 수 없으므로, 양 끝만 보는 것도 부족하다(OKLab 보간은
// 중간이 양 끝보다 밝아지거나 어두워질 수 있다). 여기서는 구간을 21등분해 전부 재고 최솟값을
// 판정에 쓴다.
//
// CSS도 `linear-gradient(30deg in oklab, ...)`로 보간한다. 기본 sRGB 보간은 보라→핑크처럼 색상이
// 크게 도는 구간에서 중간이 탁한 회색빛으로 주저앉는다.

import { writeFileSync } from "node:fs";

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const hexToRgb = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255);
const rgbToHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const relLum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 브라우저가 실제로 그리는 것과 같은 방식(OKLab 보간)으로 구간을 훑는다. */
function sample(fromHex, toHex, steps = 21) {
  const A = rgbToOklab(hexToRgb(fromHex));
  const B = rgbToOklab(hexToRgb(toHex));
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return rgbToHex(oklabToRgb(A.map((v, k) => v + (B[k] - v) * t)));
  });
}

function analyse(fromHex, toHex, labelHex) {
  const pts = sample(fromHex, toHex);
  const ratios = pts.map((p) => contrast(p, labelHex));
  const min = Math.min(...ratios);
  return {
    min,
    max: Math.max(...ratios),
    worstAt: pts[ratios.indexOf(min)],
    worstT: ratios.indexOf(min) / (pts.length - 1),
    ends: [contrast(fromHex, labelHex), contrast(toHex, labelHex)],
  };
}

// 후보. 전부 30도 각도, 보라 쪽에서 출발해 핑크로 온다.
const CANDIDATES = [
  {
    id: "violet-pink-light",
    theme: "light",
    name: "보라 → 핑크 (라이트)",
    from: "#7b2ff7",
    to: "#d30068",
    label: "#ffffff",
    note: "요청하신 그림 그대로. 보라 끝이 충분히 어두워야 흰 글씨가 산다.",
  },
  {
    id: "violet-pink-light-soft",
    theme: "light",
    name: "연한 보라 → 핑크 (라이트)",
    from: "#a35cff",
    to: "#ff007f",
    label: "#ffffff",
    note: "브랜드 핑크 원본을 끝에 그대로 둔 안. 밝은 쪽이 흰 글씨에 불리하다.",
  },
  {
    id: "pink-tonal-light",
    theme: "light",
    name: "핑크 톤 그라데이션 (라이트)",
    from: "#ac0053",
    to: "#d30068",
    label: "#ffffff",
    note: "색상을 돌리지 않고 같은 분홍 안에서만 밝기를 움직인 안. 가장 보수적.",
  },
  {
    id: "violet-pink-dark",
    theme: "dark",
    name: "보라 → 핑크 (다크)",
    from: "#b18cff",
    to: "#ff5993",
    label: "#141517",
    note: "다크는 밝은 면에 어두운 글씨. 단색안과 같은 원칙.",
  },
  {
    id: "violet-pink-dark-white",
    theme: "dark",
    name: "보라 → 핑크, 흰 글씨 (다크)",
    from: "#6d28d9",
    to: "#b3005c",
    label: "#ffffff",
    note: "다크에서 흰 글씨를 유지하려면 칠이 어두워지는데, 배경과 덜 분리된다.",
  },
];

const BG = { light: "#efe7f7", dark: "#141517" };

const rows = CANDIDATES.map((c) => {
  const a = analyse(c.from, c.to, c.label);
  const fillSeparation = Math.min(contrast(c.from, BG[c.theme]), contrast(c.to, BG[c.theme]));
  return { ...c, ...a, fillSeparation };
});

const fmt = (n) => n.toFixed(2);
const chipHtml = (n, floor) =>
  `<span class="ratio ${n >= floor ? "pass" : "fail"}">${fmt(n)}<i>${n >= floor ? "✓" : "✗"}</i></span>`;

const cards = rows
  .map(
    (r) => `
  <article class="cand ${r.theme}">
    <h3>${r.name}</h3>
    <p class="note">${r.note}</p>
    <div class="stage" style="--bg:${BG[r.theme]}">
      <button class="grad" style="background:linear-gradient(30deg in oklab, ${r.from}, ${r.to}); color:${r.label}">
        이용권 구입하기
      </button>
      <button class="grad sm" style="background:linear-gradient(30deg in oklab, ${r.from}, ${r.to}); color:${r.label}">
        환불 가능
      </button>
    </div>
    <div class="strip">
      ${sample(r.from, r.to, 21)
        .map((hex) => `<span style="background:${hex}" title="${hex}"></span>`)
        .join("")}
    </div>
    <dl class="facts">
      <div><dt>라벨 대비 <b>최솟값</b><small>21개 지점 중 가장 불리한 곳 <code>${r.worstAt}</code> (${Math.round(r.worstT * 100)}% 지점)</small></dt><dd>${chipHtml(r.min, 4.5)}</dd></div>
      <div><dt>양 끝만 봤을 때<small>끝만 재면 놓치는 값</small></dt><dd><span class="ratio note">${fmt(r.ends[0])} / ${fmt(r.ends[1])}</span></dd></div>
      <div><dt>칠이 배경에서 떠 보이는 정도<small>비텍스트 3:1, 불리한 끝 기준</small></dt><dd>${chipHtml(r.fillSeparation, 3)}</dd></div>
    </dl>
  </article>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 그라데이션 포인트 컬러 후보</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:32px 20px 64px; background:#15161a; color:#e8e6ee;
    font:500 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1180px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 6px; }
  .lede { margin:0 0 26px; color:#a7a3b8; max-width:74ch; }
  code { font-family: ui-monospace, Menlo, monospace; font-size:12px; }

  .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fit, minmax(340px,1fr)); }
  .cand { background:#1d1e24; border:1px solid #2c2d35; border-radius:16px; padding:16px; }
  .cand h3 { font-size:14px; margin:0 0 4px; }
  .note { margin:0 0 12px; font-size:12px; color:#a7a3b8; }

  .stage { background:var(--bg); border-radius:12px; padding:18px; display:flex;
    align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
  .grad { font:inherit; font-weight:700; border:0; border-radius:999px; padding:12px 20px; cursor:pointer; }
  .grad.sm { font-size:12px; padding:5px 12px; }

  /* 21개 표본을 그대로 늘어놓는다 — 부드럽게 보이는 띠가 실제로 어디서 어두워지는지 눈으로 확인. */
  .strip { display:flex; height:16px; border-radius:6px; overflow:hidden; margin-bottom:12px; }
  .strip span { flex:1; }

  .facts { margin:0; display:grid; gap:6px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #2c2d35; padding-top:6px; }
  .facts dt { font-size:12px; color:#a7a3b8; }
  .facts dt b { color:#e8e6ee; }
  .facts dt small { display:block; opacity:.75; font-size:11px; }
  .facts dd { margin:0; }
  .ratio { font-variant-numeric:tabular-nums; font-weight:700; font-size:12px;
    border-radius:999px; padding:2px 8px; white-space:nowrap; }
  .ratio i { font-style:normal; margin-left:4px; }
  .ratio.pass { background:#1e4023; color:#b9f0c0; }
  .ratio.fail { background:#4a1f1c; color:#ffc9c4; }
  .ratio.note { background:rgba(127,127,127,.2); color:#e8e6ee; }

  footer { margin-top:28px; color:#a7a3b8; font-size:12px; max-width:74ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>그라데이션 포인트 컬러 후보</h1>
  <p class="lede">
    전부 <code>linear-gradient(30deg in oklab, …)</code>. 기본 sRGB 보간은 보라→핑크처럼 색상이
    크게 도는 구간에서 중간이 탁해지므로 OKLab으로 보간한다. 판정에 쓰는 대비는
    <b>양 끝이 아니라 21개 지점 중 최솟값</b>이다 — 라벨이 어느 구간 위에 놓일지 알 수 없고,
    보간 중간이 양 끝보다 불리해질 수 있다.
  </p>
  <div class="grid">${cards}</div>
  <footer>
    띠 아래 “양 끝만 봤을 때” 값과 최솟값을 나란히 둔 이유는, 끝점 두 개만 재고 통과라고
    적어두는 실수가 흔해서다. 차이가 크지 않은 후보도 있지만 차이가 판정을 뒤집는 후보도 있다.
    <br><br>
    생성: <code>node doc/design/build-gradient-buttons.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/gradient-buttons.html", html);
console.log("wrote doc/design/gradient-buttons.html\n");
console.log("후보                              최솟값   양끝            배경분리");
for (const r of rows) {
  console.log(
    `${r.name.padEnd(30)} ${fmt(r.min).padStart(6)}  ` +
      `${fmt(r.ends[0])}/${fmt(r.ends[1])}`.padEnd(14) +
      ` ${fmt(r.fillSeparation)}`,
  );
}
