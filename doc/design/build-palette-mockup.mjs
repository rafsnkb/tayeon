// 색 계단(build-point-ramp.mjs)을 역할에 배정하고, 라이트/다크 목업 HTML을 만든다.
//   node doc/design/build-palette-mockup.mjs   →  doc/design/point-palette-mockup.html
//
// 화면에 찍히는 대비 수치는 전부 여기서 계산한다. 손으로 적으면 색을 조정했을 때 숫자만 옛것으로
// 남는데, 그게 정확히 "검증했다고 적혀 있지만 틀린" 상태를 만든다.

import { writeFileSync } from "node:fs";
import { RAMP, contrast } from "./build-point-ramp.mjs";

const THEMES = {
  light: {
    label: "라이트",
    bg: "#f7f4fb",
    surface: "#ffffff",
    boldText: "#1a0f2e",
    text: "#6b5c84",
    border: "#e0d5f0",
    chipFill: "#6b5c84",
    chipMutedText: "#cabfd9",
    // 밝은 면 위에서는 칠을 한 단계 내려야 흰 글씨가 산다. 500은 흰 글씨 3.78로 미달.
    fill: RAMP[600],
    fillHover: RAMP[700],
    fillPressed: RAMP[800],
    onFill: "#ffffff",
    link: RAMP[700],
    tint: RAMP[50],
    onTint: RAMP[800],
    line: RAMP[500],
  },
  dark: {
    label: "다크",
    bg: "#141517",
    surface: "#1c1d21",
    boldText: "#f3f4f6",
    text: "#8e95a3",
    border: "#2a2c31",
    chipFill: "#27292d",
    chipMutedText: "#7b8089",
    // 어두운 면 위에서 칠을 더 어둡게 하면 배경에 묻힌다(700은 배경 대비 2.50). 규칙대로
    // 밝고 덜 진한 변형을 쓰고 글씨를 어둡게 뒤집는다 — Material의 on-primary와 같은 방식.
    fill: RAMP[400],
    fillHover: RAMP[300],
    fillPressed: RAMP[200],
    onFill: "#141517",
    link: RAMP[400],
    tint: RAMP[900],
    onTint: RAMP[200],
    line: RAMP[500],
  },
};

const CURRENT = {
  light: { fill: "#ff007f", onFill: "#ffffff", link: "#ff007f" },
  dark: { fill: "#ff007f", onFill: "#ffffff", link: "#ff007f" },
};

const fmt = (n) => n.toFixed(2);
const verdict = (n, floor) => (n >= floor ? "pass" : "fail");
const chip = (n, floor = 4.5) =>
  `<span class="ratio ${verdict(n, floor)}">${fmt(n)}<i>${n >= floor ? "✓" : "✗"}</i></span>`;

function swatches() {
  return Object.entries(RAMP)
    .map(
      ([step, hex]) => `
      <div class="sw">
        <span style="background:${hex}"></span>
        <b>${step}</b>
        <code>${hex}</code>
      </div>`,
    )
    .join("");
}

function themeBlock(key) {
  const t = THEMES[key];
  const c = CURRENT[key];
  const onFill = contrast(t.fill, t.onFill);
  const onFillNow = contrast(c.fill, c.onFill);
  const linkNow = contrast(c.link, t.bg);
  const linkNew = contrast(t.link, t.bg);
  const fillOnBg = contrast(t.fill, t.bg);
  const lineOnBg = contrast(t.line, t.bg);
  const tintOnSurface = contrast(t.tint, t.surface);
  const onTint = contrast(t.tint, t.onTint);

  return `
  <section class="theme" style="
      --bg:${t.bg}; --surface:${t.surface}; --bold:${t.boldText}; --muted:${t.text};
      --line:${t.border}; --chip:${t.chipFill}; --chip-muted:${t.chipMutedText};
      --fill:${t.fill}; --fill-hover:${t.fillHover}; --fill-pressed:${t.fillPressed};
      --on-fill:${t.onFill}; --link:${t.link}; --tint:${t.tint}; --on-tint:${t.onTint};
      --accent-line:${t.line};">
    <header class="theme-head">
      <h2>${t.label}</h2>
      <p>배경 <code>${t.bg}</code></p>
    </header>

    <div class="card">
      <h3>주요 버튼</h3>
      <div class="row">
        <button class="primary">이용권 구입하기</button>
        <button class="primary hover">호버</button>
        <button class="primary pressed">눌림</button>
        <button class="primary" disabled>비활성</button>
      </div>
      <dl class="facts">
        <div><dt>칠 <code>${t.fill}</code> 위 글자</dt><dd>${chip(onFill)}</dd></div>
        <div><dt>칠이 배경에서 떠 보이는 정도<small>비텍스트 3:1</small></dt><dd>${chip(fillOnBg, 3)}</dd></div>
        <div><dt>비활성 라벨 <code>${t.chipMutedText}</code><small>비활성 컨트롤은 WCAG 예외</small></dt><dd><span class="ratio note">${fmt(contrast(t.chipFill, t.chipMutedText))}</span></dd></div>
        <div class="before"><dt>지금 <code>${c.fill}</code> + 흰 글씨</dt><dd>${chip(onFillNow)}</dd></div>
      </dl>
    </div>

    <div class="card">
      <h3>보조 · 링크 · 강조</h3>
      <div class="row">
        <button class="secondary">친구 초대하기</button>
        <a class="link" href="#">이용약관</a>
        <span class="badge">환불 가능</span>
      </div>
      <div class="tint">
        <b>최초 가입 시 무료 4회 지급</b>
        <span>브랜드 색을 옅게 깐 안내 면</span>
      </div>
      <dl class="facts">
        <div><dt>링크 <code>${t.link}</code></dt><dd>${chip(linkNew)}</dd></div>
        <div><dt>틴트 면 위 글자</dt><dd>${chip(onTint)}</dd></div>
        <div><dt>테두리 <code>${t.line}</code><small>비텍스트 3:1</small></dt><dd>${chip(lineOnBg, 3)}</dd></div>
        <div class="before"><dt>지금 링크 <code>${c.link}</code></dt><dd>${chip(linkNow)}</dd></div>
      </dl>
    </div>

    <div class="card">
      <h3>대화 화면 조각</h3>
      <div class="chatlike">
        <div class="bubble">밝고 순수한 마음으로 당신의 이야기를 들어드릴게요.</div>
        <div class="composer">
          <span class="ph">궁금한 것을 물어보세요</span>
          <div class="composer-row">
            <span class="chipbtn">원 카드 모드</span>
            <button class="send">↑</button>
          </div>
        </div>
      </div>
      <dl class="facts">
        <div><dt>틴트 면이 카드에서 떠 보이는 정도<small>면 구분일 뿐 정보를 싣지 않음</small></dt><dd><span class="ratio note">${fmt(tintOnSurface)}</span></dd></div>
      </dl>
    </div>
  </section>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 키 컬러 #ff007f 기반 팔레트 시안</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 64px;
    font: 500 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #eceaf2; color: #1a0f2e;
  }
  .wrap { max-width: 1180px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .lede { margin: 0 0 24px; color: #5b5470; max-width: 70ch; }
  .lede code, .facts code, .sw code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 12px; }

  .ramp { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 28px; }
  .sw { width: 92px; }
  .sw span { display: block; height: 52px; border-radius: 10px; border: 1px solid rgba(0,0,0,.08); }
  .sw b { display: block; font-size: 12px; margin-top: 6px; }
  .sw code { color: #5b5470; }

  .themes { display: grid; gap: 20px; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); }
  .theme { background: var(--bg); color: var(--bold); border-radius: 20px; padding: 18px; border: 1px solid rgba(0,0,0,.1); }
  .theme-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 14px; }
  .theme-head h2 { font-size: 16px; margin: 0; }
  .theme-head p { margin: 0; color: var(--muted); font-size: 12px; }

  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
  .card h3 { font-size: 13px; margin: 0 0 12px; color: var(--muted); font-weight: 600; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }

  button { font: inherit; font-weight: 700; border: 0; border-radius: 999px; padding: 11px 18px; cursor: pointer; }
  .primary { background: var(--fill); color: var(--on-fill); }
  .primary.hover { background: var(--fill-hover); }
  .primary.pressed { background: var(--fill-pressed); }
  .primary[disabled] { background: var(--chip); color: var(--chip-muted); cursor: default; }
  /* 테두리만 있는 버튼은 쓰지 않는다(2026-09-22, 사용자 결정) — 보조 버튼도 면을 채운다. */
  .secondary { background: var(--chip); color: #fff; }
  .link { color: var(--link); text-decoration: underline; font-weight: 600; }
  .badge { background: var(--fill); color: var(--on-fill); border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }

  .tint { background: var(--tint); color: var(--on-tint); border-radius: 14px; padding: 12px 14px; margin-bottom: 14px; }
  .tint b { display: block; font-size: 13px; }
  .tint span { font-size: 12px; opacity: .85; }

  .chatlike { background: var(--bg); border-radius: 14px; padding: 12px; margin-bottom: 14px; }
  .bubble { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; font-size: 13px; margin-bottom: 40px; color: var(--bold); }
  .composer { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 12px; }
  .ph { color: var(--muted); font-size: 13px; }
  .composer-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
  .chipbtn { background: var(--chip); color: #fff; border-radius: 999px; padding: 8px 16px; font-size: 12px; font-weight: 600; }
  .send { background: var(--fill); color: var(--on-fill); width: 38px; height: 38px; padding: 0; border-radius: 50%; font-size: 16px; }

  .facts { margin: 0; display: grid; gap: 6px; }
  .facts > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; border-top: 1px solid var(--line); padding-top: 6px; }
  .facts dt { font-size: 12px; color: var(--muted); }
  .facts dt small { display: block; opacity: .7; font-size: 11px; }
  .facts dd { margin: 0; }
  .facts .before dt, .facts .before dd { opacity: .75; }
  .facts .before dt::before { content: "이전 · "; }

  .ratio { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 12px; border-radius: 999px; padding: 2px 8px; }
  .ratio i { font-style: normal; margin-left: 4px; }
  .ratio.pass { background: #dff3e0; color: #1b5e20; }
  .ratio.fail { background: #fbe0de; color: #9b1c16; }
  .ratio.note { background: rgba(127,127,127,.18); color: inherit; }

  footer { margin-top: 28px; color: #5b5470; font-size: 12px; max-width: 70ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>키 컬러 #ff007f 기반 팔레트 시안</h1>
  <p class="lede">
    브랜드 핑크를 OKLCH 색조 계단으로 펼쳐, 자리마다 다른 단계를 쓴다. 색상(H 2.8°)과 채도는
    그대로 두고 명도만 움직이므로 전부 “같은 분홍”으로 읽힌다. 아래 수치는 전부 계산된 값이고,
    <b>4.5</b>는 본문 글자, <b>3.0</b>은 테두리·아이콘 같은 비텍스트 기준이다.
  </p>

  <div class="ramp">${swatches()}</div>

  <div class="themes">
    ${themeBlock("light")}
    ${themeBlock("dark")}
  </div>

  <footer>
    라이트는 칠을 한 단계 내려(600) 흰 글씨를 살리고, 다크는 반대로 밝은 단계(400)에 어두운
    글씨를 얹는다 — 어두운 배경에서 칠까지 어두우면 버튼이 배경에 묻히기 때문이다. 로고와 브랜드
    식별에 쓰는 원래 #ff007f(500)는 그대로 두고, 테두리·포커스 링처럼 비텍스트 요소에만 쓴다.
    <br><br>
    생성: <code>node doc/design/build-palette-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/point-palette-mockup.html", html);
console.log("wrote doc/design/point-palette-mockup.html");

for (const key of Object.keys(THEMES)) {
  const t = THEMES[key];
  console.log(
    `${t.label.padEnd(4)} 칠 ${t.fill} + 글자 ${t.onFill} → ${fmt(contrast(t.fill, t.onFill))}` +
      `   (지금 ${CURRENT[key].fill} + ${CURRENT[key].onFill} → ${fmt(contrast(CURRENT[key].fill, CURRENT[key].onFill))})`,
  );
}
