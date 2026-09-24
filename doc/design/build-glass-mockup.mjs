// 타연을 글래스모피즘으로 옮기면 어떻게 되는지 보는 시안.
//   node doc/design/build-glass-mockup.mjs  →  doc/design/glass-mockup.html
//
// ui-ux-pro-max의 glassmorphism 스펙을 따른다: backdrop blur 10~20px, 반투명 흰색 10~30%,
// 1px 밝은 테두리, "vibrant background" 필수. 마지막 항목이 핵심이다 — 유리는 뒤에 볼 게 있어야
// 유리로 보인다. 단색 배경 위에 얹으면 그냥 흐린 회색 판이 된다.
//
// 같은 스펙이 접근성 위험을 risk:conditional로 달아뒀는데, 반투명 면 위 글자 대비가 배경에 따라
// 달라져서다. 그래서 여기서는 유리를 배경 위에 합성한 실제 색으로 대비를 계산한다. 유리 자체의
// rgba 값으로 재면 실제보다 낙관적인 숫자가 나온다.

import { writeFileSync } from "node:fs";
import { RAMP, contrast } from "./build-point-ramp.mjs";

// 배경도 브랜드 결정을 따라야 한다. 앞선 시안은 오로라에 라일락(#c9b6ec, 300°)과
// 딥퍼플(#2a1f4d)을 썼는데, 그건 호리(312°)의 영역이다 — 버튼에서 보라를 피해놓고 배경을
// 보라로 두면 화면 전체 인상은 그대로 호리 쪽이다. 따뜻한 쪽으로 옮기고 거리를 같이 잰다.
const HORI_HUE = 312;
const hueOf = (hex) => {
  const [, A, B] = rgbToOklab(hexToRgb(hex));
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  return H < 0 ? H + 360 : H;
};
const horiGap = (hex) => {
  const x = Math.abs(hueOf(hex) - HORI_HUE) % 360;
  return x > 180 ? 360 - x : x;
};

const hex = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16));
const hexToRgb = (h) => hex(h).map((v) => v / 255);
const sLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function rgbToOklab([r, g, b]) {
  const R = sLin(r), G = sLin(g), B = sLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s2 = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2,
  ];
}
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** 반투명 면을 배경 위에 얹었을 때 실제로 보이는 색. blur는 배경을 뭉개므로, 뒤가 그라디언트인
 *  구간은 그 구간의 평균색을 배경으로 넣는다(아래 BACKDROP_AVG). */
const composite = (glassHex, alpha, backdropHex) => {
  const g = hex(glassHex);
  const b = hex(backdropHex);
  return toHex(g.map((v, i) => alpha * v + (1 - alpha) * b[i]));
};

const THEMES = {
  light: {
    label: "라이트",
    // 오로라도 코랄 결정을 따른다. 앞선 판에서는 라일락(300°)을 썼는데 그건 호리 영역이라,
    // 버튼만 보라를 피하고 배경은 그대로 두면 화면 인상이 안 바뀐다.
    auroraA: "#ffc9d6",
    auroraB: "#ffd3bb",
    auroraC: "#ffe0d2",
    page: "#fdf2ef",
    // blur가 섞고 난 뒤 유리 밑에 깔리는 평균색(대비 계산용)
    backdropAvg: "#fbd8cf",
    glass: "#ffffff",
    glassAlpha: 0.62,
    glassBorder: "rgba(255,255,255,.75)",
    text: "#2a1a43",
    textMuted: "#5f5378",
    // 확정된 자홍 → 코랄. 코랄 끝은 흰 글씨 4.5를 넘기려고 밝기를 0.04 내린 값이다.
    gradFrom: "#c2005f",
    gradTo: "#d23c21",
    fill: "#c2005f",
    onFill: "#ffffff",
    link: "#ac0053",
    chipGlass: "rgba(255,255,255,.5)",
  },
  dark: {
    label: "다크",
    auroraA: "#5c1030",
    auroraB: "#5a2412",
    auroraC: "#101114",
    page: "#0e0f12",
    backdropAvg: "#2a1620",
    glass: "#ffffff",
    glassAlpha: 0.08,
    glassBorder: "rgba(255,255,255,.14)",
    text: "#f3f4f6",
    textMuted: "#c9b3ad",
    // 다크는 밝은 면 + 어두운 글씨. 같은 코랄~핑크 축을 밝은 쪽에서 쓴다.
    gradFrom: "#ff8a6b",
    gradTo: "#ff5993",
    fill: "#ff5993",
    onFill: "#141517",
    link: "#ff8a6b",
    chipGlass: "rgba(255,255,255,.1)",
  },
};

const fmt = (n) => n.toFixed(2);
const ratioChip = (n, floor = 4.5) =>
  `<span class="ratio ${n >= floor ? "pass" : "fail"}">${fmt(n)}<i>${n >= floor ? "✓" : "✗"}</i></span>`;

function frame(key, variant) {
  const t = THEMES[key];
  const surface = composite(t.glass, t.glassAlpha, t.backdropAvg);
  const onGlass = contrast(surface, t.text);
  const onGlassMuted = contrast(surface, t.textMuted);
  const linkOnGlass = contrast(surface, t.link);
  const desktop = variant === "desktop";

  const style = `
      --aurora-a:${t.auroraA}; --aurora-b:${t.auroraB}; --aurora-c:${t.auroraC};
      --page:${t.page}; --glass:rgba(${hex(t.glass).join(",")},${t.glassAlpha});
      --glass-border:${t.glassBorder}; --chip-glass:${t.chipGlass};
      --text:${t.text}; --muted:${t.textMuted};
      --fill:${t.fill}; --on-fill:${t.onFill}; --link:${t.link};
      --grad:linear-gradient(30deg in oklab, ${t.gradFrom}, ${t.gradTo});`;

  return `
  <figure class="frame ${desktop ? "desktop" : ""}">
    <figcaption>${t.label}${desktop ? " · 데스크톱" : " · 모바일"}</figcaption>
    <div class="screen" style="${style}">
      <div class="aurora"></div>

      ${desktop ? `
      <aside class="rail glass">
        <div class="rail-top">타연</div>
        <nav>
          <a class="room active">이직 고민 상담</a>
          <a class="room">올해 연애운</a>
          <a class="room">새 대화</a>
        </nav>
        <div class="rail-bottom">
          <button class="pill-fill">이용권 구입하기</button>
          <button class="pill-glass">새 대화</button>
        </div>
      </aside>` : ""}

      <div class="col">
        <header class="topbar glass">
          <span class="ic">☰</span>
          <b>새 대화</b>
          <span class="ticket">스탠다드 · 14회</span>
        </header>

        <div class="stream">
          <div class="bubble glass">안녕하세요! 저는 루미예요.</div>
          <div class="bubble glass">밝고 순수한 마음으로 당신의 이야기를 들어드릴게요.</div>
          <div class="bubble me">올해 이직해도 괜찮을까?</div>
          <div class="bubble glass wide">
            <b>현재 — 완드 7</b>
            지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
            버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.
          </div>
          <div class="suggest">
            <button>1. 지금 준비해야 할 건 뭘까?</button>
            <button>2. 올해 안에 결정해도 될까?</button>
          </div>
          <div class="bubble me">준비할 걸 더 알려줘</div>
          <div class="bubble glass wide">
            <b>조언 — 펜타클 8</b>
            당장 옮기는 것보다, 지금 자리에서 손에 익힐 것을 하나 정해 끝까지 가보세요.
          </div>
        </div>

        <div class="composer glass">
          <div class="modes">
            <button class="seg on">원 카드</button>
            <button class="seg">쓰리 카드</button>
            <button class="seg">양자택일</button>
            <button class="seg">켈틱</button>
          </div>
          <div class="input-row">
            <span class="ph">궁금한 것을 물어보세요</span>
            <button class="send">↑</button>
          </div>
        </div>
        <p class="footnote"><a>회사 정보</a></p>
      </div>
    </div>

    <dl class="facts">
      <div><dt>유리 면 실제 색<small>배경 ${t.backdropAvg} 위에 ${Math.round(t.glassAlpha * 100)}% 합성</small></dt><dd><code>${surface}</code></dd></div>
      <div><dt>유리 위 본문</dt><dd>${ratioChip(onGlass)}</dd></div>
      <div><dt>유리 위 보조 글자</dt><dd>${ratioChip(onGlassMuted)}</dd></div>
      <div><dt>유리 위 링크·강조</dt><dd>${ratioChip(linkOnGlass)}</dd></div>
      <div><dt>그라데이션 위 라벨<small>양 끝 중 불리한 쪽 <code>${t.gradFrom}</code> / <code>${t.gradTo}</code></small></dt><dd>${ratioChip(Math.min(contrast(t.gradFrom, t.onFill), contrast(t.gradTo, t.onFill)))}</dd></div>
      <div><dt>오로라가 호리와 가까워지는 정도<small>40° 이상이면 안전</small></dt><dd><span class="ratio ${Math.min(horiGap(t.auroraA), horiGap(t.auroraB)) >= 40 ? "pass" : "fail"}">${Math.round(Math.min(horiGap(t.auroraA), horiGap(t.auroraB)))}°</span></dd></div>
    </dl>
  </figure>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>타연 — 글래스모피즘 시안</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 20px 64px;
    font: 500 14px/1.6 "Pretendard", system-ui, -apple-system, "Segoe UI", sans-serif;
    background: #15161a; color: #e8e6ee;
  }
  .wrap { max-width: 1320px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  .lede { margin: 0 0 8px; color: #a7a3b8; max-width: 76ch; }
  .lede code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
  .changes { margin: 0 0 26px; padding-left: 18px; color: #a7a3b8; max-width: 76ch; }
  .changes li { margin-bottom: 4px; }
  .changes b { color: #e8e6ee; }

  .frames { display: flex; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
  .frame { margin: 0; }
  figcaption { font-size: 12px; color: #a7a3b8; margin-bottom: 8px; }

  .screen {
    position: relative; width: 390px; height: 760px; overflow: hidden;
    border-radius: 26px; background: var(--page); display: flex;
    box-shadow: 0 18px 50px rgba(0,0,0,.45);
  }
  .frame.desktop .screen { width: 820px; }

  /* "vibrant background" — 유리는 뒤에 볼 것이 있어야 유리로 읽힌다. */
  .aurora { position: absolute; inset: -20%; filter: blur(46px); opacity: .95;
    background:
      radial-gradient(42% 26% at 16% 10%, var(--aurora-a) 0%, transparent 72%),
      radial-gradient(46% 30% at 88% 22%, var(--aurora-b) 0%, transparent 74%),
      radial-gradient(52% 26% at 22% 58%, var(--aurora-b) 0%, transparent 74%),
      radial-gradient(58% 30% at 78% 74%, var(--aurora-a) 0%, transparent 76%),
      radial-gradient(70% 34% at 50% 104%, var(--aurora-c) 0%, transparent 78%);
  }

  .glass {
    background: var(--glass);
    -webkit-backdrop-filter: blur(16px) saturate(150%);
    backdrop-filter: blur(16px) saturate(150%);
    border: 1px solid var(--glass-border);
  }

  .col { position: relative; display: flex; flex-direction: column; flex: 1; min-width: 0; }

  .rail { position: relative; width: 236px; display: flex; flex-direction: column;
    border-radius: 0; border-width: 0 1px 0 0; padding: 14px 12px; }
  .rail-top { font-weight: 800; font-size: 17px; color: var(--text); padding: 6px 8px 14px; }
  .rail nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .room { display: block; border-radius: 10px; padding: 9px 10px; font-size: 13px; color: var(--muted); }
  .room.active { background: var(--chip-glass); color: var(--text); font-weight: 600; }
  .rail-bottom { display: flex; flex-direction: column; gap: 8px; }

  .topbar { position: relative; display: flex; align-items: center; gap: 10px;
    height: 56px; padding: 0 14px; border-width: 0 0 1px; border-radius: 0; }
  .topbar .ic { color: var(--text); font-size: 15px; }
  .topbar b { flex: 1; text-align: center; color: var(--text); font-size: 15px; }
  .ticket { font-size: 11px; font-weight: 600; color: var(--text);
    background: var(--chip-glass); border-radius: 999px; padding: 5px 10px; white-space: nowrap; }

  .stream { position: relative; flex: 1; overflow: hidden; padding: 14px 14px 150px; display: flex;
    flex-direction: column; gap: 9px; align-items: flex-start; }
  .bubble { max-width: 84%; border-radius: 18px; padding: 10px 13px; font-size: 13px;
    line-height: 1.55; color: var(--text); }
  .bubble.wide { max-width: 94%; }
  .bubble.wide b { display: block; margin-bottom: 4px; color: var(--link); }
  .bubble.me { align-self: flex-end; background: var(--grad); color: var(--on-fill);
    border: 0; font-weight: 600; }
  .suggest { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
  .suggest button { text-align: left; font: inherit; font-size: 12px; cursor: pointer;
    background: var(--chip-glass); color: var(--link); border: 0;
    border-radius: 999px; padding: 7px 13px; }

  /* 컴포저는 바닥에 붙이지 않고 띄운다 — 대화가 그 아래로 흘러야 유리가 유리로 보인다. */
  .composer { position: absolute; left: 12px; right: 12px; bottom: 34px;
    border-radius: 24px; padding: 10px; }
  .modes { display: flex; gap: 5px; margin-bottom: 9px; }
  .seg { flex: 1; font: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
    border: 0; border-radius: 999px; padding: 6px 0; background: transparent; color: var(--muted); }
  .seg.on { background: var(--grad); color: var(--on-fill); }
  .input-row { display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 4px 4px 4px 10px; }
  .ph { color: var(--muted); font-size: 13px; }
  .send { width: 38px; height: 38px; border: 0; border-radius: 50%; cursor: pointer;
    background: var(--grad); color: var(--on-fill); font-size: 16px; }
  .pill-fill { font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; border: 0;
    border-radius: 999px; padding: 10px; background: var(--grad); color: var(--on-fill); }
  .pill-glass { font: inherit; font-weight: 600; font-size: 13px; cursor: pointer;
    border: 1px solid var(--glass-border); border-radius: 999px; padding: 10px;
    background: var(--chip-glass); color: var(--text); }
  .footnote { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 6px 0 10px; text-align: center; }
  .footnote a { font-size: 11px; color: var(--muted); text-decoration: underline; }

  .facts { margin: 12px 0 0; display: grid; gap: 5px; width: 390px; }
  .frame.desktop .facts { width: 820px; }
  .facts > div { display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px; border-top: 1px solid #2c2d35; padding-top: 5px; }
  .facts dt { font-size: 12px; color: #a7a3b8; }
  .facts dt small { display: block; opacity: .75; font-size: 11px; }
  .facts dd { margin: 0; }
  .facts code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: #e8e6ee; }
  .ratio { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 12px;
    border-radius: 999px; padding: 2px 8px; }
  .ratio i { font-style: normal; margin-left: 4px; }
  .ratio.pass { background: #1e4023; color: #b9f0c0; }
  .ratio.fail { background: #4a1f1c; color: #ffc9c4; }

  footer { margin-top: 30px; color: #a7a3b8; font-size: 12px; max-width: 76ch; }
  footer code { font-family: ui-monospace, Menlo, monospace; }
</style>
</head>
<body>
<div class="wrap">
  <h1>타연 — 글래스모피즘 시안</h1>
  <p class="lede">
    유리는 뒤에 볼 것이 있어야 유리로 읽힌다. 그래서 색을 바꾸는 것만으로는 안 되고,
    <b>배경 · 레이어 순서 · 컴포저 위치</b>가 같이 움직여야 한다. 아래 수치는 유리의 rgba가 아니라
    <b>배경 위에 합성한 실제 색</b>으로 계산했다 — 반투명 면을 자기 값으로 재면 실제보다 밝게 나온다.
  </p>
  <ul class="changes">
    <li><b>오로라 배경</b>을 깔았다. 코랄 결정에 맞춰 분홍~살구 쪽으로 간다 — 앞선 시안은 라일락을 썼는데 그건 호리 영역이라, 버튼에서 보라를 피하고 배경을 보라로 두면 인상은 그대로였다.</li>
    <li><b>떠 있는 이용권 배지를 상단바로 넣었다.</b> 지금은 상단바 아래 허공에 동그란 버튼이 하나 떠 있는데, 유리 상단바 위에서는 층이 하나 더 생겨 지저분해진다.</li>
    <li><b>컴포저를 바닥에서 띄웠다.</b> 대화가 그 아래로 흘러 들어가야 유리의 depth가 보인다. 붙여두면 그냥 불투명한 바닥 바와 구분이 안 된다.</li>
    <li><b>스프레드 선택을 세그먼트로 꺼냈다.</b> 지금은 "원 카드 모드" 칩을 눌러 바텀시트를 여는 2단계인데, 네 종류뿐이라 한 줄에 들어간다.</li>
    <li><b>추천 질문은 테두리 대신 유리 칩</b>으로 바꿨다(테두리 버튼 제거 결정 반영).</li>
    <li>데스크톱은 사이드바를 <b>유리 레일</b>로 두고, 같은 오로라 배경을 좌우가 공유한다.</li>
  </ul>

  <div class="frames">
    ${frame("light", "mobile")}
    ${frame("dark", "mobile")}
    ${frame("dark", "desktop")}
  </div>

  <footer>
    남는 문제: 유리 면의 실제 색은 <b>뒤에 무엇이 오는지에 따라 달라진다.</b> 위 수치는 오로라의
    평균색 기준이고, 밝은 덩어리 바로 위에서는 라이트 모드 본문 대비가 더 낮아진다. 실제로 넣는다면
    유리 뒤에 불투명한 최소 레이어를 한 겹 깔아 최악의 경우를 고정하는 편이 안전하다.
    <br><br>
    <code>backdrop-filter</code>는 저사양 기기에서 스크롤 중 비용이 있다. 타연은 이미 상단바에서
    <code>blur(18px) saturate(150%)</code>를 쓰고 있어 완전히 새로운 비용은 아니지만, 대화가
    길어지는 화면에서 유리 면이 여러 겹 겹치는 건 별개 문제다.
    <br><br>
    생성: <code>node doc/design/build-glass-mockup.mjs</code>
  </footer>
</div>
</body>
</html>
`;

writeFileSync("doc/design/glass-mockup.html", html);
console.log("wrote doc/design/glass-mockup.html");
for (const [key, t] of Object.entries(THEMES)) {
  const surface = composite(t.glass, t.glassAlpha, t.backdropAvg);
  console.log(
    `${t.label.padEnd(4)} 유리 실제색 ${surface}  본문 ${fmt(contrast(surface, t.text))}` +
      `  보조 ${fmt(contrast(surface, t.textMuted))}  링크 ${fmt(contrast(surface, t.link))}`,
  );
}
