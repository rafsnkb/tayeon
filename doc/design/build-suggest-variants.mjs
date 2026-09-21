// 추천 질문 칩이 "누를 수 있는 것"으로 읽히게 만드는 후보 비교.
//   node doc/design/build-suggest-variants.mjs  →  doc/design/suggest-variants.html
//
// 문제: 지금 칩은 말풍선과 같은 둥근 모양에 비슷한 채도라, 읽는 것인지 누르는 것인지 구분이
// 안 된다. 바로 위에 진짜 말풍선이 있어서 더 그렇다.
//
// 어포던스를 만드는 수단은 몇 가지뿐이다 — 모양, 색, 아이콘, 위치. 아래는 그 조합이다.
// 앞서 "테두리만 있는 버튼은 쓰지 않는다"고 정했으므로(2026-09-22), 테두리에만 기대는 안은
// 뺐다. 대비 수치도 같이 낸다.

import { writeFileSync } from "node:fs";
import { contrast } from "./build-point-ramp.mjs";

const T = {
  light: {
    label: "라이트",
    page: "#fff7f4",
    surface: "#ffffff",
    surfaceAlt: "#fff1ec",
    line: "#f3ddd5",
    text: "#2a1320",
    muted: "#7a5c60",
    chip: "#f6e4de",
    grad: "linear-gradient(30deg in oklab, #c2005f, #d23c21)",
    gradFrom: "#c2005f",
    onGrad: "#ffffff",
    link: "#ac0053",
    tint: "#ffe9e3",
  },
  dark: {
    label: "다크",
    page: "#08070a",
    surface: "#120e13",
    surfaceAlt: "#1a141a",
    line: "#271f27",
    text: "#d0c2c7",
    muted: "#a89298",
    chip: "#211a20",
    grad: "linear-gradient(30deg in oklab, #ff8a6b, #ff5993)",
    gradFrom: "#ff8a6b",
    onGrad: "#08070a",
    link: "#f08d78",
    tint: "#2b1119",
  },
};

// 각 후보: 무엇으로 "누를 수 있음"을 알리는가 / 대비를 어디서 재는가
const VARIANTS = [
  {
    id: "now",
    name: "지금",
    how: "면 + 얇은 테두리. 말풍선과 모양이 같아 구분이 안 된다.",
    fg: (t) => t.link,
    bg: (t) => t.surfaceAlt,
  },
  {
    id: "tint",
    name: "A · 브랜드 틴트 면",
    how: "브랜드 색을 옅게 깐 면. 말풍선(중성 면)과 색으로 갈린다.",
    fg: (t) => t.link,
    bg: (t) => t.tint,
  },
  {
    id: "arrow",
    name: "B · 틴트 + 화살표",
    how: "A에 방향 아이콘을 더한다. 아이콘은 “여기서 뭔가 일어난다”를 모양으로 말한다.",
    fg: (t) => t.link,
    bg: (t) => t.tint,
    icon: "→",
  },
  {
    id: "filled",
    name: "C · 액센트 면",
    how: "브랜드 면을 그대로 쓴다. 가장 확실하지만 내 말풍선과 같은 칠이라 헷갈릴 수 있다.",
    fg: (t) => t.onGrad,
    bgGrad: true,
  },
  {
    id: "label",
    name: "D · 라벨 + 화살표",
    how: "위에 “이어서 물어보기” 라벨을 달아 묶음 자체를 컨트롤로 선언한다.",
    fg: (t) => t.link,
    bg: (t) => t.tint,
    icon: "→",
    label: "이어서 물어보기",
  },
];

const fmt = (n) => n.toFixed(2);

function block(key) {
  const t = T[key];
  const cards = VARIANTS.map((v) => {
    const fg = v.fg(t);
    const bg = v.bgGrad ? t.gradFrom : v.bg(t);
    const ratio = contrast(bg, fg);
    const sep = contrast(bg, t.surface);
    return `
      <div class="variant">
        <h4>${v.name}</h4>
        <p class="how">${v.how}</p>
        <div class="stage">
          <div class="bubble">버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</div>
          ${v.label ? `<p class="grouplabel">${v.label}</p>` : ""}
          <div class="chips">
            <button class="chip ${v.bgGrad ? "grad" : ""}" style="${v.bgGrad ? "" : `background:${bg};`}color:${fg}">
              ${v.icon ? `<span class="ico">${v.icon}</span>` : ""}지금 준비해야 할 건 뭘까?
            </button>
            <button class="chip ${v.bgGrad ? "grad" : ""}" style="${v.bgGrad ? "" : `background:${bg};`}color:${fg}">
              ${v.icon ? `<span class="ico">${v.icon}</span>` : ""}올해 안에 결정해도 될까?
            </button>
          </div>
        </div>
        <dl class="facts">
          <div><dt>칩 위 글자</dt><dd class="${ratio >= 4.5 ? "pass" : "fail"}">${fmt(ratio)}</dd></div>
          <div><dt>칩이 말풍선과 갈리는 정도<small>같으면 1.00</small></dt><dd class="note">${fmt(sep)}</dd></div>
        </dl>
      </div>`;
  }).join("");

  return `
  <section class="theme" style="--page:${t.page}; --surface:${t.surface}; --line:${t.line};
      --text:${t.text}; --muted:${t.muted}; --grad:${t.grad}; --on-grad:${t.onGrad};">
    <h3>${t.label}</h3>
    <div class="variants">${cards}</div>
  </section>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 추천 질문 칩 어포던스 후보</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#0f0d11; color:#ece2e5;
    font:400 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1400px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 6px; }
  .lede { margin:0 0 26px; color:#a99aa0; max-width:78ch; }

  .theme { margin-bottom:28px; }
  .theme h3 { font-size:13px; color:#a99aa0; margin:0 0 10px; font-weight:600; }
  .variants { display:grid; gap:14px; grid-template-columns:repeat(auto-fit, minmax(250px,1fr)); }
  .variant { background:#181419; border:1px solid #2a2229; border-radius:14px; padding:12px; }
  .variant h4 { font-size:12.5px; margin:0 0 4px; }
  .how { font-size:11.5px; color:#a99aa0; margin:0 0 10px; min-height:48px; }

  .stage { background:var(--page); border-radius:14px; padding:12px; }
  .bubble { background:var(--surface); border:1px solid var(--line); border-radius:18px;
    padding:10px 12px; font-size:12px; line-height:1.55; color:var(--text); margin-bottom:10px; }
  .grouplabel { margin:0 0 6px; font-size:10.5px; color:var(--muted); }
  .chips { display:flex; flex-direction:column; gap:6px; }
  .chip { display:flex; align-items:center; gap:7px; text-align:left; font:inherit;
    font-size:12px; font-weight:600; cursor:pointer; border:0; border-radius:999px;
    padding:8px 14px; transition:transform 260ms ease, filter 260ms ease; }
  .chip.grad { background:var(--grad); }
  .chip:hover { transform:translateX(3px); filter:brightness(1.06); }
  .ico { font-size:11px; opacity:.9; }

  .facts { margin:10px 0 0; display:grid; gap:4px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:10px;
    border-top:1px solid #2a2229; padding-top:4px; }
  .facts dt { font-size:11px; color:#a99aa0; }
  .facts dt small { display:block; opacity:.75; font-size:10px; }
  .facts dd { margin:0; font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums;
    border-radius:999px; padding:1px 7px; }
  .facts dd.pass { background:#1e4023; color:#b9f0c0; }
  .facts dd.fail { background:#4a1f1c; color:#ffc9c4; }
  .facts dd.note { background:rgba(150,130,135,.2); color:#ece2e5; }

  footer { margin-top:26px; color:#a99aa0; font-size:12px; max-width:78ch; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>추천 질문 칩 — 누를 수 있어 보이게</h1>
  <p class="lede">
    지금 칩은 바로 위 말풍선과 모양도 채도도 비슷해서 읽는 것인지 누르는 것인지 헷갈린다.
    어포던스를 만드는 수단은 <b>모양 · 색 · 아이콘 · 묶음 라벨</b>뿐이고, 아래가 그 조합이다.
    테두리에만 기대는 안은 뺐다 — 테두리 버튼은 쓰지 않기로 했다.
  </p>
  ${block("light")}
  ${block("dark")}
  <footer>
    “칩이 말풍선과 갈리는 정도”는 칩 면과 말풍선 면의 대비다. 접근성 기준이 아니라
    <b>같아 보이는지 아닌지</b>를 재는 값이라 판정을 붙이지 않았다 — 1.00이면 완전히 같은 색이다.
    <br><br>
    생성: <code>node doc/design/build-suggest-variants.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/suggest-variants.html", html);
console.log("wrote doc/design/suggest-variants.html");
for (const key of Object.keys(T)) {
  const t = T[key];
  for (const v of VARIANTS) {
    const bg = v.bgGrad ? t.gradFrom : v.bg(t);
    console.log(
      `${t.label} ${v.name.padEnd(18)} 글자 ${fmt(contrast(bg, v.fg(t)))}  말풍선과 갈림 ${fmt(contrast(bg, t.surface))}`,
    );
  }
}
