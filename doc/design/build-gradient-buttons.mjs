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

// 호리(hori.chat)의 핵심 색상각. 2026-09-22에 실제 사이트에서 뽑았다:
// 구체 #af7ac5(316°), 딥퍼플 워시 #633974(315°), 라일락 틴트 #f1e7fd(306°).
// 타연 핑크는 3°로 거기서 50° 떨어져 있다 — 그라데이션 끝을 보라로 보내면 그 거리를
// 스스로 좁히게 되고, 그게 "짝퉁 같다"는 인상의 정체다.
const HORI_HUE = 312;

function oklchOf(hex) {
  const [L, A, B] = rgbToOklab(hexToRgb(hex));
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(A, B), H };
}
const hueGap = (a, b) => {
  const x = Math.abs(a - b) % 360;
  return x > 180 ? 360 - x : x;
};
const horiDistance = (hex) => hueGap(oklchOf(hex).H, HORI_HUE);

// 타연 자신의 색상각. 후보가 브랜드에서 얼마나 멀어지는지도 같이 재야 한다 — 호리에서 멀다는
// 것만으로는 부족하고, 너무 멀면 그건 타연이 아니라 다른 브랜드다.
const TAYEON_HUE = oklchOf("#ff007f").H;
const tayeonDistance = (hex) => hueGap(oklchOf(hex).H, TAYEON_HUE);

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
  // 양 끝이 둘 다 호리에서 멀어도 경로가 그 사이를 지날 수 있다 — 파랑→핑크는 보라를 통과한다.
  const horiPath = Math.min(...pts.map(horiDistance));
  return {
    min,
    max: Math.max(...ratios),
    worstAt: pts[ratios.indexOf(min)],
    worstT: ratios.indexOf(min) / (pts.length - 1),
    ends: [contrast(fromHex, labelHex), contrast(toHex, labelHex)],
    horiPath,
  };
}

// 후보. 전부 30도 각도. 보라 쪽으로 가지 않고, 핑크를 기준으로 **따뜻한 쪽**이나 같은 색상
// 안에서만 움직인다. 각 후보의 "호리와의 거리"를 같이 재서, 브랜드가 가까워지는지 본다.
const CANDIDATES = [
  {
    id: "magenta-coral-light",
    theme: "light",
    name: "자홍 → 코랄 (라이트)",
    from: "#c2005f",
    to: "#e04a2f",
    label: "#ffffff",
    note: "핑크에서 따뜻한 쪽으로 넘어간다. 호리의 보라와 정반대 방향.",
  },
  {
    id: "wine-pink-light",
    theme: "light",
    name: "와인 → 핫핑크 (라이트)",
    from: "#8c0036",
    to: "#d30068",
    label: "#ffffff",
    note: "같은 마젠타 안에서 깊이만 준다. 브랜드에서 가장 덜 벗어나는 안.",
  },
  {
    id: "crimson-magenta-light",
    theme: "light",
    name: "크림슨 → 마젠타 (라이트)",
    from: "#b31235",
    to: "#cf0072",
    label: "#ffffff",
    note: "붉은 쪽에서 출발해 브랜드 핑크로 도착. 따뜻하지만 튀지 않는다.",
  },
  {
    id: "wine-pink-dark",
    theme: "dark",
    name: "코랄 → 핑크 (다크)",
    from: "#ff8a6b",
    to: "#ff5993",
    label: "#141517",
    note: "다크는 밝은 면 + 어두운 글씨. 따뜻한 쪽에서 브랜드 핑크로.",
  },
  {
    id: "navy-blue-light",
    theme: "light",
    name: "네이비 → 블루 (라이트)",
    from: "#16307a",
    to: "#1d63d1",
    label: "#ffffff",
    note: "파란 계열 단독. 신뢰감 쪽으로 가지만 타연 핑크와는 다른 브랜드가 된다.",
  },
  {
    id: "indigo-cyan-light",
    theme: "light",
    name: "인디고 → 청록 (라이트)",
    from: "#2b2f9e",
    to: "#0a7a8c",
    label: "#ffffff",
    note: "차갑고 서늘한 쪽. 타로·사주의 신비감보다 도구 느낌에 가깝다.",
  },
  {
    id: "blue-pink-light",
    theme: "light",
    name: "블루 → 핑크 (라이트)",
    from: "#1d4ed8",
    to: "#d30068",
    label: "#ffffff",
    note: "브랜드 핑크를 한쪽에 남긴 절충안. 다만 경로가 보라를 지난다 — 아래 호리 거리 확인.",
  },
  {
    id: "blue-cyan-dark",
    theme: "dark",
    name: "블루 → 청록 (다크)",
    from: "#7aa8ff",
    to: "#6fd6e0",
    label: "#141517",
    note: "다크용 파란 계열. 밝은 면 + 어두운 글씨.",
  },
  {
    id: "violet-pink-light",
    theme: "light",
    name: "보라 → 핑크 (참고: 호리 영역)",
    from: "#7b2ff7",
    to: "#d30068",
    label: "#ffffff",
    note: "대비는 통과하지만 시작점이 호리 색상각 21° 안이다. 비교용으로 남겨둔다.",
  },
];

const BG = { light: "#efe7f7", dark: "#141517" };

const rows = CANDIDATES.map((c) => {
  const a = analyse(c.from, c.to, c.label);
  const fillSeparation = Math.min(contrast(c.from, BG[c.theme]), contrast(c.to, BG[c.theme]));
  return { ...c, ...a, fillSeparation, horiFrom: horiDistance(c.from), horiTo: horiDistance(c.to),
    tayeonFrom: tayeonDistance(c.from), tayeonTo: tayeonDistance(c.to) };
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
      <div><dt>호리와 가장 가까워지는 지점<small>양 끝 ${Math.round(r.horiFrom)}° / ${Math.round(r.horiTo)}° · <b>경로 전체 최솟값</b></small></dt><dd><span class="ratio ${r.horiPath >= 40 ? "pass" : "fail"}">${Math.round(r.horiPath)}°</span></dd></div>
      <div><dt>타연 핑크에서 멀어진 정도<small>0°면 그대로 · 클수록 다른 브랜드</small></dt><dd><span class="ratio note">${Math.round(r.tayeonFrom)}° / ${Math.round(r.tayeonTo)}°</span></dd></div>
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
    <br><br>
    색상각도 같이 잰다. 호리(hori.chat)의 핵심 색상은 <b>312°</b>이고 타연 핑크는 <b>3°</b>로
    50° 떨어져 있다. 그라데이션 끝을 보라로 보내면 그 거리를 스스로 좁히게 된다 — 대비는
    통과해도 브랜드는 잃는다.
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
console.log("후보                              최솟값  배경분리  호리(경로최소)  타연거리");
for (const r of rows) {
  console.log(
    `${r.name.padEnd(30)} ${fmt(r.min).padStart(6)}  ${fmt(r.fillSeparation).padStart(6)}   ` +
      `${String(Math.round(r.horiPath)).padStart(9)}°   ` +
      `${Math.round(r.tayeonFrom)}°/${Math.round(r.tayeonTo)}°`,
  );
}
