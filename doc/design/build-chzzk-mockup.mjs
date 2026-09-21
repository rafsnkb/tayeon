// 치지직 디자인 + 타연 핑크(#ff007f), 메인화면은 Claude 앱 레이아웃 참조.
//   node doc/design/build-chzzk-mockup.mjs  →  doc/design/chzzk-mockup.html
//
// 치지직은 디자인 토큰을 :root에 그대로 내놓는다 — 1,908개. 짐작할 게 없어서 semantic
// 레이어(--sem-color-*)를 라이트/다크 양쪽 다 뽑아 왔다. 아래는 전부 실측이다.
//
//   폰트     Pretendard Variable          ← 우리가 쓰는 것과 같다
//   모서리   4 · 6 · 8px가 압도적, 12/16/20/24, 원형 9999
//   그림자   없음. 페이지 전체에서 1px 헤어라인 하나뿐이다.
//   그라데이션 UI에 없음(배너 이미지에만)
//
//   면(다크)   #0e0f10 → #141517 → #1c1d1f → #202224 → #2a2c2f → #2e3033 → #4d4d4d
//   면(라이트) #ffffff → #f0f1f2 → #e8e9eb → #e1e1e5 → #d0d1d3 → #c0c1c2
//   테두리     알파로만 — #ffffff0d / 1a / 26 / 4d
//   글자       #fff, 그리고 cool 사다리 #dfe2ea → #c9cedc → #9da5b6 → #697183 → #545a69
//
// 구조에서 배울 것 세 가지.
//
//   1. 면은 무채색이고 글자만 차가운 회색이다. 면에 색을 넣지 않는다.
//   2. 깊이를 그림자가 아니라 명도 계단으로만 만든다. 그래서 떠 보이는 게 없다.
//   3. 브랜드 색은 글자와 아이콘에만 쓴다. 큰 면을 브랜드로 칠하지 않는다 —
//      채움용 사다리(surface-brand)는 #009962에서 멈추고, 형광 #00ffa3은 글자 전용이다.
//
// 지난 시안들에 계속 글래스 느낌이 남았던 건 이 셋을 전부 어겼기 때문이다. 면에 색을 깔고,
// 컬러 그림자로 띄우고, 큰 면을 브랜드 그라데이션으로 칠했다.
//
// 핑크를 얹을 때 하나 걸린다. 치지직 초록은 L 0.88에서도 선명해서 근채도 형광을 본문급
// 글자로 쓸 수 있다(#00ffa3, 다크 배경 대비 13.78). #ff007f는 L 0.645의 중명도 색이라
// 같은 자리를 못 간다 — 선명함과 고대비를 동시에 가질 수 없다. 그래서 치지직의 L을
// 따라가지 않고, #ff007f를 그대로 앵커로 두고 대비만 확인해서 쓴다. 4.84로 본문 기준을
// 넘기니 글자로 쓰는 데 문제는 없고, 다만 치지직 초록만큼 튀지는 않는다.

import { writeFileSync } from "node:fs";
import { contrast, toOklch, oklch, rgbToHex } from "./build-point-ramp.mjs";

// 치지직 실측 — semantic 토큰 그대로. 화면의 대조표에도 쓴다.
const CHZZK = {
  dark: {
    page: "#0e0f10", // background-neutral-weak
    base: "#141517", // background-neutral-base
    raise: "#1c1d1f", // surface-neutral-weaker
    control: "#202224", // surface-neutral-weak
    controlHi: "#2a2c2f", // surface-neutral-subtle
    line: "#ffffff1a", // border-neutral-alpha-weaker
    lineHi: "#ffffff26",
    text: "#ffffff", // content-neutral-primary
    textSub: "#dfe2ea", // content-neutral-cool-stronger
    muted: "#9da5b6", // content-neutral-cool-base
    faint: "#697183", // content-neutral-cool-weak
    brandFill: "#009962", // surface-brand-base  ← 형광이 아니다
    brandText: "#00ffa3", // content-brand-strong
  },
  light: {
    // 라이트에서 올린 면에 background-neutral-weak(#f9f9f9)을 썼더니 페이지와 밝기차가
    // 0.018밖에 안 났다. 그건 배경 토큰이지 면 토큰이 아니다 — surface 쪽으로 바꾼다.
    page: "#ffffff", // background-neutral-base
    base: "#ffffff",
    raise: "#f0f1f2", // surface-neutral-weakest
    control: "#e8e9eb", // surface-neutral-subtle
    controlHi: "#e1e1e5", // surface-neutral-base
    line: "#d0d1d3", // surface가 한 단계 올라갔으니 선도 같이 올린다
    lineHi: "#c0c1c2",
    text: "#0e0f10",
    textSub: "#202224",
    muted: "#4d4d4d",
    faint: "#6d6e70",
    brandFill: "#1bb373",
    brandText: "#23815a",
  },
};

// ── 핑크를 치지직 컬러셋에 맞춰 톤 조절 ─────────────────────────────────
//
// 치지직 브랜드 사다리를 재 보니 모든 단계가 그 명도에서 낼 수 있는 최대 채도의 99%다.
// 색조 선택이 아니라 그냥 sRGB 경계선을 따라간다.
//
//   #003321 98%   #006641 99%   #009962 99%   #00cc82 99%   #00e693 99%   #00ffa3 99%
//
// 그런데 #ff007f도 C 0.260 / max 0.262 = 99%다. 같은 규칙으로 만들어진 색이다.
// 다른 건 L축 위 위치뿐이고, 그건 sRGB가 강제한다 — 핑크의 경계선은 L 0.645 근처에서
// 가장 불룩하고 초록은 L 0.88에서 그렇다.
//
// 여기서 두 번째가 걸린다. WCAG 대비는 OKLab 명도가 아니라 상대휘도의 비다. 그리고
// 상대휘도는 초록에 0.7152, 빨강에 0.2126, 파랑에 0.0722을 준다. 같은 L에서도 —
//
//   #00ffa3 Y 0.742  vs  #ffc6d4 Y 0.664   1.12배
//   #00cc82 Y 0.448  vs  #ff7aa3 Y 0.378   1.18배
//   #009962 Y 0.237  vs  #e80473 Y 0.185   1.28배
//
// 초록이 같은 밝기에서 휘도를 더 많이 낸다. 그래서 L을 맞춰 옮기면 핑크는 대비가 한 단계씩
// 모자란다. 대비 역할을 맞추려면 핑크는 치지직보다 밝은 쪽에 놓여야 한다.
//
// 그래서 L이 아니라 대비를 맞춰 사다리를 푼다. 결과가 흥미롭다 —
//
//   다크   content-brand-weaker (#009962, 4.99)  →  #ff1b81 (4.98)
//   라이트 content-brand-weak   (#1a9662, 3.76)  →  #ff057f (3.76)
//
// 둘 다 #ff007f다. 타연 핑크는 치지직 체계에서 형광 악센트 자리가 아니라 채움 면 자리에
// 해당한다. 밝은 악센트 글자 자리는 그보다 옅은 핑크가 맡아야 한다.

const PINK = "#ff007f";
const PINK_H = toOklch(PINK).H;

// 주어진 명도에서 sRGB 안에 들어가는 최대 채도
const maxC = (L, H) => {
  let lo = 0;
  let hi = 0.45;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    Math.abs(toOklch(rgbToHex(oklch(L, m, H))).C - m) < 0.0015 ? (lo = m) : (hi = m);
  }
  return lo;
};
// 치지직처럼 경계선을 따라간다
const edge = (L) => rgbToHex(oklch(L, maxC(L, PINK_H), PINK_H));
// 배경 위에서 목표 대비를 내는 경계선 핑크를 찾는다
const solveByContrast = (bg, target, rising) => {
  let lo = 0.15;
  let hi = 0.99;
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    const c = contrast(bg, edge(m));
    (rising ? c < target : c > target) ? (lo = m) : (hi = m);
  }
  return edge((lo + hi) / 2);
};
// 옅은 브랜드 면은 채도 비율을 유지해 옮긴다 — 면이라 대비 목표가 없다
const rehueByRatio = (hex) => {
  const { L, C, H } = toOklch(hex);
  return rgbToHex(oklch(L, maxC(L, PINK_H) * (C / maxC(L, H)), PINK_H));
};

// 치지직 brand 사다리 → 같은 대비를 내는 핑크
const BRAND_LADDER = {
  dark: { bg: "#141517", rising: true, src: {
    weaker: "#009962", weak: "#00cc82", base: "#00e693", strong: "#00ffa3" } },
  light: { bg: "#ffffff", rising: false, src: {
    weaker: "#32bb81", weak: "#1a9662", base: "#168f5c", strong: "#23815a" } },
};
for (const cfg of Object.values(BRAND_LADDER)) {
  cfg.out = Object.fromEntries(
    Object.entries(cfg.src).map(([k, g]) => [k, solveByContrast(cfg.bg, contrast(cfg.bg, g), cfg.rising)]),
  );
}

const T = {
  dark: {
    ...CHZZK.dark,
    label: "다크",
    src: CHZZK.dark,
    brand: PINK,        // 채움. weaker 자리에 그대로 앉는다(4.98 ↔ 4.84).
    onBrand: "#141517", // 흰 글자는 3.78로 미달
    // 악센트 글자는 weak 자리. strong(#ffd5df, 13.78)까지 가면 흰색에 가까워진다.
    brandText: BRAND_LADDER.dark.out.weak,
    brandSurface: rehueByRatio("#003321"),
    brandSurfaceHi: rehueByRatio("#11382c"),
  },
  light: {
    ...CHZZK.light,
    label: "라이트",
    src: CHZZK.light,
    brand: PINK,        // 라이트에서는 weak 자리(3.76) — 글자로 쓰기엔 모자라고 면으로는 된다
    onBrand: "#141517",
    brandText: BRAND_LADDER.light.out.strong,
    brandSurface: rehueByRatio("#e8f7f1"),
    brandSurfaceHi: rehueByRatio("#ddf4ea"),
  },
};

const fmt = (n) => n.toFixed(2);
const chip = (v, floor = 4.5) =>
  `<dd class="${v >= floor ? "pass" : "fail"}">${fmt(v)}</dd>`;

// 무엇을 그대로 가져왔고 무엇을 바꿨는지
const MAP = [
  { what: "폰트", src: "Pretendard Variable", ours: "동일", note: "이미 쓰고 있다" },
  { what: "모서리", src: "4 · 6 · 8px 중심 / 원형", ours: "동일", note: "지금 999px 알약을 줄인다" },
  { what: "그림자", src: "<b>없음</b>", ours: "없음", note: "깊이는 명도 계단으로만" },
  { what: "그라데이션", src: "<b>UI에 없음</b>", ours: "없음", note: "글래스 느낌의 주범이었다" },
  { what: "면", src: "무채색 사다리 7단", ours: "그대로", note: "면에 색을 넣지 않는다" },
  { what: "테두리", src: "알파 #ffffff0d~4d", ours: "그대로", note: "선 색을 따로 안 만든다" },
  { what: "글자", src: "흰색 + cool 회색 사다리", ours: "그대로", note: "면은 무채, 글자만 차갑다" },
  { what: "브랜드 사다리", src: "전 단계 최대 채도의 <b>99%</b>", ours: "동일", note: "#ff007f도 99% — 같은 규칙" },
  { what: "브랜드 글자", src: "#00ffa3 <small>(13.78)</small>", ours: `${T.dark.brandText} <small>(${fmt(contrast(T.dark.page, T.dark.brandText))})</small>`, note: "대비를 맞춰 푼 자리" },
  { what: "브랜드 채움", src: "#009962 <small>형광 아님</small>", ours: "#ff007f", note: "<b>여기가 #ff007f 자리</b>" },
  { what: "채움 위 글자", src: "—", ours: "#141517", note: "흰 글자는 3.78로 미달" },
  { what: "아이콘 버튼", src: "아이콘만", ours: "아이콘 + 글자", note: "<b>안 따름</b> · 50대 테스터" },
  { what: "가장 옅은 글자", src: "#697183 <small>(cool-weak)</small>", ours: "#9da5b6 한 단계 위", note: "<b>안 따름</b> · 다크에서 3.92" },
];

/* ── 메인화면: 첨부 이미지(Claude 앱) 레이아웃 ───────────────────────────
   원형 버튼 둘이 위, 가운데가 통째로 비고, 아래에 입력 카드, 그 밑에 회사 정보.
   회사 정보가 초기화면 맨 아래 오는 건 마침 전자상거래법 시행규칙 제7조 ①이
   요구하는 "초기화면 표시"와 맞는다.
   원형 버튼에 글자를 붙인 건 참조 이미지와 다르다 — 50대 테스터 건으로 정한 원칙이다. */
function mainScreen(t) {
  return `
      <div class="col">
        <header class="mainbar">
          <button class="circ-btn"><span class="circ"><span class="ic">☰</span><i class="dot"></i></span>메뉴</button>
          <button class="circ-btn"><span class="circ"><span class="ic">◕</span></span>루미</button>
        </header>

        <div class="hero">
          <div class="mark">✳</div>
          <p class="greet">안녕하세요, <b>올빼미</b>님</p>
        </div>

        <div class="composer">
          <div class="field">루미에게 물어보기</div>
          <div class="actions">
            <button class="act"><span class="ic">◷</span>시간제</button>
            <button class="act">원 카드 <span class="caret">▼</span></button>
            <span class="spacer"></span>
            <button class="send"><span class="ic">↑</span></button>
          </div>
        </div>

        <p class="legal">타연 | 사업자등록번호 000-00-00000<br>대표 000 · 서울특별시 <span class="caret">⌄</span></p>
      </div>`;
}

/* ── 대화 화면: 같은 토큰이 대화에서 어떻게 보이는지 ─────────────────── */
function chatScreen(t) {
  return `
      <div class="col">
        <header class="topbar">
          <button class="bar-btn"><span class="ic">☰</span>메뉴</button>
          <b class="title">이직 고민 상담</b>
          <button class="bar-btn"><span class="ic">◷</span>시간제</button>
          <button class="bar-btn"><span class="ic">⋯</span>더보기</button>
        </header>

        <div class="status">
          <p class="status-text">스탠다드 이용권 · <b>14회</b> 남았어요</p>
          <button class="btn sm">구입</button>
        </div>

        <div class="stream">
          <div class="msg">
            <p class="who">루미</p>
            <p class="body">안녕하세요. 어떤 고민이든 편하게 말씀해 주세요.</p>
          </div>
          <div class="msg me">
            <p class="body">올해 이직해도 괜찮을까?</p>
          </div>
          <div class="msg">
            <p class="who">루미 · 원 카드</p>
            <h4 class="card-name">완드 7</h4>
            <p class="body">지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
              버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</p>
          </div>
          <div class="suggest">
            <p class="suggest-label">이어서 물어보기</p>
            <button><span class="ico">→</span>지금 준비해야 할 건 뭘까?</button>
            <button><span class="ico">→</span>올해 안에 결정해도 될까?</button>
          </div>
        </div>

        <div class="composer bottom">
          <div class="field">이직 시기를 알고 싶어요</div>
          <div class="actions">
            <button class="act">원 카드 <span class="caret">▼</span></button>
            <span class="spacer"></span>
            <button class="send"><span class="ic">↑</span></button>
          </div>
        </div>
      </div>`;
}

function frame(key, kind) {
  const t = T[key];
  const style = `
      --page:${t.page}; --base:${t.base}; --raise:${t.raise}; --control:${t.control};
      --control-hi:${t.controlHi}; --line:${t.line}; --line-hi:${t.lineHi};
      --text:${t.text}; --text-sub:${t.textSub}; --muted:${t.muted}; --faint:${t.faint};
      --brand:${t.brand}; --on-brand:${t.onBrand}; --brand-text:${t.brandText};
      --brand-surface:${t.brandSurface}; --brand-surface-hi:${t.brandSurfaceHi};`;
  return `
  <figure class="frame">
    <figcaption>${t.label} · ${kind === "main" ? "메인화면" : "대화 화면"}</figcaption>
    <div class="screen" style="${style}">
      ${kind === "main" ? mainScreen(t) : chatScreen(t)}
    </div>
  </figure>`;
}

function facts(key) {
  const t = T[key];
  return `
  <dl class="facts">
    <dt class="head">${t.label}</dt>
    <div><dt>본문 글자<small>올린 면 위</small></dt>${chip(contrast(t.raise, t.text))}</div>
    <div><dt>보조 글자</dt>${chip(contrast(t.raise, t.muted))}</div>
    <div><dt>회사 정보 · placeholder<small>muted</small></dt>${chip(contrast(t.page, t.muted))}</div>
    <div><dt>치지직 faint를 그대로 썼다면<small>#697183 — 안 쓴 이유</small></dt>${chip(contrast(t.page, t.faint))}</div>
    <div><dt>브랜드 글자<small>페이지 위</small></dt>${chip(contrast(t.page, t.brandText))}</div>
    <div><dt>채움 버튼 글자<small>#ff007f 면 위</small></dt>${chip(contrast(t.brand, t.onBrand))}</div>
    <div><dt>채움 버튼이 배경에서 갈리는 정도<small>비텍스트 3:1</small></dt>${chip(contrast(t.brand, t.page), 3)}</div>
    <div><dt>입력 카드가 페이지에서 갈리는 정도<small>OKLab 밝기차 · 0.02면 충분(면끼리)</small></dt>
      <dd class="${Math.abs(toOklch(t.raise).L - toOklch(t.page).L) >= 0.02 ? "pass" : "fail"}">${Math.abs(toOklch(t.raise).L - toOklch(t.page).L).toFixed(3)}</dd></div>
  </dl>`;
}

const mapRows = MAP.map(
  (m) => `<tr><td><b>${m.what}</b></td><td class="src">${m.src}</td><td>${m.ours}</td><td class="why">${m.note}</td></tr>`,
).join("");

// 치지직 초록 사다리와 같은 대비를 내는 핑크를 나란히
const brandLadder = (key) => {
  const cfg = BRAND_LADDER[key];
  return Object.entries(cfg.src)
    .map(([k, g]) => {
      const p = cfg.out[k];
      return `<tr><td><b>content-brand-${k}</b></td>
        <td><span class="dot-sw" style="background:${g}"></span><code>${g}</code></td>
        <td class="num">${fmt(contrast(cfg.bg, g))}</td>
        <td><span class="dot-sw" style="background:${p}"></span><code>${p}</code></td>
        <td class="num">${fmt(contrast(cfg.bg, p))}</td>
        <td class="why">${k === (key === "dark" ? "weaker" : "weak") ? "<b>여기가 #ff007f다</b>" : ""}</td></tr>`;
    })
    .join("");
};

const ladder = (key) => {
  const s = CHZZK[key];
  const keys = ["page", "base", "raise", "control", "controlHi", "text", "textSub", "muted", "faint"];
  return keys
    .map((k) => `<div class="sw"><span style="background:${s[k]}"></span><code>${s[k]}</code><small>${k}</small></div>`)
    .join("");
};

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 치지직 디자인 + 타연 핑크</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#0e0f10; color:#dfe2ea;
    font:400 14px/1.6 "Pretendard Variable", Pretendard, system-ui, sans-serif; }
  .wrap { max-width:1380px; margin:0 auto; }
  h1 { font-size:23px; margin:0 0 6px; color:#fff; }
  h2 { font-size:13px; margin:26px 0 8px; color:#9da5b6; font-weight:600; }
  .lede { margin:0 0 20px; color:#9da5b6; max-width:84ch; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  table { width:100%; border-collapse:collapse; margin:0 0 8px; font-size:12.5px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #202224; vertical-align:top; }
  th { color:#9da5b6; font-weight:600; font-size:11.5px; }
  td.src { color:#76d1ab; font-family:ui-monospace, Menlo, monospace; font-size:11.5px; }
  td.why { color:#9da5b6; }

  .swatches { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 18px; }
  .sw { display:flex; align-items:center; gap:6px; background:#141517; border:1px solid #202224;
    border-radius:6px; padding:5px 9px; font-size:11px; }
  .sw span { width:16px; height:16px; border-radius:4px; border:1px solid #ffffff1a; }
  .sw small { color:#697183; }
  .dot-sw { display:inline-block; width:12px; height:12px; border-radius:3px; vertical-align:-2px;
    margin-right:6px; border:1px solid #ffffff1a; }
  td.num { font-variant-numeric:tabular-nums; color:#dfe2ea; }

  .frames { display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#9da5b6; margin-bottom:8px; }

  /* ── 치지직 규칙: 그림자 없음. 모서리 4/6/8 중심. 면에 색 없음. ── */
  .screen { position:relative; width:360px; height:740px; overflow:hidden;
    background:var(--page); display:flex; border-radius:20px; border:1px solid #202224; }
  .col { display:flex; flex-direction:column; flex:1; min-width:0; }

  /* 메인화면 */
  .mainbar { display:flex; align-items:flex-start; justify-content:space-between; padding:14px 14px 0; }
  .circ-btn { display:flex; flex-direction:column; align-items:center; gap:3px; border:0;
    background:transparent; cursor:pointer; font:inherit; font-size:11px; font-weight:500;
    color:var(--muted); padding:0; }
  .circ { position:relative; display:flex; align-items:center; justify-content:center;
    width:44px; height:44px; border-radius:9999px; background:var(--control); color:var(--text-sub);
    transition:background 160ms ease; }
  .circ-btn:hover .circ { background:var(--control-hi); }
  .circ .ic { font-size:17px; line-height:1; }
  .dot { position:absolute; top:9px; right:9px; width:8px; height:8px; border-radius:9999px;
    background:var(--brand); border:2px solid var(--page); }

  .hero { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:14px; padding:0 24px; }
  .mark { font-size:40px; line-height:1; color:var(--brand); }
  .greet { margin:0; font-size:21px; color:var(--text-sub); font-weight:400; }
  .greet b { font-weight:700; color:var(--text); }

  /* 입력 카드 — 참조 이미지 구조: 입력줄 + 컨트롤 줄 */
  .composer { margin:0 12px; background:var(--raise); border:1px solid var(--line);
    border-radius:20px; padding:14px 12px 10px; }
  .composer.bottom { margin:8px 12px 12px; }
  /* placeholder에 치지직 faint(#697183)를 쓰면 다크에서 3.92로 미달한다. muted를 쓴다. */
  .field { font-size:15px; color:var(--muted); padding:0 4px 12px; }
  .actions { display:flex; align-items:center; gap:7px; }
  .spacer { flex:1; }
  .act { display:flex; align-items:center; gap:5px; min-height:34px; padding:0 13px; border:0;
    border-radius:8px; cursor:pointer; background:var(--control); color:var(--text-sub);
    font:inherit; font-size:13px; font-weight:500; transition:background 160ms ease; }
  .act:hover { background:var(--control-hi); }
  .act .ic { font-size:13px; }
  .caret { font-size:10px; color:var(--muted); }
  .send { display:flex; align-items:center; justify-content:center; width:38px; height:38px;
    border:0; border-radius:9999px; cursor:pointer; background:var(--brand); color:var(--on-brand);
    font-size:17px; font-weight:700; transition:filter 160ms ease; }
  .send:hover { filter:brightness(1.08); }

  .legal { margin:0; padding:14px 20px 18px; text-align:center; font-size:11.5px;
    line-height:1.55; color:var(--muted); }

  /* 대화 화면 */
  .topbar { display:flex; align-items:center; gap:2px; padding:6px 8px;
    background:var(--base); border-bottom:1px solid var(--line); }
  .bar-btn { display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:1px; min-width:44px; height:40px; border:0; border-radius:8px; cursor:pointer;
    background:transparent; color:var(--muted); font:inherit; font-size:10px; font-weight:500;
    transition:background 160ms ease; }
  .bar-btn:hover { background:var(--control); }
  .bar-btn .ic { font-size:14px; line-height:1; }
  .title { flex:1; text-align:center; font-size:15px; font-weight:700; color:var(--text);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .status { display:flex; align-items:center; justify-content:space-between; gap:10px;
    min-height:38px; padding:0 12px; background:var(--raise); border-bottom:1px solid var(--line); }
  .status-text { margin:0; font-size:12.5px; color:var(--muted); }
  .status-text b { color:var(--text-sub); font-weight:700; }
  .btn { border:0; border-radius:8px; cursor:pointer; background:var(--brand);
    color:var(--on-brand); font:inherit; font-weight:700; transition:filter 160ms ease; }
  .btn.sm { min-height:28px; padding:0 13px; font-size:12px; }

  .stream { flex:1; overflow:hidden; padding:12px; display:flex; flex-direction:column; gap:12px; }
  .msg { max-width:88%; }
  .msg.me { align-self:flex-end; max-width:82%; }
  .who { margin:0 0 4px; font-size:11.5px; color:var(--muted); }
  .body { margin:0; font-size:14.5px; line-height:1.6; color:var(--text-sub);
    background:var(--raise); border:1px solid var(--line); border-radius:12px; padding:10px 13px; }
  /* 내 말풍선도 브랜드 채움 — 다만 그림자 없음, 그라데이션 없음 */
  .msg.me .body { background:var(--brand); color:var(--on-brand); border:0; font-weight:600; }
  .card-name { margin:0 0 6px; font-size:19px; font-weight:700; color:var(--brand-text); }

  .suggest { display:flex; flex-direction:column; gap:6px; }
  .suggest-label { margin:0 0 0 2px; font-size:11.5px; color:var(--muted); }
  .suggest button { display:flex; align-items:center; gap:7px; text-align:left; font:inherit;
    font-size:13px; font-weight:500; cursor:pointer; border:0; background:var(--control);
    color:var(--text-sub); border-radius:8px; padding:0 13px; min-height:36px;
    transition:background 160ms ease; }
  .suggest button:hover { background:var(--control-hi); }
  .suggest .ico { font-size:12px; color:var(--brand-text); }

  .facts { margin:0; display:grid; gap:5px; width:360px; }
  .facts .head { font-size:12px; color:#fff; font-weight:700; margin-bottom:2px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #202224; padding-top:5px; }
  .facts dt { font-size:12px; color:#9da5b6; }
  .facts dt small { display:block; opacity:.8; font-size:11px; color:#697183; }
  .facts dd { margin:0; font-size:12px; font-weight:700; border-radius:6px; padding:2px 8px;
    font-variant-numeric:tabular-nums; }
  .facts dd.pass { background:#0b482e; color:#a4e1c7; }
  .facts dd.fail { background:#4a1f1c; color:#ffc9c4; }

  .factrow { display:flex; gap:20px; flex-wrap:wrap; margin-top:20px; }
  footer { margin-top:28px; color:#9da5b6; font-size:12px; max-width:84ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>치지직 디자인 + 타연 핑크 <code>#ff007f</code></h1>
  <p class="lede">
    치지직은 디자인 토큰을 <code>:root</code>에 그대로 내놓는다 — 1,908개. 짐작할 게 없어서
    semantic 레이어를 라이트·다크 양쪽 다 뽑아 왔다. 배울 건 셋이다:
    <b>면은 무채색, 깊이는 명도 계단으로만, 브랜드는 글자에만.</b>
    지난 시안들에 글래스 느낌이 남았던 건 이 셋을 전부 어겼기 때문이다 —
    면에 색을 깔고, 컬러 그림자로 띄우고, 큰 면을 그라데이션으로 칠했다.
    메인화면 레이아웃은 첨부 이미지를 따랐다.
  </p>

  <h2>치지직 면·글자 사다리 (실측) — 다크</h2>
  <div class="swatches">${ladder("dark")}</div>
  <h2>라이트</h2>
  <div class="swatches">${ladder("light")}</div>

  <h2>핑크 톤 조절 — 치지직 사다리와 같은 대비를 내는 자리 찾기</h2>
  <p class="lede">
    치지직 브랜드 사다리는 모든 단계가 그 명도에서 낼 수 있는 <b>최대 채도의 99%</b>다.
    색조를 고른 게 아니라 sRGB 경계선을 그대로 따라간다. 그런데 <code>#ff007f</code>도
    C 0.260 / max 0.262 = <b>99%</b>다 — 같은 규칙으로 만들어진 색이다. 다른 건 L축 위
    위치뿐이고 그건 sRGB가 강제한다.
    <br><br>
    여기에 하나 더 걸린다. WCAG 대비는 OKLab 명도가 아니라 <b>상대휘도</b>의 비이고,
    상대휘도는 초록에 0.7152를 주고 빨강·파랑에 0.2126·0.0722을 준다. 같은 L에서도
    <code>#00cc82</code>(Y 0.448)가 <code>#ff7aa3</code>(Y 0.378)보다 1.18배 밝다.
    그래서 명도를 맞춰 옮기면 핑크는 대비가 한 단계씩 모자란다 —
    <b>대비 역할을 맞추려면 핑크는 치지직보다 밝은 쪽에 놓여야 한다.</b>
    아래는 L이 아니라 대비를 맞춰 푼 결과다.
  </p>
  <table>
    <thead><tr><th>단계</th><th>치지직 초록</th><th>대비</th><th>같은 대비의 핑크</th><th>대비</th><th></th></tr></thead>
    <tbody>${brandLadder("dark")}</tbody>
  </table>
  <p class="lede" style="margin-top:-2px">다크 기준 <code>#141517</code> 위. 라이트는 <code>#ffffff</code> 위:</p>
  <table>
    <thead><tr><th>단계</th><th>치지직 초록</th><th>대비</th><th>같은 대비의 핑크</th><th>대비</th><th></th></tr></thead>
    <tbody>${brandLadder("light")}</tbody>
  </table>
  <p class="lede">
    <b>타연 핑크는 치지직 체계에서 형광 악센트 자리가 아니라 채움 면 자리다.</b>
    다크의 <code>content-brand-weaker</code>(4.99)와 라이트의 <code>content-brand-weak</code>(3.76)를
    풀면 둘 다 <code>#ff007f</code>가 나온다. 밝은 악센트 글자 자리는 그보다 옅은 핑크가 맡는다 —
    치지직이 <code>#00ffa3</code>을 쓰는 자리에 <code>#ffd5df</code>를 넣으면 흰색에 가까워지므로
    한 단계 아래 <code>${T.dark.brandText}</code>를 악센트로 쓴다.
  </p>

  <h2>무엇을 가져왔고 무엇을 바꿨나</h2>
  <table>
    <thead><tr><th>요소</th><th>치지직 실측</th><th>적용</th><th>비고</th></tr></thead>
    <tbody>${mapRows}</tbody>
  </table>

  <h2>메인화면 — 첨부 이미지 레이아웃</h2>
  <div class="frames">
    ${frame("dark", "main")}
    ${frame("light", "main")}
    ${frame("dark", "chat")}
    ${frame("light", "chat")}
  </div>

  <div class="factrow">${facts("dark")}${facts("light")}</div>

  <footer>
    <b>남는 맞바꿈 하나.</b> 대비 역할을 맞추면 악센트 핑크가 옅어지고, 채도를 지키면 대비가
    내려간다. 둘을 동시에 가질 수 없는 건 sRGB의 제약이다 — 핑크의 채도 경계선이 L 0.645에서
    가장 불룩하기 때문이다. 지금은 대비 쪽을 택해 악센트에 <code>${T.dark.brandText}</code>(다크
    ${fmt(contrast(T.dark.page, T.dark.brandText))})를 쓴다. 더 쨍하게 가려면
    <code>#ff007f</code>를 글자에도 쓰면 되고, 그때 다크 대비는 4.84로 내려간다.
    <br><br>
    채움 버튼 위 글자는 <b>흰색이 아니라 <code>#141517</code></b>이다. 흰 글자는 3.78로 떨어진다.
    <br><br>
    치지직의 가장 옅은 글자 <code>#697183</code>은 다크 페이지 위에서 <b>3.92</b>다. 그들은
    부차적인 정보에 쓰지만, 우리 쪽에서 그 자리에 오는 건 회사 정보와 입력 placeholder다 —
    법으로 표시해야 하는 글자와, 무엇을 쓰는 칸인지 알려주는 글자다. 한 단계 위
    <code>#9da5b6</code>를 쓴다.
    <br><br>
    참조 이미지의 원형 버튼은 아이콘만인데 <b>글자를 붙였다</b> — 50대 테스터 건으로 정한
    원칙이 앞선다. 회사 정보가 초기화면 맨 아래 오는 건 마침
    전자상거래법 시행규칙 제7조 ①의 “초기화면 표시”와 맞는다.
    <br><br>
    생성: <code>node doc/design/build-chzzk-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/chzzk-mockup.html", html);
console.log("wrote doc/design/chzzk-mockup.html");
for (const key of Object.keys(T)) {
  const t = T[key];
  console.log(
    `${t.label.padEnd(6)} 본문 ${fmt(contrast(t.raise, t.text))}  보조 ${fmt(contrast(t.raise, t.muted))}` +
      `  옅은글자 ${fmt(contrast(t.page, t.muted))}  브랜드글자 ${fmt(contrast(t.page, t.brandText))}` +
      `  채움글자 ${fmt(contrast(t.brand, t.onBrand))}  채움분리 ${fmt(contrast(t.brand, t.page))}`,
  );
}
