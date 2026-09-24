// 레이아웃·UX 재설계 시안 (Aurora + Motion, 자홍 → 코랄).
//   node doc/design/build-ux-layout-mockup.mjs  →  doc/design/ux-layout-mockup.html
//
// 계기: 50대 테스터가 어려워했다. 실제 화면(localhost:3000/tarot, 390px)을 브라우저로 재서
// 원인을 특정했다 — 추측이 아니라 실측이다.
//
//   라벨 없는 아이콘 버튼 5개  메뉴 / 이용권+ / 대화방 정보 / 보유 이용권 / 질문하기
//   44px 미만 컨트롤 5개      이용권+ 40×40, 대화방 정보 40×40, 제목 222×24,
//                            궁합 상대 정보 68×14, 회사 정보 37×15
//   10~12px 텍스트 3곳        회사 정보 10px, 궁합 상대 68×14의 12px, "보유 이용권 없음" 12px
//
// 스킬 UX 규칙 중 여기서 근거로 쓴 것:
//   touch-target-size    44×44pt / 48×48dp
//   touch-spacing        타깃 사이 최소 8px
//   no-precision-required 작은 아이콘·얇은 모서리에 정밀 탭을 요구하지 말 것
//   gesture-alternative  중요한 동작에는 항상 보이는 컨트롤을 둘 것
//   input-labels         placeholder만으로 라벨을 대신하지 말 것
//   empty-states         비어 있을 때 안내와 다음 행동을 줄 것
//   progressive-disclosure 복잡한 선택은 점진적으로
//
// 50대를 위해 규칙 위에 더 얹은 것:
//   · 아이콘 단독 금지. 전부 아이콘 + 글자.
//   · 상태를 배지가 아니라 문장으로. "14회" 대신 "14회 남았어요".
//   · 허공에 떠 있는 버튼을 없애고 전부 줄(row)에 넣어 정렬을 맞춘다.
//
// 크기는 두 번째 판에서 도로 줄였다(2026-09-22, "요소가 너무 크다"). 첫 판에서 44/48을 웹에
// 그대로 적용한 게 잘못이었다 — 스킬 규칙이 그걸 직접 금지한다:
//
//   Target Size (Minimum) · Web
//     Do   : 최소 24×24 CSS px
//     Don't: 네이티브 44pt / 48dp를 웹 기준으로 가정하지 말 것
//
// 그래서 주요 컨트롤 40px, 보조 32px. 24 하한의 1.6배라 여유는 남으면서 화면은 촘촘해진다.
// 아이콘에 글자를 붙이는 원칙은 그대로 둔다 — 그건 크기와 무관한 문제다.

import { writeFileSync } from "node:fs";
import { contrast, toOklch } from "./build-point-ramp.mjs";

const T = {
  light: {
    label: "라이트",
    page: "#fff7f4",
    surface: "#ffffff",
    surfaceAlt: "#fff1ec",
    line: "#f3ddd5",
    text: "#2a1320",
    muted: "#6d5257",
    chip: "#f6e4de",
    tint: "#ffd2c7",
    grad: "linear-gradient(30deg in oklab, #c2005f, #d23c21)",
    gradFrom: "#c2005f",
    onGrad: "#ffffff",
    link: "#ac0053",
    aurora: ["#ff9ec4", "#ffb38a", "#ffd6a5", "#ff7f9e"],
    auroraOp: 0.5,
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
    tint: "#2b1119",
    grad: "linear-gradient(30deg in oklab, #ff8a6b, #ff5993)",
    gradFrom: "#ff8a6b",
    onGrad: "#08070a",
    link: "#f08d78",
    aurora: ["#4d0a24", "#54200e", "#24091d", "#6b1830"],
    auroraOp: 0.5,
  },
};

// 실측 → 개선. 숫자는 2026-09-22에 실제 화면에서 잰 값이다.
const FIXES = [
  { what: "메뉴 버튼", before: "64×64 · 아이콘만", after: "아이콘 + “메뉴” 글자", why: "아이콘만으로는 무엇인지 배워야 한다" },
  { what: "이용권 추가", before: "40×40 · 아이콘만", after: "상태 줄의 “구입” 버튼 30h", why: "44px 미만 + 라벨 없음" },
  { what: "대화방 정보", before: "40×40 · 아이콘만", after: "“더보기” 40h, 글자 포함", why: "〃" },
  { what: "대화 제목", before: "222×24 버튼", after: "제목은 글자, 이름 변경은 더보기 안으로", why: "누를 수 있는지 알 수 없고 24px" },
  { what: "보유 이용권", before: "48×48 아이콘 · 허공에 떠 있음", after: "상단바에 “시간제” 버튼으로 복귀 + 상태 줄에 문장", why: "위치가 떠 있어 정렬이 깨지고 의미가 없다" },
  { what: "“보유 이용권 없음”", before: "12px 글자", after: "13px 문장 + 구입 버튼", why: "빈 상태에 다음 행동이 없었다" },
  { what: "스프레드 선택", before: "칩 → 바텀시트 2단계", after: "현재 선택을 글자로 보여주는 36h 칩(기존 위치)", why: "무엇이 선택돼 있는지 한눈에 안 보였다" },
  { what: "질문 입력", before: "placeholder만", after: "<b>기존 형태 유지</b> · 크기만 축소", why: "형태 유지가 요청사항. placeholder 한계는 남는다" },
  { what: "보내기", before: "48×48 아이콘만", after: "“보내기” 글자 + 화살표, 36h", why: "아이콘만" },
  { what: "궁합 상대 정보", before: "68×14 · 12px", after: "34h 줄 안의 링크, 13px", why: "높이 14px는 정밀 탭을 요구한다" },
  { what: "회사 정보", before: "37×15 · 10px", after: "32h 영역, 12px", why: "10px는 읽히지 않는다" },
];

// 칩 면이 떠 보이는 정도는 명암비가 아니라 OKLab 밝기차로 잰다. 명암비는 밝은 쪽에서
// 눌려서, 라이트 1.10 / 다크 1.15로 같아 보이던 것이 실제로는 0.031 대 0.088이었다.
const chipStep = (t) => Math.abs(toOklch(t.tint).L - toOklch(t.page).L);

const fmt = (n) => n.toFixed(2);

function frame(key) {
  const t = T[key];
  const style = `
      --page:${t.page}; --surface:${t.surface}; --surface-alt:${t.surfaceAlt}; --line:${t.line};
      --text:${t.text}; --muted:${t.muted}; --chip:${t.chip}; --tint:${t.tint};
      --grad:${t.grad}; --on-grad:${t.onGrad}; --link:${t.link}; --aurora-op:${t.auroraOp};
      --a1:${t.aurora[0]}; --a2:${t.aurora[1]}; --a3:${t.aurora[2]}; --a4:${t.aurora[3]};`;

  return `
  <figure class="frame">
    <figcaption>${t.label} · 개선안</figcaption>
    <div class="screen" style="${style}">
      <div class="aurora l1"></div>
      <div class="aurora l2"></div>

      <div class="col">
        <!-- 상단바: 아이콘 단독을 없앴다. 전부 글자가 붙는다.
             우상단 시간제 이용권 버튼은 원래 자리로 되돌렸다(2026-09-22) — 없애지 말고
             허공에 떠 있던 것만 줄 안으로 넣는다. -->
        <header class="topbar">
          <button class="bar-btn"><span class="ic">☰</span>메뉴</button>
          <b class="title">이직 고민 상담</b>
          <button class="bar-btn"><span class="ic">◷</span>시간제</button>
          <button class="bar-btn"><span class="ic">⋯</span>더보기</button>
        </header>

        <!-- 상태 줄: 떠 있던 이용권 배지를 여기로. 배지가 아니라 문장이다. 한 줄로 압축. -->
        <div class="status">
          <p class="status-text">스탠다드 이용권 · <b>14회</b> 남았어요</p>
          <button class="btn-grad sm">구입</button>
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
            <h4 class="card-name">완드 7</h4>
            <p class="body">지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
              버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</p>
          </div>
          <div class="suggest in" style="--d:270ms">
            <p class="suggest-label">이어서 물어보기</p>
            <button><span class="ico">→</span>지금 준비해야 할 건 뭘까?</button>
            <button><span class="ico">→</span>올해 안에 결정해도 될까?</button>
          </div>
        </div>

        <!-- 입력창은 기존 형태를 유지한다(2026-09-22, 사용자 요청) — 둥근 카드 하나 안에
             입력칸이 있고 그 아래 줄에 모드 버튼과 보내기가 들어간다. 크기만 줄였다.
             기존 형태라 placeholder가 라벨을 겸하는데, 입력을 시작하면 사라진다는 한계는
             그대로 남는다(input-labels). 형태를 유지해달라는 요청이 우선이다. -->
        <div class="composer">
          <div class="composer-card">
            <div class="field">이직 시기를 알고 싶어요</div>
            <div class="actions">
              <button class="spread">원 카드&nbsp;<span class="caret">▼</span></button>
              <button class="btn-grad send">보내기 <span class="ic">→</span></button>
            </div>
          </div>
          <a class="helper">궁합도 보려면&nbsp;<u>상대 정보 입력</u></a>
        </div>
        <p class="footnote"><a>회사 정보 · 이용약관</a></p>
      </div>
    </div>

    <dl class="facts">
      <div><dt>본문 글자 크기<small>이전 13~14px</small></dt><dd class="note">14.5px</dd></div>
      <div><dt>가장 작은 글자<small>이전 10px(회사 정보)</small></dt><dd class="note">10px(아이콘 라벨) · 본문 외 12px</dd></div>
      <div><dt>가장 작은 터치 영역<small>이전 68×14 · 웹 하한 24px</small></dt><dd class="pass">30px</dd></div>
      <div><dt>본문 대비</dt><dd class="pass">${fmt(contrast(t.surface, t.text))}</dd></div>
      <div><dt>보조 글자 대비</dt><dd class="${contrast(t.surface, t.muted) >= 4.5 ? "pass" : "fail"}">${fmt(contrast(t.surface, t.muted))}</dd></div>
      <div><dt>추천 질문 칩이 배경에서 떠 보이는 정도<small>OKLab 밝기차 — 명암비는 밝은 쪽에서 눌려 못 쓴다</small></dt><dd class="${chipStep(t) >= 0.06 ? "pass" : "fail"}">${chipStep(t).toFixed(3)}</dd></div>
    </dl>
  </figure>`;
}

const rows = FIXES.map(
  (f) => `<tr><td><b>${f.what}</b></td><td class="was">${f.before}</td><td>${f.after}</td><td class="why">${f.why}</td></tr>`,
).join("");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 레이아웃 · UX 재설계</title>
<style>
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 20px 64px; background:#100c0f; color:#efe4e6;
    font:400 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif; }
  .wrap { max-width:1320px; margin:0 auto; }
  h1 { font-size:23px; margin:0 0 6px; }
  .lede { margin:0 0 20px; color:#ab999e; max-width:80ch; }
  code { font-family:ui-monospace, Menlo, monospace; font-size:12px; }

  table { width:100%; border-collapse:collapse; margin:0 0 28px; font-size:12.5px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid #2a2126; vertical-align:top; }
  th { color:#ab999e; font-weight:600; font-size:11.5px; }
  td.was { color:#e0a8a2; }
  td.why { color:#ab999e; }

  .frames { display:flex; gap:22px; align-items:flex-start; flex-wrap:wrap; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#ab999e; margin-bottom:8px; }

  .screen { position:relative; width:390px; height:720px; overflow:hidden;
    background:var(--page); display:flex; border-radius:26px; box-shadow:0 16px 46px rgba(0,0,0,.5); }
  .col { position:relative; display:flex; flex-direction:column; flex:1; min-width:0; }
  .aurora { position:absolute; inset:-30%; opacity:var(--aurora-op);
    filter:saturate(1.2) blur(38px); background-size:200% 200%; }
  .aurora.l1 { background-image:
      radial-gradient(40% 28% at 18% 14%, var(--a1) 0%, transparent 70%),
      radial-gradient(44% 30% at 84% 26%, var(--a2) 0%, transparent 72%);
    animation:d1 11s ease-in-out infinite alternate; }
  .aurora.l2 { background-image:
      radial-gradient(50% 30% at 70% 80%, var(--a3) 0%, transparent 74%),
      radial-gradient(44% 26% at 24% 66%, var(--a4) 0%, transparent 72%);
    animation:d2 9s ease-in-out infinite alternate; }
  @keyframes d1 { from{background-position:0% 0%} to{background-position:100% 60%} }
  @keyframes d2 { from{background-position:100% 100%} to{background-position:0% 30%} }

  /* 상단바 — 아이콘 단독 없음. 웹 하한 24px의 1.6배인 40px로 잡는다. */
  .topbar { position:relative; display:flex; align-items:center; gap:2px; padding:6px 8px;
    background:var(--surface); border-bottom:1px solid var(--line); }
  .bar-btn { display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:1px; min-width:44px; height:40px; border:0; border-radius:11px; cursor:pointer;
    background:transparent; color:var(--text); font:inherit; font-size:10px; font-weight:600;
    transition:background 300ms ease; }
  .bar-btn:hover { background:var(--chip); }
  .bar-btn .ic { font-size:14px; line-height:1; }
  .title { flex:1; text-align:center; font-size:15px; font-weight:700; color:var(--text);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding:0 2px; }

  /* 상태 줄 — 한 줄로 압축. 문장은 유지하되 높이를 40으로. */
  .status { position:relative; display:flex; align-items:center; justify-content:space-between;
    gap:10px; min-height:40px; padding:0 12px; background:var(--surface-alt);
    border-bottom:1px solid var(--line); }
  .status-text { margin:0; font-size:13px; color:var(--muted); }
  .status-text b { color:var(--text); font-size:14px; }

  .stream { position:relative; flex:1; overflow:hidden; padding:12px 12px 6px;
    display:flex; flex-direction:column; gap:10px; }
  .msg { max-width:88%; }
  .msg.me { align-self:flex-end; max-width:82%; }
  .who { margin:0 0 3px; font-size:11.5px; color:var(--muted); }
  .body { margin:0; font-size:14.5px; line-height:1.6; color:var(--text);
    background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:10px 13px; }
  .msg.me .body { background:var(--grad); color:var(--on-grad); border:0; font-weight:600; }
  .card-name { margin:0 0 5px; font-size:18px; font-weight:700; color:var(--text); }

  .suggest { display:flex; flex-direction:column; gap:6px; }
  .suggest-label { margin:0 0 0 2px; font-size:11.5px; color:var(--muted); }
  .suggest button { display:flex; align-items:center; gap:7px; text-align:left; font:inherit;
    font-size:13px; font-weight:600; cursor:pointer; border:0; background:var(--tint);
    color:var(--link); border-radius:999px; padding:0 14px; min-height:36px;
    transition:transform 300ms ease, filter 300ms ease; }
  .suggest button:hover { transform:translateX(3px); filter:brightness(1.05); }
  .suggest .ico { font-size:12px; }

  /* 컴포저 — 기존 형태: 둥근 카드 하나 안에 입력칸 + 모드/보내기 줄 */
  .composer { position:relative; padding:8px 12px 2px; background:var(--surface);
    border-top:1px solid var(--line); }
  .composer-card { border:1px solid var(--line); border-radius:22px; background:var(--page);
    padding:10px 10px 10px 14px; }
  .field { min-height:34px; font-size:14.5px; color:var(--text); padding:4px 0 8px; }
  .actions { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .spread { display:flex; align-items:center; min-height:36px; border:0; border-radius:999px;
    cursor:pointer; background:var(--chip); color:var(--text); padding:0 14px;
    font:inherit; font-size:13px; font-weight:600; transition:filter 300ms ease; }
  .spread:hover { filter:brightness(.97); }
  .caret { font-size:10px; color:var(--muted); }
  .btn-grad { border:0; border-radius:999px; cursor:pointer; background:var(--grad);
    color:var(--on-grad); font:inherit; font-weight:700;
    transition:transform 300ms ease, filter 300ms ease; }
  .btn-grad:hover { transform:translateY(-1px); filter:brightness(1.04); }
  .btn-grad.send { min-height:36px; padding:0 16px; font-size:13.5px; display:flex;
    align-items:center; gap:5px; }
  .btn-grad.sm { min-height:30px; padding:0 14px; font-size:12.5px; white-space:nowrap; }
  .helper { display:flex; align-items:center; min-height:34px; font-size:13px; color:var(--muted); }
  .helper u { color:var(--link); }

  .footnote { position:relative; margin:0; display:flex; align-items:center; justify-content:center;
    min-height:32px; background:var(--surface); }
  .footnote a { font-size:12px; color:var(--muted); text-decoration:underline; }

  @media (prefers-reduced-motion: reduce) { .aurora, .in { animation:none !important; } * { transition-duration:1ms !important; } }
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
  .facts dd.note { background:rgba(150,130,135,.2); color:#efe4e6; }

  footer { margin-top:28px; color:#ab999e; font-size:12px; max-width:80ch; }
</style>
</head>
<body>
<div class="wrap">
  <h1>레이아웃 · UX 재설계 — 편의성 우선</h1>
  <p class="lede">
    50대 테스터가 어려워했다는 피드백에서 출발했다. 추측하지 않고 <b>실제 화면을 브라우저로 재서</b>
    원인을 특정했다(<code>localhost:3000/tarot</code>, 390px). 라벨 없는 아이콘 버튼 5개,
    44px 미만 컨트롤 5개, 10~12px 글자 3곳이 나왔다.
  </p>

  <table>
    <thead><tr><th>요소</th><th>실측 (현재)</th><th>개선</th><th>이유</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="frames">
    ${frame("light")}
    ${frame("dark")}
  </div>

  <footer>
    근거로 쓴 스킬 규칙: <code>touch-target-size</code>(44×44pt / 48×48dp),
    <code>touch-spacing</code>(최소 8px), <code>no-precision-required</code>,
    <code>gesture-alternative</code>, <code>input-labels</code>,
    <code>empty-states</code>, <code>progressive-disclosure</code>.
    <br><br>
    규칙 위에 더 얹은 것은 연령대 때문이다 — <b>아이콘 단독 금지</b>(전부 글자를 붙였다),
    <b>상태를 배지가 아니라 문장으로</b>("14회" 대신 "14회 남았어요"),
    <b>최소 글자 13px·본문 16px</b>, <b>허공에 뜬 버튼 제거</b>(전부 줄에 넣어 정렬을 맞췄다).
    <br><br>
    남은 판단: 상단바의 글자 라벨이 공간을 먹는다. 제목이 길면 잘린다 — 제목을 두 줄로 둘지,
    라벨을 아이콘 아래 더 작게 둘지는 실제 대화 제목 길이를 보고 정하는 편이 낫다.
    <br><br>
    생성: <code>node doc/design/build-ux-layout-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/ux-layout-mockup.html", html);
console.log("wrote doc/design/ux-layout-mockup.html");
for (const [, t] of Object.entries(T)) {
  console.log(`${t.label.padEnd(4)} 본문 ${fmt(contrast(t.surface, t.text))}  보조 ${fmt(contrast(t.surface, t.muted))}`);
}
