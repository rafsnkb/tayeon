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
    page: "#ffffff",
    base: "#ffffff",
    raise: "#f9f9f9",
    control: "#f0f1f2",
    controlHi: "#e8e9eb",
    line: "#e1e1e5",
    lineHi: "#d0d1d3",
    text: "#0e0f10",
    textSub: "#202224",
    muted: "#4d4d4d",
    faint: "#6d6e70",
    brandFill: "#1bb373",
    brandText: "#23815a",
  },
};

// 브랜드만 바꾼다. 면·선·글자는 치지직 값을 그대로 쓴다 — 무채색이라 색조를 돌릴 게 없다.
const PINK = "#ff007f";
const PINK_H = toOklch(PINK).H;
// 브랜드 계열의 옅은 면은 치지직 값의 L·C를 유지하고 색조만 핑크로 돌린다.
const rehue = (hex) => {
  const { L, C } = toOklch(hex);
  return rgbToHex(oklch(L, C, PINK_H));
};

const T = {
  dark: {
    ...CHZZK.dark,
    label: "다크",
    src: CHZZK.dark,
    brand: PINK, // 앵커. 그대로 쓴다.
    onBrand: "#141517", // 핑크 면 위 글자 — 흰 글자는 3.78로 떨어진다
    brandText: PINK, // 다크 배경 위 4.84
    brandSurface: rehue("#003321"), // surface-brand-weakest
    brandSurfaceHi: rehue("#11382c"),
  },
  light: {
    ...CHZZK.light,
    label: "라이트",
    src: CHZZK.light,
    brand: PINK,
    onBrand: "#141517",
    brandText: "#ac0053", // 흰 배경 위 7.29 (#ff007f는 3.78로 미달)
    brandSurface: rehue("#e8f7f1"),
    brandSurfaceHi: rehue("#ddf4ea"),
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
  { what: "브랜드 글자", src: "#00ffa3 <small>(대비 13.78)</small>", ours: "#ff007f <small>(4.84)</small>", note: "핑크는 그 밝기를 못 낸다" },
  { what: "브랜드 채움", src: "#009962 <small>형광 아님</small>", ours: "#ff007f", note: "앵커라 그대로 쓴다" },
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
    <b>핑크가 치지직 초록 자리를 그대로 못 간다.</b> 초록은 L 0.88에서도 선명해서 형광
    <code>#00ffa3</code>을 본문급 글자로 쓴다(다크 배경 대비 13.78). <code>#ff007f</code>는
    L 0.645의 중명도 색이라 선명함과 고대비를 같이 가질 수 없다 — 다크 배경 위 4.84다.
    기준(4.5)은 넘지만 치지직 초록만큼 튀지는 않는다. 라이트에서는 <code>#ff007f</code>가
    3.78로 미달이라 글자로는 <code>#ac0053</code>(7.29)을 쓰고, 채움 면에만
    <code>#ff007f</code>를 그대로 둔다.
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
