// uupm.cc/demo/telemedicine 스타일을 지금 레이아웃에 얹어 본 시안.
//   node doc/design/build-telemedicine-mockup.mjs  →  doc/design/telemedicine-mockup.html
//
// 미니멀리즘 때처럼 styles.csv를 보고 짐작하지 않았다. 데모를 브라우저로 열어
// getComputedStyle로 실측했다. 아래는 옮겨 적은 게 아니라 뽑아낸 값이다.
//
//   폰트      DM Sans · 본문 16px/400 · h1 60px/700 · 버튼 14px/600
//   면        페이지 #ffffff · 띠 #eef4ff · 보조 #f8fafc · 선 #e2e8f0
//   글자      #1e293b · 보조 #64748b
//   브랜드    #4f8cff (+밝은 짝 #6ba3ff) · 보조 악센트 #00c9a7
//   카드      radius 20px · 1px 선 · box-shadow 없음 · padding 28px
//   버튼      radius 14px · 48h · padding 14/28 · 14px/600
//             background linear-gradient(135deg, #4f8cff, #6ba3ff)
//             box-shadow 0 4px 14px rgba(79,140,255,.3)      ← 이 스타일의 서명
//   칩/태그   radius 50px~pill · 8/16 · 브랜드 10% 면
//   제목 강조 linear-gradient(135deg, #4f8cff, #00c9a7) + background-clip:text
//   섹션      96px 상하 여백, 흰 띠와 #eef4ff 띠가 번갈아
//
// 옮길 때 알아낸 것 하나. 이 데모의 중성색은 중성이 아니다 —
//
//   #eef4ff H -97.2   #f8fafc H -112.1   #e2e8f0 H -104.5
//   #1e293b H -100.0  #64748b H -102.6   브랜드 #4f8cff H -98.3
//
// 면·선·글자가 전부 브랜드 색조(-100° 언저리)에 채도만 낮춘 값이다. 회색이 하나도 없다.
// 그래서 포팅 규칙은 하나로 끝난다: OKLab의 L과 C는 그대로 두고 H만 우리 쪽으로 돌린다.
// 우리 그라데이션이 2.8°(자홍)에서 32.5°(코랄)까지니, 중성은 그 사이 20°에 둔다.
//
// 두 가지는 그대로 옮길 수 없어서 바꿨고, 그 사실을 화면에도 적어 둔다.
//
//   1. 데모의 필터 칩은 흰 면 + 1px 선 = 테두리 버튼이다. 우리는 안 쓰기로 했다(2026-09-22).
//      면으로 바꿨다.
//   2. 데모에 다크 모드가 없다. 다크는 실측이 아니라 유추다. 특히 컬러 그림자는 흰 바탕에서만
//      글로우로 읽힌다 — 어두운 바탕에서는 같은 값이 거의 안 보여서 알파를 올렸다.

import { writeFileSync } from "node:fs";
import { contrast, toOklch, oklch, rgbToHex } from "./build-point-ramp.mjs";

// 실측값. 화면의 대조표에도 그대로 쓴다.
const SRC = {
  page: "#ffffff",
  band: "#eef4ff",
  alt: "#f8fafc",
  line: "#e2e8f0",
  text: "#1e293b",
  muted: "#64748b",
  brand: "#4f8cff",
  brandLite: "#6ba3ff",
  accent: "#00c9a7",
};

// 포팅 규칙: L·C 유지, H만 이동.
//
// 처음엔 "채도가 0에 가까우면 돌려도 티가 안 난다"며 C < 0.004를 건너뛰었다. 그게 틀렸다 —
// #f8fafc의 C가 0.003이라 임계값에 딱 걸렸고, 그 값은 상단바·말풍선·컴포저·푸터에 다 쓰이는
// 화면에서 가장 넓은 면이다. 나머지가 전부 H 20°로 도는 동안 그 면만 H -112°(푸른빛)에
// 남았다. 따뜻한 페이지 위에 차가운 카드가 얹힌 꼴이라, 다른 재질이 떠 있는 것처럼 보인다.
// 순백·순흑만 건너뛴다.
const HUE = 20;
// 반투명 면의 대비는 rgba 값이 아니라 뒤에 깔린 색과 합성한 결과로 재야 한다.
const over = (fg, alpha, bg) => {
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = hex(fg).map((v, i) => Math.round(v * alpha + hex(bg)[i] * (1 - alpha)));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
};
const rehue = (hex, h = HUE) => {
  const { L, C } = toOklch(hex);
  return C < 0.0005 ? hex : rgbToHex(oklch(L, C, h));
};

const L = {
  label: "라이트",
  page: rehue(SRC.page),
  band: rehue(SRC.band),
  alt: rehue(SRC.alt),
  line: rehue(SRC.line),
  text: rehue(SRC.text),
  muted: rehue(SRC.muted),
  // 브랜드는 돌리지 않는다. 우리가 이미 고른 코랄 그라데이션이 있다.
  brand: "#c2005f",
  brandLite: "#d23c21",
  accent: "#d23c21",
  onBrand: "#ffffff",
  link: "#ac0053",
  glow: "rgba(194, 0, 95, .28)",
  // 데모는 브랜드 10%인데, 그 값이 우리 기준(OKLab 밝기차 0.06)을 못 넘는다 — 0.057.
  // 데모 자체가 0.035로 더 옅다. 라이트에서 칩이 안 보인다고 방금 고친 참이라 14%로 올렸다.
  tintAlpha: 0.14,
};

// 다크는 실측이 아니라 유추다. 데모에 다크 모드가 없다.
//
// 처음엔 손으로 골랐는데, 뽑아 보니 면이 H -16°, 글자가 H -1°였다. 라이트는 H 20°다.
// 한 제품 안에서 두 테마의 색온도가 갈렸다는 뜻이다. 대비는 다 통과했으니 수치로는 안 잡힌다.
// L·C 사다리는 그대로 두고 색조만 라이트와 같은 20°로 맞춘다.
const DARK_LADDER = {
  page: [0.175, 0.014],
  band: [0.205, 0.017],
  alt: [0.233, 0.019],
  line: [0.281, 0.026],
  text: [0.898, 0.017],
  muted: [0.713, 0.03],
};

const D = {
  label: "다크 (유추)",
  ...Object.fromEntries(
    Object.entries(DARK_LADDER).map(([k, [l, c]]) => [k, rgbToHex(oklch(l, c, HUE))]),
  ),
  brand: "#ff5993",
  brandLite: "#ff8a6b",
  accent: "#ff8a6b",
  onBrand: "#2a0715",
  link: "#ff9b8a",
  glow: "rgba(255, 89, 147, .38)", // 어두운 바탕에서 .28은 안 보인다. 올렸다.
  tintAlpha: 0.14,
};

// 칩 면은 합성한 단색으로 굳혀서 쓴다. 데모는 rgba로 깔지만, 반투명 면은 그 자체가
// 글래스의 신호다 — 뒤가 비치는 재질로 읽힌다. 결과 색은 같고 재질감만 사라진다.
for (const t of [L, D]) t.tint = over(t.brand, t.tintAlpha, t.page);

const T = { light: L, dark: D };

const fmt = (n) => n.toFixed(2);
const chipStep = (t) => Math.abs(toOklch(t.tint).L - toOklch(t.page).L);

// 무엇을 그대로 가져왔고 무엇을 바꿨는지. 짐작과 실측을 섞지 않으려고 출처를 붙인다.
const MAP = [
  { what: "카드 모서리", src: "20px", ours: "20px", note: "그대로" },
  { what: "카드 그림자", src: "없음 · 1px 선으로만 구분", ours: "동일", note: "그대로 — 지금 우리도 선을 쓴다" },
  { what: "버튼 모서리", src: "14px", ours: "14px", note: "<b>바뀜</b> · 지금은 999px 알약" },
  { what: "버튼 그라데이션", src: "135deg 브랜드 → 밝은 짝", ours: "135deg #c2005f → #d23c21", note: "각도만 30deg→135deg" },
  { what: "버튼 그림자", src: "0 4px 14px rgba(브랜드,.3)", ours: "동일 (다크는 .38)", note: "<b>이 스타일의 서명</b>" },
  { what: "칩", src: "pill · 브랜드 10% 면 <small>(밝기차 0.035)</small>", ours: "pill · 브랜드 14% 면", note: "<b>올림</b> · 10%는 0.057로 기준 미달" },
  { what: "필터 칩", src: "흰 면 + 1px 선", ours: "면만", note: "<b>못 옮김</b> — 테두리 버튼 금지" },
  { what: "중성색", src: "전부 브랜드 색조 H≈-100°", ours: "L·C 유지, H→20°", note: "회색이 하나도 없다" },
  { what: "제목 강조", src: "135deg 2색 clip:text", ours: "동일", note: "그대로" },
  { what: "본문 크기", src: "16px / 보조 20px", ours: "14.5px 유지", note: "“요소가 크다” 지적이 우선" },
  { what: "폰트", src: "DM Sans", ours: "Pretendard 유지", note: "DM Sans에 한글이 없다" },
  { what: "컬러 그림자 범위", src: "<b>컨트롤에만</b>", ours: "동일", note: "<b>고침</b> · 말풍선에도 줬었다" },
  { what: "칩 면", src: "rgba(브랜드,.1)", ours: "합성한 단색", note: "<b>고침</b> · 반투명은 글래스 신호" },
  { what: "다크 모드", src: "<b>없음</b>", ours: "유추 · 라이트와 같은 20°", note: "실측 아님" },
];

function frame(key) {
  const t = T[key];
  const style = `
      --page:${t.page}; --band:${t.band}; --alt:${t.alt}; --line:${t.line};
      --text:${t.text}; --muted:${t.muted}; --brand:${t.brand}; --brand-lite:${t.brandLite};
      --accent:${t.accent}; --on-brand:${t.onBrand}; --link:${t.link};
      --glow:${t.glow}; --tint:${t.tint};`;

  return `
  <figure class="frame">
    <figcaption>${t.label}</figcaption>
    <div class="screen" style="${style}">
      <div class="col">
        <header class="topbar">
          <button class="bar-btn"><span class="ic">☰</span>메뉴</button>
          <b class="title">이직 고민 상담</b>
          <button class="bar-btn"><span class="ic">◷</span>시간제</button>
          <button class="bar-btn"><span class="ic">⋯</span>더보기</button>
        </header>

        <!-- 데모의 "흰 띠 / 연한 브랜드 띠 번갈아" 구조를 세로로 축소해 옮겼다. -->
        <div class="status">
          <p class="status-text">스탠다드 이용권 · <b>14회</b> 남았어요</p>
          <button class="btn sm">구입</button>
        </div>

        <div class="stream">
          <div class="msg in" style="--d:0ms">
            <p class="who">루미</p>
            <p class="body">안녕하세요. 어떤 고민이든 편하게 말씀해 주세요.</p>
          </div>
          <div class="msg me in" style="--d:90ms">
            <p class="body">올해 이직해도 괜찮을까?</p>
          </div>
          <div class="msg in" style="--d:180ms">
            <p class="who">루미 · 원 카드</p>
            <!-- 데모의 제목 강조: 두 브랜드 색 135deg 그라데이션을 글자에 clip -->
            <h4 class="card-name"><span class="grad-text">완드 7</span></h4>
            <p class="body">지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
              버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</p>
          </div>
          <div class="suggest in" style="--d:270ms">
            <p class="suggest-label">이어서 물어보기</p>
            <button><span class="ico">→</span>지금 준비해야 할 건 뭘까?</button>
            <button><span class="ico">→</span>올해 안에 결정해도 될까?</button>
          </div>
        </div>

        <div class="composer">
          <div class="composer-card">
            <div class="field">이직 시기를 알고 싶어요</div>
            <div class="actions">
              <button class="spread">원 카드&nbsp;<span class="caret">▼</span></button>
              <button class="btn send">보내기 <span class="ic">→</span></button>
            </div>
          </div>
          <a class="helper">궁합도 보려면&nbsp;<u>상대 정보 입력</u></a>
        </div>
        <p class="footnote"><a>회사 정보 · 이용약관</a></p>
      </div>
    </div>

    <dl class="facts">
      <div><dt>본문 대비<small>카드 면 위</small></dt><dd class="${contrast(t.alt, t.text) >= 4.5 ? "pass" : "fail"}">${fmt(contrast(t.alt, t.text))}</dd></div>
      <div><dt>보조 글자 대비</dt><dd class="${contrast(t.alt, t.muted) >= 4.5 ? "pass" : "fail"}">${fmt(contrast(t.alt, t.muted))}</dd></div>
      <div><dt>버튼 글자 대비<small>그라데이션 양 끝 중 불리한 쪽</small></dt><dd class="${Math.min(contrast(t.brand, t.onBrand), contrast(t.brandLite, t.onBrand)) >= 4.5 ? "pass" : "fail"}">${fmt(Math.min(contrast(t.brand, t.onBrand), contrast(t.brandLite, t.onBrand)))}</dd></div>
      <div><dt>버튼이 배경에서 떠 보이는 정도<small>비텍스트 3:1 — 컨트롤이라 판정 대상</small></dt><dd class="${contrast(t.brand, t.page) >= 3 ? "pass" : "fail"}">${fmt(contrast(t.brand, t.page))}</dd></div>
      <div><dt>추천 질문 칩이 배경에서 떠 보이는 정도<small>OKLab 밝기차 · 0.06 기준</small></dt><dd class="${chipStep(t) >= 0.06 ? "pass" : "fail"}">${chipStep(t).toFixed(3)}</dd></div>
    </dl>
  </figure>`;
}

const mapRows = MAP.map(
  (m) => `<tr><td><b>${m.what}</b></td><td class="src">${m.src}</td><td>${m.ours}</td><td class="why">${m.note}</td></tr>`,
).join("");

// 브랜드 3색은 돌리지 않는다 — 우리가 이미 고른 코랄이 있다. 표에서도 갈라 놓는다.
const BRAND_KEYS = new Set(["brand", "brandLite", "accent"]);
const swatch = (k, v, to) =>
  `<div class="sw"><span style="background:${v}"></span><code>${v}</code><small>${k}</small>
     <span class="arr">→</span><span style="background:${to}"></span><b>${to}</b></div>`;
const srcSwatches = Object.entries(SRC)
  .filter(([k]) => !BRAND_KEYS.has(k))
  .map(([k, v]) => swatch(k, v, rehue(v)))
  .join("");
const brandSwatches = [
  ["brand", SRC.brand, L.brand],
  ["brandLite", SRC.brandLite, L.brandLite],
  ["accent", SRC.accent, L.accent],
]
  .map(([k, v, to]) => swatch(k, v, to))
  .join("");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — telemedicine 스타일 적용</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#100c0f; color:#efe4e6;
    font:400 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1320px; margin:0 auto; }
  h1 { font-size:23px; margin:0 0 6px; }
  h2 { font-size:14px; margin:26px 0 8px; color:#ab999e; }
  .lede { margin:0 0 20px; color:#ab999e; max-width:82ch; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  table { width:100%; border-collapse:collapse; margin:0 0 8px; font-size:12.5px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #2a2126; vertical-align:top; }
  th { color:#ab999e; font-weight:600; font-size:11.5px; }
  td.src { color:#9fb6e8; font-family:ui-monospace, Menlo, monospace; font-size:11.5px; }
  td.why { color:#ab999e; }

  .swatches { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 26px; }
  .sw { display:flex; align-items:center; gap:7px; background:#181318; border:1px solid #2a2126;
    border-radius:10px; padding:6px 10px; font-size:11px; }
  .sw span { width:18px; height:18px; border-radius:5px; border:1px solid rgba(255,255,255,.14); }
  .sw small { color:#ab999e; }
  .sw b { color:#ffb9a6; font-family:ui-monospace, Menlo, monospace; }
  .sw .arr { color:#6e5f63; }

  .frames { display:flex; gap:22px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#ab999e; margin-bottom:8px; }

  .screen { position:relative; width:390px; height:720px; overflow:hidden;
    background:var(--page); display:flex; border-radius:26px; box-shadow:0 16px 46px rgba(0,0,0,.5); }
  .col { position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }

  /* 데모의 카드: radius 20 · 1px 선 · 그림자 없음 */
  .topbar { display:flex; align-items:center; gap:2px; padding:6px 8px;
    background:var(--alt); border-bottom:1px solid var(--line); }
  .bar-btn { display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:1px; min-width:44px; height:40px; border:0; border-radius:12px; cursor:pointer;
    background:transparent; color:var(--muted); font:inherit; font-size:10px; font-weight:500;
    transition:background 260ms ease, color 260ms ease; }
  .bar-btn:hover { background:var(--tint); color:var(--brand); }
  .bar-btn .ic { font-size:14px; line-height:1; }
  .title { flex:1; text-align:center; font-size:15px; font-weight:700; color:var(--text);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 2px; }

  /* 데모의 연한 브랜드 띠(#eef4ff)에 해당 */
  .status { display:flex; align-items:center; justify-content:space-between; gap:10px;
    min-height:40px; padding:0 12px; background:var(--band); border-bottom:1px solid var(--line); }
  .status-text { margin:0; font-size:13px; color:var(--muted); }
  .status-text b { color:var(--text); font-weight:700; }

  .stream { flex:1; overflow:hidden; padding:14px 12px 8px; background:var(--page);
    display:flex; flex-direction:column; gap:12px; }
  .msg { max-width:88%; }
  .msg.me { align-self:flex-end; max-width:82%; }
  .who { margin:0 0 4px; font-size:11.5px; color:var(--muted); }
  .body { margin:0; font-size:14.5px; line-height:1.6; color:var(--text);
    background:var(--alt); border:1px solid var(--line); border-radius:20px; padding:12px 15px; }
  /* 내 말풍선 = 데모의 주 버튼과 같은 칠. 단 그림자는 안 준다 — 데모는 컬러 그림자를
     컨트롤에만 쓴다. 내용 면에까지 붙였더니 말풍선이 빛을 내며 떠 있는 꼴이 됐다. */
  .msg.me .body { background:linear-gradient(135deg, var(--brand) 0%, var(--brand-lite) 100%);
    color:var(--on-brand); border:0; font-weight:600; }
  .card-name { margin:0 0 6px; font-size:20px; font-weight:700; }
  .grad-text { background:linear-gradient(135deg, var(--brand) 0%, var(--accent) 100%);
    -webkit-background-clip:text; background-clip:text; color:transparent; }

  .suggest { display:flex; flex-direction:column; gap:7px; }
  .suggest-label { margin:0 0 0 2px; font-size:11.5px; color:var(--muted); }
  .suggest button { display:flex; align-items:center; gap:7px; text-align:left; font:inherit;
    font-size:13px; font-weight:500; cursor:pointer; border:0; background:var(--tint);
    color:var(--link); border-radius:999px; padding:0 16px; min-height:36px;
    transition:transform 260ms ease, background 260ms ease; }
  .suggest button:hover { transform:translateX(3px); }
  .suggest .ico { font-size:12px; }

  .composer { padding:10px 12px 2px; background:var(--alt); border-top:1px solid var(--line); }
  .composer-card { border:1px solid var(--line); border-radius:20px; background:var(--page);
    padding:10px 10px 10px 15px; }
  .field { min-height:34px; font-size:14.5px; color:var(--text); padding:4px 0 8px; }
  .actions { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .spread { display:flex; align-items:center; min-height:36px; border:0; border-radius:999px;
    cursor:pointer; background:var(--tint); color:var(--link); padding:0 16px;
    font:inherit; font-size:13px; font-weight:500; transition:filter 260ms ease; }
  .caret { font-size:10px; opacity:.8; }

  /* 데모의 주 버튼을 그대로: radius 14 · 135deg 그라데이션 · 컬러 그림자 · 14px/600 */
  .btn { border:0; border-radius:14px; cursor:pointer; font:inherit; font-weight:600;
    background:linear-gradient(135deg, var(--brand) 0%, var(--brand-lite) 100%);
    color:var(--on-brand); box-shadow:0 4px 14px var(--glow);
    transition:transform 260ms ease, box-shadow 260ms ease; }
  .btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px var(--glow); }
  .btn.send { min-height:36px; padding:0 18px; font-size:14px; display:flex;
    align-items:center; gap:6px; }
  .btn.sm { min-height:30px; padding:0 16px; font-size:12.5px; white-space:nowrap; }

  .helper { display:flex; align-items:center; min-height:34px; font-size:13px; color:var(--muted); }
  .helper u { color:var(--link); }
  .footnote { margin:0; display:flex; align-items:center; justify-content:center;
    min-height:32px; background:var(--alt); border-top:1px solid var(--line); }
  .footnote a { font-size:12px; color:var(--muted); text-decoration:underline; }

  @media (prefers-reduced-motion: reduce) { .in { animation:none !important; } * { transition-duration:1ms !important; } }
  .in { animation:rise 420ms cubic-bezier(.22,.9,.3,1) both; animation-delay:var(--d,0ms); }
  @keyframes rise { from{opacity:0;transform:translate3d(0,10px,0)} to{opacity:1;transform:none} }

  .facts { margin:12px 0 0; display:grid; gap:5px; width:390px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #2a2126; padding-top:5px; }
  .facts dt { font-size:12px; color:#ab999e; }
  .facts dt small { display:block; opacity:.8; font-size:11px; }
  .facts dd { margin:0; font-size:12px; font-weight:700; border-radius:999px; padding:2px 8px;
    font-variant-numeric:tabular-nums; }
  .facts dd.pass { background:#1e4023; color:#b9f0c0; }
  .facts dd.fail { background:#4a1f1c; color:#ffc9c4; }

  footer { margin-top:28px; color:#ab999e; font-size:12px; max-width:82ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>telemedicine 스타일 적용 — 지금 레이아웃 위에</h1>
  <p class="lede">
    <code>uupm.cc/demo/telemedicine</code>을 브라우저로 열어 <code>getComputedStyle</code>로 실측한
    값을 옮겼다. 레이아웃과 크기는 <b>건드리지 않았다</b> — 바뀐 건 모양·색·그림자뿐이다.
    이 스타일의 서명은 <b>주 버튼의 컬러 그림자</b>와 <b>14px 모서리</b>다. 지금 우리 버튼은 알약이라
    거기가 제일 크게 달라 보인다.
  </p>

  <h2>중성색이 중성이 아니다 — 실측 → 우리 색조(20°)로 이동</h2>
  <div class="swatches">${srcSwatches}</div>
  <h2>브랜드 3색은 돌리지 않았다 — 우리가 고른 코랄을 그대로 쓴다</h2>
  <div class="swatches">${brandSwatches}</div>

  <h2>무엇을 가져왔고 무엇을 바꿨나</h2>
  <table>
    <thead><tr><th>요소</th><th>데모 실측</th><th>적용</th><th>비고</th></tr></thead>
    <tbody>${mapRows}</tbody>
  </table>

  <h2>시안</h2>
  <div class="frames">
    ${frame("light")}
    ${frame("dark")}
  </div>

  <footer>
    다크는 <b>실측이 아니라 유추</b>다. 데모에 다크 모드가 없다. 특히 컬러 그림자
    <code>0 4px 14px rgba(브랜드,.3)</code>는 흰 바탕에서만 글로우로 읽히고 어두운 바탕에서는
    거의 안 보여서 알파를 .38로 올렸다 — 이건 데모에 근거가 없는 내 판단이다.
    <br><br>
    데모의 필터 칩은 <b>흰 면 + 1px 선</b>, 즉 테두리 버튼이다. 쓰지 않기로 했으므로 면으로 바꿨다.
    그래서 “칩이 여러 개 나란히 놓인 줄”의 인상은 데모와 다르게 나온다.
    <br><br>
    칩의 브랜드 틴트는 데모가 10%인데, 그대로 쓰면 밝기차 0.057로 우리 기준 0.06에 미달한다.
    데모 자체는 0.035로 더 옅다 — 라이트에서 칩이 안 보이던 문제를 방금 고친 참이라 14%로 올렸다.
    공교롭게 그 값이 0.082, 직전에 고른 값과 같다. 다만 <b>rgba로 깔지 않고 합성한 단색으로
    굳혔다</b> — 색은 같지만 반투명 면은 뒤가 비치는 재질로 읽혀서 글래스 인상을 남긴다.
    <br><br>
    <b>첫 판에서 잘못했던 것 세 가지.</b> 색조 이동에 <code>C &lt; 0.004</code> 임계값을 뒀는데
    <code>#f8fafc</code>(C 0.003)가 거기 걸려, 상단바·말풍선·컴포저·푸터에 다 쓰이는 가장 넓은 면만
    푸른빛 H -112°로 남았다. 다크는 손으로 골랐더니 면 H -16° / 글자 H -1°로 라이트(20°)와
    색온도가 갈렸다. 그리고 컬러 그림자를 내 말풍선에까지 줘서 내용 면이 빛을 내며 떠 있었다.
    셋 다 대비 수치로는 안 잡힌다 — 전부 통과한 상태였다.
    <br><br>
    생성: <code>node doc/design/build-telemedicine-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/telemedicine-mockup.html", html);
console.log("wrote doc/design/telemedicine-mockup.html");
for (const key of Object.keys(T)) {
  const t = T[key];
  console.log(
    `${t.label.padEnd(10)} 본문 ${fmt(contrast(t.alt, t.text))}  보조 ${fmt(contrast(t.alt, t.muted))}` +
      `  버튼글자 ${fmt(Math.min(contrast(t.brand, t.onBrand), contrast(t.brandLite, t.onBrand)))}` +
      `  버튼분리 ${fmt(contrast(t.brand, t.page))}  칩밝기차 ${chipStep(t).toFixed(3)}`,
  );
}
