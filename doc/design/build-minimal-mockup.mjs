// Minimal 시안 — uupm.cc/demo/ai-writing-assistant의 실제 구현을 기준으로 한다.
//   node doc/design/build-minimal-mockup.mjs  →  doc/design/minimal-mockup.html
//
// 처음엔 styles.csv의 "Minimalism & Swiss Style" 문서만 보고 만들었는데(모서리 0, 그림자 없음,
// 말풍선 제거), 사용자가 가리킨 건 그 데모였고 완전히 다른 물건이었다. 그래서 데모에서 값을
// 직접 뽑아 옮긴다:
//
//   --bg      #faf5ff   액센트를 5%쯤 깐 면. 흰색이 아니다.
//   --text    #1e1b4b   순검정이 아니라 액센트 쪽으로 기운 짙은 색.
//   accent    #7c3aed  /  gradient 135deg → #a78bfa
//   card      radius 16px, box-shadow rgba(accent,.15) 0 0 40px   ← 회색 그림자가 아니라 글로우
//   button    radius 12px, padding 14px 32px
//   ghost     2px solid #ddd6fe (액센트의 옅은 톤)
//   muted     #6b7280
//
// 여기서 액센트만 타연의 자홍 → 코랄로 바꾼다. 중성색도 전부 그 쪽으로 기울여 다시 만든다 —
// 보라 데모의 회색을 그대로 쓰면 코랄과 따로 논다.

import { writeFileSync } from "node:fs";
import { contrast } from "./build-point-ramp.mjs";

const THEMES = {
  light: {
    label: "라이트",
    // 데모의 #faf5ff가 액센트를 옅게 깐 면이듯, 코랄을 같은 농도로 깐 값.
    page: "#fff5f3",
    surface: "#ffffff",
    // 데모의 #1e1b4b(보라 쪽으로 기운 짙은 색)에 대응하는 자홍 쪽 짙은 색.
    text: "#3b0f1e",
    muted: "#7c6b6e",
    line: "#f5ddd6",
    // 보조 버튼 테두리 — 데모의 #ddd6fe 자리.
    ghostLine: "#f7c9bd",
    chip: "#ffe9e3",
    gradFrom: "#c2005f",
    gradTo: "#d23c21",
    onGrad: "#ffffff",
    accentText: "#ac0053",
    glow: "rgba(194, 0, 95, .15)",
  },
  dark: {
    label: "다크",
    page: "#150d11",
    surface: "#20161a",
    text: "#fdf2ef",
    muted: "#b8a29f",
    line: "#37262c",
    ghostLine: "#5a3a33",
    chip: "#2e1f24",
    gradFrom: "#ff8a6b",
    gradTo: "#ff5993",
    onGrad: "#150d11",
    accentText: "#ff9d86",
    glow: "rgba(255, 105, 140, .18)",
  },
};

const fmt = (n) => n.toFixed(2);
const chip = (n, floor = 4.5) =>
  `<span class="ratio ${n >= floor ? "pass" : "fail"}">${fmt(n)}<i>${n >= floor ? "✓" : "✗"}</i></span>`;

function frame(key, variant) {
  const t = THEMES[key];
  const desktop = variant === "desktop";
  const onGrad = Math.min(contrast(t.gradFrom, t.onGrad), contrast(t.gradTo, t.onGrad));

  const style = `
      --page:${t.page}; --surface:${t.surface}; --text:${t.text}; --muted:${t.muted};
      --line:${t.line}; --ghost-line:${t.ghostLine}; --chip:${t.chip};
      --grad:linear-gradient(30deg in oklab, ${t.gradFrom}, ${t.gradTo});
      --on-grad:${t.onGrad}; --accent-text:${t.accentText}; --glow:${t.glow};`;

  return `
  <figure class="frame ${desktop ? "desktop" : ""}">
    <figcaption>${t.label}${desktop ? " · 데스크톱" : " · 모바일"}</figcaption>
    <div class="screen" style="${style}">
      ${desktop ? `
      <aside class="rail">
        <div class="wordmark">타연</div>
        <p class="rail-label">최근 대화</p>
        <nav>
          <a class="room active">이직 고민 상담</a>
          <a class="room">올해 연애운</a>
          <a class="room">새 대화</a>
        </nav>
        <div class="rail-bottom">
          <button class="btn-accent">이용권 구입하기</button>
          <button class="btn-ghost">새 대화</button>
        </div>
      </aside>` : ""}

      <div class="col">
        <header class="topbar">
          <span class="ic">☰</span>
          <b>새 대화</b>
          <span class="pill">스탠다드 · 14회</span>
        </header>

        <div class="stream">
          <div class="msg">
            <span class="avatar"></span>
            <div class="card">
              <p class="who">루미</p>
              <p class="body">안녕하세요. 밝고 순수한 마음으로 당신의 이야기를 들어드릴게요.</p>
            </div>
          </div>

          <div class="msg me">
            <div class="card me-card">올해 이직해도 괜찮을까?</div>
          </div>

          <div class="msg">
            <span class="avatar"></span>
            <div class="card glow">
              <p class="who">원 카드</p>
              <h4 class="card-name">완드 7</h4>
              <p class="body">
                지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
                버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.
              </p>
              <div class="card-foot">
                <span>다시 뽑기</span><span>공유</span>
              </div>
            </div>
          </div>

          <div class="suggest">
            <button>지금 준비해야 할 건 뭘까?</button>
            <button>올해 안에 결정해도 될까?</button>
          </div>
        </div>

        <div class="composer">
          <div class="modes">
            <button class="seg on">원 카드</button>
            <button class="seg">쓰리 카드</button>
            <button class="seg">양자택일</button>
            <button class="seg">켈틱</button>
          </div>
          <div class="input-row">
            <span class="ph">궁금한 것을 물어보세요</span>
            <button class="send">보내기</button>
          </div>
        </div>
        <p class="footnote"><a>회사 정보</a></p>
      </div>
    </div>

    <dl class="facts">
      <div><dt>본문 <small>카드 <code>${t.surface}</code> 위</small></dt><dd>${chip(contrast(t.surface, t.text))}</dd></div>
      <div><dt>보조 글자</dt><dd>${chip(contrast(t.surface, t.muted))}</dd></div>
      <div><dt>액센트 글자</dt><dd>${chip(contrast(t.surface, t.accentText))}</dd></div>
      <div><dt>액센트 면 위 라벨<small>양 끝 중 불리한 쪽</small></dt><dd>${chip(onGrad)}</dd></div>
      <div><dt>카드가 페이지에서 떠 보이는 정도<small>면끼리 차이 + 글로우가 보강 · 참고값</small></dt><dd><span class="ratio note">${fmt(contrast(t.surface, t.page))}</span></dd></div>
    </dl>
  </figure>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — Minimal (ai-writing-assistant 기준) · 자홍 → 코랄</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#efe7e4; color:#3b0f1e;
    font:400 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1320px; margin:0 auto; }
  h1 { font-size:26px; font-weight:700; letter-spacing:-.02em; margin:0 0 6px; }
  .lede { margin:0 0 8px; color:#7c6b6e; max-width:76ch; }
  .changes { margin:0 0 26px; padding-left:18px; color:#7c6b6e; max-width:76ch; }
  .changes li { margin-bottom:4px; }
  .changes b { color:#3b0f1e; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  .frames { display:flex; gap:22px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#7c6b6e; margin-bottom:8px; }

  .screen { position:relative; width:390px; height:760px; overflow:hidden;
    background:var(--page); display:flex; border-radius:20px;
    box-shadow:0 14px 40px rgba(59,15,30,.18); }
  .frame.desktop .screen { width:820px; }

  .col { position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }

  .rail { width:238px; display:flex; flex-direction:column; padding:20px 16px;
    background:var(--surface); border-right:1px solid var(--line); }
  .wordmark { font-size:19px; font-weight:700; letter-spacing:-.02em; color:var(--text); margin-bottom:24px; }
  .rail-label { font-size:11px; color:var(--muted); margin:0 0 8px; }
  .rail nav { display:flex; flex-direction:column; gap:4px; flex:1; }
  .room { display:block; padding:10px 12px; font-size:13px; color:var(--muted);
    border-radius:12px; transition:background 220ms ease, color 220ms ease; }
  .room:hover { background:var(--chip); color:var(--text); }
  .room.active { background:var(--chip); color:var(--text); font-weight:600; }
  .rail-bottom { display:flex; flex-direction:column; gap:8px; }

  .topbar { display:flex; align-items:center; gap:10px; height:58px; padding:0 16px;
    background:var(--surface); border-bottom:1px solid var(--line); }
  .topbar .ic { color:var(--text); font-size:15px; }
  .topbar b { flex:1; text-align:center; color:var(--text); font-size:15px; font-weight:600; }
  /* 데모 상단의 알약 배지 자리 */
  .pill { font-size:11px; font-weight:600; color:var(--accent-text); background:var(--chip);
    border-radius:999px; padding:5px 11px; white-space:nowrap; }

  .stream { flex:1; overflow:hidden; padding:20px 16px 180px; display:flex;
    flex-direction:column; gap:16px; }

  .msg { display:flex; gap:10px; align-items:flex-start; }
  .msg.me { justify-content:flex-end; }
  .avatar { width:30px; height:30px; border-radius:10px; background:var(--grad); flex:none; }

  /* 데모의 카드: 흰 면, radius 16, 회색 그림자가 아니라 액센트 글로우 */
  .card { background:var(--surface); border-radius:16px; padding:14px 16px;
    box-shadow:0 0 24px var(--glow); max-width:88%; }
  .card.glow { box-shadow:0 0 40px var(--glow); }
  .me-card { background:var(--grad); color:var(--on-grad); font-weight:600; max-width:80%; }
  .who { margin:0 0 4px; font-size:11px; color:var(--muted); }
  .body { margin:0; font-size:13.5px; line-height:1.7; color:var(--text); }
  .card-name { margin:2px 0 8px; font-size:22px; font-weight:700; letter-spacing:-.02em; color:var(--text); }
  .card-foot { display:flex; gap:14px; margin-top:12px; padding-top:10px;
    border-top:1px solid var(--line); font-size:11px; color:var(--muted); }

  .suggest { display:flex; flex-direction:column; gap:8px; }
  .suggest button { text-align:left; font:inherit; font-size:12.5px; cursor:pointer;
    background:var(--surface); color:var(--accent-text); border:2px solid var(--ghost-line);
    border-radius:12px; padding:10px 14px; transition:background 220ms ease, transform 220ms ease; }
  .suggest button:hover { background:var(--chip); transform:translateY(-1px); }

  .composer { position:absolute; left:16px; right:16px; bottom:30px; }
  .modes { display:flex; gap:6px; margin-bottom:8px; }
  .seg { flex:1; font:inherit; font-size:11px; font-weight:600; cursor:pointer; border:0;
    border-radius:12px; padding:8px 0; background:var(--surface); color:var(--muted);
    box-shadow:0 0 16px var(--glow); transition:color 220ms ease; }
  .seg:hover { color:var(--text); }
  .seg.on { background:var(--grad); color:var(--on-grad); }
  .input-row { display:flex; align-items:center; gap:8px; background:var(--surface);
    border-radius:16px; padding:8px 8px 8px 16px; box-shadow:0 0 28px var(--glow); }
  .ph { flex:1; color:var(--muted); font-size:13px; }
  .send { font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; border:0;
    border-radius:12px; padding:11px 20px; background:var(--grad); color:var(--on-grad);
    transition:transform 220ms ease; }
  .send:hover { transform:translateY(-1px); }

  .btn-accent, .btn-ghost { font:inherit; font-size:12.5px; font-weight:700; cursor:pointer;
    border-radius:12px; padding:12px; transition:transform 220ms ease, background 220ms ease; }
  .btn-accent { border:0; background:var(--grad); color:var(--on-grad); }
  .btn-ghost { background:none; border:2px solid var(--ghost-line); color:var(--accent-text); font-weight:600; }
  .btn-accent:hover, .btn-ghost:hover { transform:translateY(-1px); }

  .footnote { position:absolute; left:0; right:0; bottom:0; margin:0; padding:6px 0 10px; text-align:center; }
  .footnote a { font-size:11px; color:var(--muted); text-decoration:underline; }

  @media (prefers-reduced-motion: reduce) { * { transition-duration:1ms !important; } }

  .facts { margin:12px 0 0; display:grid; gap:5px; width:390px; }
  .frame.desktop .facts { width:820px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #d9cfcb; padding-top:5px; }
  .facts dt { font-size:12px; color:#7c6b6e; }
  .facts dt small { display:block; opacity:.8; font-size:11px; }
  .facts dd { margin:0; }
  .ratio { font-variant-numeric:tabular-nums; font-weight:700; font-size:12px;
    border-radius:999px; padding:2px 8px; }
  .ratio i { font-style:normal; margin-left:4px; }
  .ratio.pass { background:#d7f0da; color:#12451c; }
  .ratio.fail { background:#f7d9d5; color:#7a1a14; }
  .ratio.note { background:rgba(120,100,100,.16); color:#3b0f1e; }

  footer { margin-top:30px; color:#7c6b6e; font-size:12px; max-width:76ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Minimal · <code>uupm.cc/demo/ai-writing-assistant</code> 기준 · 자홍 → 코랄</h1>
  <p class="lede">
    앞선 판은 <code>styles.csv</code>의 “Minimalism &amp; Swiss Style” 문서만 보고 만들어서
    모서리 0, 그림자 없음, 말풍선 제거로 갔다. 가리키신 데모는 정반대였다 — 이번엔 그 화면에서
    값을 직접 뽑아 옮기고, 액센트만 코랄로 바꿨다.
  </p>
  <ul class="changes">
    <li><b>그림자가 회색이 아니라 액센트 글로우다.</b> 데모의 <code>rgba(124,58,237,.15) 0 0 40px</code> 자리에 코랄을 넣었다. 이게 이 스타일의 서명이다.</li>
    <li><b>순흰·순검정을 안 쓴다.</b> 면은 <code>#fff5f3</code>, 글자는 <code>#3b0f1e</code> — 전부 액센트 쪽으로 살짝 기울인 중성색이다. 보라 데모의 회색을 그대로 가져오면 코랄과 따로 논다.</li>
    <li><b>모서리는 12px(버튼) / 16px(카드).</b> 각지지도 않고 알약도 아니다.</li>
    <li><b>보조 버튼은 2px 테두리</b>에 액센트의 옅은 톤(<code>#f7c9bd</code>). 데모의 <code>#ddd6fe</code> 자리다.</li>
    <li><b>카드 하단에 액션 줄</b>을 뒀다(다시 뽑기 / 공유) — 데모의 Copy·Regenerate·79 words 줄과 같은 구조다.</li>
    <li>이건 테두리 버튼 제거 결정과 부딪힌다. 데모의 보조 버튼이 그 형태라 원본대로 두고 표시해둔다.</li>
  </ul>

  <div class="frames">
    ${frame("light", "mobile")}
    ${frame("dark", "mobile")}
    ${frame("dark", "desktop")}
  </div>

  <footer>
    데모에서 실제로 뽑은 값: <code>--bg #faf5ff</code>, <code>--text #1e1b4b</code>,
    accent <code>#7c3aed</code>, gradient <code>135deg → #a78bfa</code>,
    card <code>radius 16 / shadow rgba(accent,.15) 0 0 40px</code>,
    button <code>radius 12 / padding 14 32</code>, ghost <code>2px solid #ddd6fe</code>,
    muted <code>#6b7280</code>, font DM Sans.
    <br><br>
    데모도 액센트를 그라데이션으로 쓴다(<code>135deg</code>, 액센트 → 더 밝은 액센트). 타연은
    자홍 → 코랄을 30도로 쓰므로 방향만 다르고 발상은 같다.
    <br><br>
    생성: <code>node doc/design/build-minimal-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/minimal-mockup.html", html);
console.log("wrote doc/design/minimal-mockup.html");
for (const [, t] of Object.entries(THEMES)) {
  console.log(
    `${t.label.padEnd(4)} 본문 ${fmt(contrast(t.surface, t.text))}  보조 ${fmt(contrast(t.surface, t.muted))}` +
      `  액센트글자 ${fmt(contrast(t.surface, t.accentText))}` +
      `  액센트면 ${fmt(Math.min(contrast(t.gradFrom, t.onGrad), contrast(t.gradTo, t.onGrad)))}` +
      `  카드-페이지 ${fmt(contrast(t.surface, t.page))}`,
  );
}
