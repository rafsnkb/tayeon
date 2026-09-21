// Minimalism & Swiss Style 시안 (자홍 → 코랄).
//   node doc/design/build-minimal-mockup.mjs  →  doc/design/minimal-mockup.html
//
// 스펙을 그대로 따른다. 타협하면 이 스타일은 아무것도 아닌 게 된다:
//   --border-radius: 0px     타연의 rounded-[28px] / rounded-full 언어를 전부 버린다
//   --shadow: none           띄우지 않고 선으로만 나눈다
//   --accent-color: single   액센트는 하나. 코랄 그라데이션만 쓰고 그 외는 전부 무채색
//   --spacing: 2rem          여백이 장식을 대신한다
//   그리드 12~16열, 타이포 위계 명확, 호버 200~250ms
//
// 앞선 두 시안과 가장 크게 갈리는 점: 배경에 아무 일도 일어나지 않는다. 오로라도 유리도 없고,
// 화면을 끌고 가는 건 여백과 글자 크기다. 그래서 접근성 위험도 셋 중 유일하게 risk:low다 —
// 반투명도 흐르는 배경도 없으니 대비가 애초에 흔들릴 구석이 없다.

import { writeFileSync } from "node:fs";
import { contrast } from "./build-point-ramp.mjs";

const THEMES = {
  light: {
    label: "라이트",
    page: "#ffffff",
    // Swiss의 중성색. 베이지 계열을 아주 옅게만 써서 면을 나눈다.
    alt: "#f5f3f0",
    line: "#1a1a1a",
    lineSoft: "#d8d5d0",
    text: "#0a0a0a",
    muted: "#6b6661",
    gradFrom: "#c2005f",
    gradTo: "#d23c21",
    onGrad: "#ffffff",
    accentText: "#ac0053",
  },
  dark: {
    label: "다크",
    page: "#0a0a0a",
    alt: "#141414",
    line: "#f0efed",
    lineSoft: "#2e2e2e",
    text: "#f7f6f4",
    muted: "#9d9892",
    gradFrom: "#ff8a6b",
    gradTo: "#ff5993",
    onGrad: "#0a0a0a",
    accentText: "#ff8a6b",
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
      --page:${t.page}; --alt:${t.alt}; --line:${t.line}; --line-soft:${t.lineSoft};
      --text:${t.text}; --muted:${t.muted}; --accent-text:${t.accentText};
      --grad:linear-gradient(30deg in oklab, ${t.gradFrom}, ${t.gradTo}); --on-grad:${t.onGrad};`;

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
          <button class="btn-plain">새 대화</button>
        </div>
      </aside>` : ""}

      <div class="col">
        <header class="topbar">
          <span class="ic">MENU</span>
          <span class="meta">스탠다드 &nbsp;/&nbsp; 남은 14회</span>
        </header>

        <div class="stream">
          <p class="stamp">오늘</p>
          <div class="msg">
            <p class="who">루미</p>
            <p class="body">안녕하세요. 밝고 순수한 마음으로 당신의 이야기를 들어드릴게요.</p>
          </div>
          <div class="msg me">
            <p class="body">올해 이직해도 괜찮을까?</p>
          </div>
          <div class="msg">
            <p class="who">루미 &nbsp;/&nbsp; 원 카드</p>
            <h4 class="card-name">완드 7<span>현재</span></h4>
            <p class="body">
              지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
              버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.
            </p>
          </div>
          <ul class="suggest">
            <li><button>지금 준비해야 할 건 뭘까?</button></li>
            <li><button>올해 안에 결정해도 될까?</button></li>
          </ul>
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
      <div><dt>본문 <small>면 <code>${t.page}</code> — 배경에 아무 일도 없으므로 고정</small></dt><dd>${chip(contrast(t.page, t.text))}</dd></div>
      <div><dt>보조 글자</dt><dd>${chip(contrast(t.page, t.muted))}</dd></div>
      <div><dt>액센트 글자</dt><dd>${chip(contrast(t.page, t.accentText))}</dd></div>
      <div><dt>액센트 면 위 라벨<small>양 끝 중 불리한 쪽</small></dt><dd>${chip(onGrad)}</dd></div>
      <div><dt>구획선<small>비텍스트 3:1</small></dt><dd>${chip(contrast(t.page, t.line), 3)}</dd></div>
    </dl>
  </figure>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — Minimalism & Swiss Style (자홍 → 코랄)</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#e8e6e2; color:#0a0a0a;
    font:400 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1320px; margin:0 auto; }
  h1 { font-size:24px; font-weight:700; letter-spacing:-.02em; margin:0 0 6px; }
  .lede { margin:0 0 8px; color:#54504b; max-width:76ch; }
  .changes { margin:0 0 26px; padding-left:18px; color:#54504b; max-width:76ch; }
  .changes li { margin-bottom:4px; }
  .changes b { color:#0a0a0a; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  .frames { display:flex; gap:22px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:11px; letter-spacing:.08em; text-transform:uppercase;
    color:#54504b; margin-bottom:8px; }

  /* 스펙: border-radius 0, shadow 없음. 면은 선으로만 나눈다. */
  .screen { position:relative; width:390px; height:760px; overflow:hidden;
    background:var(--page); display:flex; border:1px solid #0a0a0a; }
  .frame.desktop .screen { width:820px; }

  .col { position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }

  .rail { width:232px; display:flex; flex-direction:column; padding:24px 20px;
    border-right:1px solid var(--line); background:var(--page); }
  .wordmark { font-size:20px; font-weight:700; letter-spacing:-.03em; color:var(--text);
    margin-bottom:32px; }
  .rail-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase;
    color:var(--muted); margin:0 0 10px; }
  .rail nav { display:flex; flex-direction:column; flex:1; }
  .room { display:block; padding:10px 0; font-size:13px; color:var(--muted);
    border-bottom:1px solid var(--line-soft); transition:color 220ms ease; }
  .room:hover { color:var(--text); }
  .room.active { color:var(--text); font-weight:700; }
  .rail-bottom { display:flex; flex-direction:column; gap:8px; }

  .topbar { display:flex; align-items:center; justify-content:space-between;
    height:56px; padding:0 20px; border-bottom:1px solid var(--line); }
  .topbar .ic { font-size:10px; letter-spacing:.14em; font-weight:700; color:var(--text); }
  .meta { font-size:11px; letter-spacing:.04em; color:var(--muted); font-variant-numeric:tabular-nums; }

  .stream { flex:1; overflow:hidden; padding:24px 20px 170px; }
  .stamp { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted);
    margin:0 0 20px; padding-bottom:8px; border-bottom:1px solid var(--line-soft); }

  /* 말풍선을 없앴다 — Swiss는 면을 칠하지 않고 글자와 여백으로 나눈다. */
  .msg { margin-bottom:26px; }
  .who { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin:0 0 6px; }
  .body { margin:0; font-size:14px; line-height:1.7; color:var(--text); }
  .msg.me { padding-left:20px; border-left:3px solid transparent; border-image:var(--grad) 1; }
  .msg.me .body { font-weight:700; }
  .card-name { margin:0 0 8px; font-size:26px; font-weight:700; letter-spacing:-.03em;
    color:var(--text); display:flex; align-items:baseline; gap:10px; }
  .card-name span { font-size:10px; font-weight:400; letter-spacing:.12em; text-transform:uppercase;
    color:var(--accent-text); }

  .suggest { list-style:none; margin:0; padding:0; border-top:1px solid var(--line-soft); }
  .suggest li { border-bottom:1px solid var(--line-soft); }
  .suggest button { display:block; width:100%; text-align:left; font:inherit; font-size:13px;
    cursor:pointer; background:none; border:0; padding:12px 0; color:var(--text);
    transition:padding-left 220ms ease, color 220ms ease; }
  .suggest button::before { content:"→"; margin-right:10px; color:var(--accent-text); }
  .suggest button:hover { padding-left:8px; }

  .composer { position:absolute; left:0; right:0; bottom:26px; padding:0 20px; background:var(--page); }
  .modes { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid var(--line);
    border-bottom:0; }
  .seg { font:inherit; font-size:11px; font-weight:500; cursor:pointer; border:0;
    border-right:1px solid var(--line); padding:9px 0; background:none; color:var(--muted);
    transition:background 220ms ease, color 220ms ease; }
  .seg:last-child { border-right:0; }
  .seg:hover { background:var(--alt); color:var(--text); }
  .seg.on { background:var(--grad); color:var(--on-grad); font-weight:700; }
  .input-row { display:flex; align-items:stretch; border:1px solid var(--line); }
  .ph { flex:1; padding:14px 12px; color:var(--muted); font-size:13px; }
  .send { font:inherit; font-size:12px; font-weight:700; letter-spacing:.04em; cursor:pointer;
    border:0; border-left:1px solid var(--line); padding:0 18px;
    background:var(--grad); color:var(--on-grad); }

  .btn-accent, .btn-plain { font:inherit; font-size:12px; font-weight:700; letter-spacing:.04em;
    cursor:pointer; border:0; padding:12px; transition:opacity 220ms ease; }
  .btn-accent { background:var(--grad); color:var(--on-grad); }
  .btn-plain { background:none; border:1px solid var(--line); color:var(--text); font-weight:500; }
  .btn-accent:hover, .btn-plain:hover { opacity:.82; }

  .footnote { position:absolute; left:0; right:0; bottom:0; margin:0; padding:5px 20px;
    text-align:right; border-top:1px solid var(--line-soft); }
  .footnote a { font-size:10px; letter-spacing:.06em; color:var(--muted); text-decoration:underline; }

  @media (prefers-reduced-motion: reduce) { * { transition-duration:1ms !important; } }

  .facts { margin:12px 0 0; display:grid; gap:5px; width:390px; }
  .frame.desktop .facts { width:820px; }
  .facts > div { display:flex; align-items:baseline; justify-content:space-between; gap:12px;
    border-top:1px solid #c9c6c1; padding-top:5px; }
  .facts dt { font-size:12px; color:#54504b; }
  .facts dt small { display:block; opacity:.8; font-size:11px; }
  .facts dd { margin:0; }
  .ratio { font-variant-numeric:tabular-nums; font-weight:700; font-size:12px; padding:2px 8px; }
  .ratio i { font-style:normal; margin-left:4px; }
  .ratio.pass { background:#0a3d17; color:#c6f3ce; }
  .ratio.fail { background:#4a1f1c; color:#ffc9c4; }

  footer { margin-top:30px; color:#54504b; font-size:12px; max-width:76ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Minimalism &amp; Swiss Style · 자홍 → 코랄</h1>
  <p class="lede">
    배경에 아무 일도 일어나지 않는다. 오로라도 유리도 없고, 화면을 끌고 가는 건 여백과 글자
    크기다. 대신 스펙을 타협 없이 적용했다 — <b>모서리 0, 그림자 없음, 액센트 하나</b>.
  </p>
  <ul class="changes">
    <li><b>말풍선을 없앴다.</b> Swiss는 면을 칠해 구분하지 않고 여백과 선으로 나눈다. 내 말은 왼쪽에 코랄 선 하나로만 표시된다.</li>
    <li><b>카드 이름이 제목이 됐다.</b> "완드 7"을 26px로 키우고 위치("현재")를 라벨로 내렸다 — 타이포 위계가 장식을 대신한다.</li>
    <li><b>모든 모서리가 각지다.</b> 지금 타연은 <code>rounded-[28px]</code>·<code>rounded-full</code>이 기본 언어인데, 그걸 전부 버려야 이 스타일이 성립한다.</li>
    <li><b>액센트는 하나뿐.</b> 코랄 그라데이션은 보내기 버튼, 선택된 스프레드, 내 말 표시선에만. 나머지는 전부 무채색이다.</li>
    <li><b>스프레드가 4칸 그리드</b>가 됐다. 알약이 아니라 선으로 나뉜 칸이다.</li>
    <li><b>추천 질문은 목록</b>이다. 칩도 테두리도 없고 구분선과 화살표만 있다.</li>
  </ul>

  <div class="frames">
    ${frame("light", "mobile")}
    ${frame("dark", "mobile")}
    ${frame("dark", "desktop")}
  </div>

  <footer>
    이 스타일의 접근성 위험은 셋 중 유일하게 <code>risk:low</code>다. 반투명 면도 흐르는 배경도
    없어서 대비가 흔들릴 구석이 애초에 없다 — 글래스와 오로라가 <code>risk:conditional</code>인
    것과 대조된다.
    <br><br>
    대신 잃는 것이 분명하다. 타연의 둥근 알약 언어, 카드 질감, 분위기가 전부 빠진다. 타로·사주
    상담이라는 제품에서 "정돈된 도구"처럼 읽히는 게 맞는지는 취향이 아니라 포지셔닝 문제다.
    스펙이 꼽은 적합 분야도 대시보드·문서·업무 도구 쪽이다.
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
    `${t.label.padEnd(4)} 본문 ${fmt(contrast(t.page, t.text))}  보조 ${fmt(contrast(t.page, t.muted))}` +
      `  액센트글자 ${fmt(contrast(t.page, t.accentText))}` +
      `  액센트면 ${fmt(Math.min(contrast(t.gradFrom, t.onGrad), contrast(t.gradTo, t.onGrad)))}` +
      `  구획선 ${fmt(contrast(t.page, t.line))}`,
  );
}
