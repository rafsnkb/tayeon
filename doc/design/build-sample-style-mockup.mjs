// 다른 AI가 만든 샘플(asset/Screen/sample_001·002.png) 스타일을 타연 화면에 적용.
//   node doc/design/build-sample-style-mockup.mjs  →  doc/design/sample-style-mockup.html
//
// 눈대중하지 않고 sharp로 픽셀을 뽑았다. 아래는 전부 실측이다.
//
//   다크   페이지 #0f090c 39.95%   올린 면 #191115 9.72%   선 #24191e
//          글자 #fdf6f9            보조 #d8c9cf
//   라이트 페이지 #fffeff 44.27%   올린 면 #fef6f9 9.51%
//          글자 #060203            보조 #594d51
//   공통   브랜드 채움 #ff1e9a (양쪽 다 2.3%)   칩 면 #fddeee / #ffdbed   칩 글자 #5e344e
//
// 가장 중요한 발견. 샘플의 핑크는 사실상 우리 핑크다 —
//
//   #ff1e9a  L 0.660  C 0.260  H  -4.9
//   #ff007f  L 0.645  C 0.260  H   2.8
//
// 채도가 같고 명도가 0.015 차이, 색조만 7.7° 떨어져 있다. 새 색을 가져올 게 아니라
// 우리 색을 그렇게 쓰면 된다는 뜻이다.
//
// 배경 워시는 가장자리 픽셀로 떴다. 페이지 바탕색에 핑크 글로우 세 덩이가 얹혀 있다.
//
//   다크   #0f090c 바탕 · 좌상 #8e6171 · 하중앙 #634b58 · 우중간 #8e6765
//   라이트 #fffeff 바탕 · 좌상 #ffe1f1 · 하중앙 #fde8f3 · 우중간 #ffe1de
//
// 예전 아우로라 시도와 결정적으로 다른 점이 있다. 워시는 페이지 배경에만 있고,
// 그 위에 놓이는 면은 전부 불투명 단색이다. blur도, 반투명 패널도, 컬러 그림자도 없다.
// 글래스로 읽혔던 건 워시 때문이 아니라 그 위에 반투명 재질을 얹었기 때문이었다.
//
// 내가 과교정했던 것도 같이 적어 둔다. 글래스 지적을 받고 치지직 쪽으로 가면서 색과 온기,
// 큰 글자까지 전부 걷어냈다. 지적은 재질에 대한 것이었지 색에 대한 것이 아니었다.

import { writeFileSync } from "node:fs";
import { contrast, toOklch } from "./build-point-ramp.mjs";

// 실측값 — 대조표에도 그대로 쓴다.
const SRC = {
  dark: { page: "#0f090c", raise: "#191115", line: "#24191e", text: "#fdf6f9", muted: "#d8c9cf" },
  light: { page: "#fffeff", raise: "#fef6f9", text: "#060203", muted: "#594d51" },
  brand: "#ff1e9a",
  chip: "#fddeee",
  chipText: "#5e344e",
  wash: {
    dark: ["#8e6171", "#634b58", "#8e6765"],
    light: ["#ffe1f1", "#fde8f3", "#ffe1de"],
  },
};

const PINK = "#ff007f"; // 타연 핑크. 샘플의 #ff1e9a와 채도가 같고 색조만 7.7° 다르다.
// 샘플은 #ff1e9a 채움에 흰 글자를 올리는데 3.56이다. 우리 #ff007f로 해도 3.78 —
// 둘 다 본문 기준 4.5에 못 미친다. 채움만 한 단계 내려 4.52를 만든다. 육안 차이는 거의 없다.
const PINK_FILL = "#e70073";

const T = {
  dark: {
    label: "다크",
    ...SRC.dark,
    wash: SRC.wash.dark,
    washOpacity: 0.5,
    brand: PINK, // 악센트·브랜드 글자
    fill: PINK_FILL, // 채움 버튼
    onFill: "#ffffff",
    chip: SRC.chip,
    chipText: SRC.chipText,
    onBrandSoft: "#ffffff",
  },
  light: {
    label: "라이트",
    ...SRC.light,
    // 라이트의 올린 면은 페이지와 밝기차가 0.018뿐이다. 샘플도 그렇다 — 선으로 버틴다.
    line: "#f3dde7",
    wash: SRC.wash.light,
    washOpacity: 0.9,
    brand: "#ac0053", // 흰 바탕 위 #ff007f는 3.78이라 작은 글자로 못 쓴다
    brandBig: PINK, // 큰 글자·아이콘은 #ff007f 그대로 (3.78 ≥ 큰글자 3.0)
    fill: PINK_FILL,
    onFill: "#ffffff",
    chip: SRC.chip,
    chipText: SRC.chipText,
  },
};
T.dark.brandBig = PINK;

const fmt = (n) => n.toFixed(2);
const step = (a, b) => Math.abs(toOklch(a).L - toOklch(b).L);
const pill = (v, floor = 4.5) => `<dd class="${v >= floor ? "pass" : "fail"}">${fmt(v)}</dd>`;

const MAP = [
  { what: "브랜드 핑크", src: "#ff1e9a <small>L .660 C .260 H -4.9</small>", ours: "#ff007f <small>L .645 C .260 H 2.8</small>", note: "<b>사실상 같은 색</b> · 색조만 7.7°" },
  { what: "채움 + 흰 글자", src: "3.56 <small>#ff1e9a</small>", ours: `${fmt(contrast(PINK_FILL, "#ffffff"))} <small>${PINK_FILL}</small>`, note: "<b>내림</b> · 우리 핑크도 3.78로 미달" },
  { what: "버튼 모서리", src: "알약 999px", ours: "동일", note: "치지직 8px에서 되돌린다" },
  { what: "배경", src: "바탕색 + 핑크 글로우 3덩이", ours: "동일", note: "페이지 배경에만" },
  { what: "그 위의 면", src: "<b>전부 불투명 단색</b>", ours: "동일", note: "반투명·blur 없음 = 글래스 아님" },
  { what: "그림자", src: "없음", ours: "없음", note: "컬러 그림자도 없다" },
  { what: "칩", src: "#fddeee 면 + #5e344e 글자", ours: "동일", note: "양쪽 테마 같은 값" },
  { what: "큰 글자", src: "디스플레이급 헤드라인", ours: "인사말 28px", note: "치지직 판에서 21px였다" },
];

function mainScreen(t) {
  return `
      <div class="col">
        <header class="mainbar">
          <button class="circ-btn"><span class="circ"><span class="ic">☰</span><i class="dot"></i></span>메뉴</button>
          <button class="circ-btn"><span class="circ av"><span class="ic">◕</span></span>루미</button>
        </header>

        <div class="hero">
          <span class="badge">✦ AI 타로 상담 · 24시간 언제나</span>
          <p class="greet">안녕하세요,<br><b>올빼미</b>님</p>
          <p class="sub">판단 없이, 재촉 없이. 오늘 마음에 걸리는 걸 편하게 말씀해 주세요.</p>
        </div>

        <div class="chips">
          <button class="chip">요즘 잠이 잘 안 와요</button>
          <button class="chip">일이 너무 지쳐요</button>
          <button class="chip">관계 때문에 힘들어요</button>
        </div>

        <div class="composer">
          <div class="field">지금 마음을 편하게 적어보세요…</div>
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
          <button class="btn-fill sm">구입</button>
        </div>

        <div class="stream">
          <div class="msg">
            <p class="who"><span class="avatar">◕</span>루미</p>
            <p class="body">안녕하세요. 어떤 고민이든 편하게 말씀해 주세요.</p>
          </div>
          <div class="msg me">
            <p class="body">올해 이직해도 괜찮을까?</p>
          </div>
          <div class="msg">
            <p class="who"><span class="avatar">◕</span>루미 · 원 카드</p>
            <h4 class="card-name">완드 7</h4>
            <p class="body">지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
              버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</p>
          </div>
          <div class="chips wrap">
            <button class="chip">지금 준비해야 할 건?</button>
            <button class="chip">올해 안에 결정해도 될까?</button>
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
      --page:${t.page}; --raise:${t.raise}; --line:${t.line}; --text:${t.text}; --muted:${t.muted};
      --brand:${t.brand}; --brand-big:${t.brandBig}; --fill:${t.fill}; --on-fill:${t.onFill};
      --chip:${t.chip}; --chip-text:${t.chipText}; --wash-op:${t.washOpacity};
      --w1:${t.wash[0]}; --w2:${t.wash[1]}; --w3:${t.wash[2]};`;
  return `
  <figure class="frame">
    <figcaption>${t.label} · ${kind === "main" ? "메인화면" : "대화 화면"}</figcaption>
    <div class="screen" style="${style}">
      <div class="wash"></div>
      ${kind === "main" ? mainScreen(t) : chatScreen(t)}
    </div>
  </figure>`;
}

function facts(key) {
  const t = T[key];
  return `
  <dl class="facts">
    <dt class="head">${t.label}</dt>
    <div><dt>본문 글자<small>페이지 위</small></dt>${pill(contrast(t.page, t.text))}</div>
    <div><dt>보조 글자</dt>${pill(contrast(t.page, t.muted))}</div>
    <div><dt>말풍선 글자<small>올린 면 위</small></dt>${pill(contrast(t.raise, t.text))}</div>
    <div><dt>채움 버튼 글자<small>${t.fill} + 흰색</small></dt>${pill(contrast(t.fill, t.onFill))}</div>
    <div><dt>샘플대로 #ff007f를 채움에 쓴다면<small>안 쓴 이유</small></dt>${pill(contrast(PINK, "#ffffff"))}</div>
    <div><dt>칩 글자<small>${t.chip} 면 위</small></dt>${pill(contrast(t.chip, t.chipText))}</div>
    <div><dt>칩이 페이지에서 갈리는 정도<small>OKLab 밝기차</small></dt>
      <dd class="${step(t.chip, t.page) >= 0.06 ? "pass" : "fail"}">${step(t.chip, t.page).toFixed(3)}</dd></div>
    <div><dt>올린 면이 페이지에서 갈리는 정도<small>0.02 미만이면 선으로 버텨야 한다</small></dt>
      <dd class="${step(t.raise, t.page) >= 0.02 ? "pass" : "fail"}">${step(t.raise, t.page).toFixed(3)}</dd></div>
    <div><dt>브랜드 글자<small>${t.brand}</small></dt>${pill(contrast(t.page, t.brand))}</div>
  </dl>`;
}

const mapRows = MAP.map(
  (m) => `<tr><td><b>${m.what}</b></td><td class="src">${m.src}</td><td>${m.ours}</td><td class="why">${m.note}</td></tr>`,
).join("");

const swatches = (key) => {
  const s = { ...SRC[key], brand: SRC.brand, chip: SRC.chip, chipText: SRC.chipText };
  return Object.entries(s)
    .map(([k, v]) => `<div class="sw"><span style="background:${v}"></span><code>${v}</code><small>${k}</small></div>`)
    .join("");
};

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 샘플 스타일 적용</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#0f090c; color:#d8c9cf;
    font:400 14px/1.6 "Pretendard Variable", Pretendard, system-ui, sans-serif; }
  .wrap { max-width:1380px; margin:0 auto; }
  h1 { font-size:23px; margin:0 0 6px; color:#fdf6f9; }
  h2 { font-size:13px; margin:26px 0 8px; color:#a8969c; font-weight:600; }
  .lede { margin:0 0 20px; color:#a8969c; max-width:84ch; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  table { width:100%; border-collapse:collapse; margin:0 0 8px; font-size:12.5px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #24191e; vertical-align:top; }
  th { color:#a8969c; font-weight:600; font-size:11.5px; }
  td.src { color:#ff92c4; font-family:ui-monospace, Menlo, monospace; font-size:11.5px; }
  td.why { color:#a8969c; }

  .swatches { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 18px; }
  .sw { display:flex; align-items:center; gap:6px; background:#191115; border:1px solid #24191e;
    border-radius:8px; padding:5px 9px; font-size:11px; }
  .sw span { width:16px; height:16px; border-radius:5px; border:1px solid rgba(255,255,255,.12); }
  .sw small { color:#8b777e; }

  .frames { display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#a8969c; margin-bottom:8px; }

  /* ── 워시는 페이지 배경에만. 그 위 면은 전부 불투명 단색 — 그게 글래스와 갈리는 지점 ── */
  .screen { position:relative; width:360px; height:740px; overflow:hidden;
    background:var(--page); display:flex; border-radius:22px; border:1px solid #24191e; }
  .wash { position:absolute; inset:0; opacity:var(--wash-op); pointer-events:none;
    background:
      radial-gradient(52% 34% at 4% 2%,   var(--w1) 0%, transparent 72%),
      radial-gradient(60% 30% at 52% 104%, var(--w2) 0%, transparent 74%),
      radial-gradient(46% 34% at 104% 48%, var(--w3) 0%, transparent 72%); }
  .col { position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }

  /* 메인화면 */
  .mainbar { display:flex; align-items:flex-start; justify-content:space-between; padding:14px 16px 0; }
  .circ-btn { display:flex; flex-direction:column; align-items:center; gap:3px; border:0;
    background:transparent; cursor:pointer; font:inherit; font-size:11px; font-weight:500;
    color:var(--muted); padding:0; }
  .circ { position:relative; display:flex; align-items:center; justify-content:center;
    width:42px; height:42px; border-radius:999px; background:var(--raise); color:var(--text);
    border:1px solid var(--line); transition:filter 160ms ease; }
  .circ.av { background:var(--fill); color:var(--on-fill); border-color:transparent; }
  .circ-btn:hover .circ { filter:brightness(1.12); }
  .circ .ic { font-size:16px; line-height:1; }
  .dot { position:absolute; top:7px; right:7px; width:9px; height:9px; border-radius:999px;
    background:var(--brand-big); border:2px solid var(--page); }

  .hero { flex:1; display:flex; flex-direction:column; justify-content:center; gap:12px;
    padding:0 20px; }
  .badge { align-self:flex-start; background:var(--chip); color:var(--chip-text);
    border-radius:999px; padding:6px 13px; font-size:11.5px; font-weight:600; }
  .greet { margin:0; font-size:28px; line-height:1.32; font-weight:400; color:var(--text); }
  .greet b { font-weight:800; color:var(--brand-big); }
  .sub { margin:0; font-size:13.5px; line-height:1.65; color:var(--muted); }

  .chips { display:flex; flex-wrap:wrap; gap:7px; padding:0 16px 10px; }
  .chips.wrap { padding:0; }
  .chip { border:0; border-radius:999px; cursor:pointer; background:var(--chip);
    color:var(--chip-text); font:inherit; font-size:12.5px; font-weight:600;
    padding:0 14px; min-height:32px; white-space:nowrap; transition:filter 160ms ease; }
  .chip:hover { filter:brightness(.96); }

  .composer { margin:0 12px; background:var(--raise); border:1px solid var(--line);
    border-radius:22px; padding:14px 12px 10px; }
  .composer.bottom { margin:8px 12px 12px; }
  .field { font-size:14.5px; color:var(--muted); padding:0 4px 12px; }
  .actions { display:flex; align-items:center; gap:7px; }
  .spacer { flex:1; }
  .act { display:flex; align-items:center; gap:5px; min-height:34px; padding:0 14px; border:0;
    border-radius:999px; cursor:pointer; background:var(--chip); color:var(--chip-text);
    font:inherit; font-size:12.5px; font-weight:600; transition:filter 160ms ease; }
  .act:hover { filter:brightness(.96); }
  .caret { font-size:10px; opacity:.75; }
  .send { display:flex; align-items:center; justify-content:center; width:38px; height:38px;
    border:0; border-radius:999px; cursor:pointer; background:var(--fill); color:var(--on-fill);
    font-size:17px; font-weight:700; transition:filter 160ms ease; }
  .send:hover { filter:brightness(1.08); }

  .legal { position:relative; margin:0; padding:12px 20px 16px; text-align:center;
    font-size:11.5px; line-height:1.55; color:var(--muted); }

  /* 대화 화면 */
  .topbar { display:flex; align-items:center; gap:2px; padding:6px 8px;
    background:var(--raise); border-bottom:1px solid var(--line); }
  .bar-btn { display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:1px; min-width:44px; height:40px; border:0; border-radius:999px; cursor:pointer;
    background:transparent; color:var(--muted); font:inherit; font-size:10px; font-weight:500;
    transition:background 160ms ease; }
  .bar-btn:hover { background:var(--chip); color:var(--chip-text); }
  .bar-btn .ic { font-size:14px; line-height:1; }
  .title { flex:1; text-align:center; font-size:15px; font-weight:700; color:var(--text);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  .status { display:flex; align-items:center; justify-content:space-between; gap:10px;
    min-height:38px; padding:0 12px; background:var(--raise); border-bottom:1px solid var(--line); }
  .status-text { margin:0; font-size:12.5px; color:var(--muted); }
  .status-text b { color:var(--text); font-weight:700; }
  .btn-fill { border:0; border-radius:999px; cursor:pointer; background:var(--fill);
    color:var(--on-fill); font:inherit; font-weight:700; transition:filter 160ms ease; }
  .btn-fill.sm { min-height:28px; padding:0 14px; font-size:12px; }

  .stream { flex:1; overflow:hidden; padding:12px; display:flex; flex-direction:column; gap:12px; }
  .msg { max-width:88%; }
  .msg.me { align-self:flex-end; max-width:82%; }
  .who { margin:0 0 5px; font-size:11.5px; color:var(--muted); display:flex; align-items:center; gap:6px; }
  .avatar { display:flex; align-items:center; justify-content:center; width:20px; height:20px;
    border-radius:999px; background:var(--fill); color:var(--on-fill); font-size:10px; }
  .body { margin:0; font-size:14.5px; line-height:1.6; color:var(--text);
    background:var(--raise); border:1px solid var(--line); border-radius:18px; padding:11px 14px; }
  .msg.me .body { background:var(--fill); color:var(--on-fill); border:0; font-weight:600; }
  .card-name { margin:0 0 6px; font-size:22px; font-weight:800; color:var(--brand-big); }

  .facts { margin:0; display:grid; gap:5px; width:360px; }
  .facts .head { font-size:12px; color:#fdf6f9; font-weight:700; margin-bottom:2px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #24191e; padding-top:5px; }
  .facts dt { font-size:12px; color:#a8969c; }
  .facts dt small { display:block; opacity:.8; font-size:11px; color:#8b777e; }
  .facts dd { margin:0; font-size:12px; font-weight:700; border-radius:999px; padding:2px 8px;
    font-variant-numeric:tabular-nums; }
  .facts dd.pass { background:#1e4023; color:#b9f0c0; }
  .facts dd.fail { background:#4a1f1c; color:#ffc9c4; }

  .factrow { display:flex; gap:20px; flex-wrap:wrap; margin-top:20px; }
  footer { margin-top:28px; color:#a8969c; font-size:12px; max-width:84ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>샘플 스타일 적용 — 타연 화면에</h1>
  <p class="lede">
    <code>asset/Screen/sample_001·002.png</code>를 sharp로 픽셀 샘플링했다. 눈대중이 아니다.
    <b>가장 큰 발견은 샘플의 핑크가 사실상 우리 핑크라는 것</b>이다 —
    <code>#ff1e9a</code>(L .660 C .260 H -4.9)와 <code>#ff007f</code>(L .645 C .260 H 2.8)는
    채도가 같고 색조만 7.7° 떨어져 있다. 새 색을 가져올 게 아니라 <b>우리 색을 그렇게 쓰면
    된다</b>는 뜻이다.
    <br><br>
    배경 워시는 예전 아우로라 시도와 형태가 비슷한데 결정적으로 다르다.
    <b>워시는 페이지 배경에만 있고, 그 위에 놓이는 면은 전부 불투명 단색이다.</b>
    blur도 반투명 패널도 컬러 그림자도 없다. 글래스로 읽혔던 건 워시 때문이 아니라
    그 위에 반투명 재질을 얹었기 때문이었다. 내가 원인을 잘못 짚고 색과 온기, 큰 글자까지
    같이 걷어냈다.
  </p>

  <h2>실측 — 다크</h2>
  <div class="swatches">${swatches("dark")}</div>
  <h2>라이트</h2>
  <div class="swatches">${swatches("light")}</div>

  <h2>무엇을 가져왔고 무엇을 바꿨나</h2>
  <table>
    <thead><tr><th>요소</th><th>샘플 실측</th><th>적용</th><th>비고</th></tr></thead>
    <tbody>${mapRows}</tbody>
  </table>

  <h2>시안</h2>
  <div class="frames">
    ${frame("dark", "main")}
    ${frame("light", "main")}
    ${frame("dark", "chat")}
    ${frame("light", "chat")}
  </div>

  <div class="factrow">${facts("dark")}${facts("light")}</div>

  <footer>
    <b>샘플이 통과 못 하는 자리 하나.</b> 채움 버튼이 <code>#ff1e9a</code>에 흰 글자인데
    3.56이다. 우리 <code>#ff007f</code>로 바꿔도 3.78로, 둘 다 본문 기준 4.5에 못 미친다.
    채움만 <code>${PINK_FILL}</code>(4.52)로 한 단계 내렸다 — 육안 차이는 거의 없다.
    악센트·브랜드 글자에는 <code>#ff007f</code>를 그대로 쓴다.
    <br><br>
    라이트의 올린 면 <code>#fef6f9</code>는 페이지와 밝기차가 0.018뿐이다. 샘플도 마찬가지고,
    그래서 <b>선으로 버틴다</b>. 선을 빼면 카드가 사라진다.
    <br><br>
    생성: <code>node doc/design/build-sample-style-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/sample-style-mockup.html", html);
console.log("wrote doc/design/sample-style-mockup.html");
for (const key of Object.keys(T)) {
  const t = T[key];
  console.log(
    `${t.label.padEnd(6)} 본문 ${fmt(contrast(t.page, t.text))}  보조 ${fmt(contrast(t.page, t.muted))}` +
      `  채움글자 ${fmt(contrast(t.fill, t.onFill))}  칩글자 ${fmt(contrast(t.chip, t.chipText))}` +
      `  칩분리 ${step(t.chip, t.page).toFixed(3)}  올린면분리 ${step(t.raise, t.page).toFixed(3)}`,
  );
}
