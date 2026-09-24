// 코랄 버튼 안쪽 글로우(inner glow) 값을 고르기 위한 탐침.
//   1) node doc/design/probe-inner-glow.mjs            → _inner-glow.html 생성
//   2) 저장소 루트를 HTTP 로 서빙해 /doc/design/_inner-glow.html 을 캡처
//      → doc/design/_inner-glow.png 로 저장
//   3) node doc/design/probe-inner-glow.mjs measure    → 가장자리 상승분 표 출력
//
// 왜 재야 하나: box-shadow 의 알파는 넣은 값대로 화면에 나오지 않는다. 블러가 같은
// 양을 여러 픽셀에 퍼뜨리기 때문에 가장자리 실제 값은 훨씬 옅다. 바깥 글로우 때도
// 눈대중이 빗나가서 렌더를 재서 맞췄다(globals.css 주석 참고).
//
// 측정 방법: 각 견본의 세로 중앙을 가로로 훑어, 버튼 왼쪽 가장자리에서 안쪽으로
// 들어가며 OKLab L 을 읽는다. 같은 자리의 "글로우 없음" 견본과의 차이가 상승분이다.

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { toOklch } from "./build-point-ramp.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const MODES = [
  {
    key: "dark",
    label: "다크",
    page: "#130f0f",
    from: "#ff7e8e", // --point-light
    to: "#f53a63", // --point
    glow: "rgba(245, 58, 99, 0.355)",
  },
  {
    key: "light",
    label: "라이트",
    page: "#f9f3f3",
    from: "#ff758e",
    to: "#e04e6e",
    glow: "rgba(224, 78, 110, 0.4)",
  },
];

// 후보: 블러 / 알파. "테두리가 옅게 빛나는" 느낌이라 블러는 작게, 알파는 낮게 훑는다.
const BLURS = [0, 4, 6, 8, 12];
const ALPHAS = [0.25, 0.35, 0.5];
const SW_W = 260; // 견본 너비
const SW_H = 48; // 높이 — 앱의 h-12 CTA 와 같다
const GAP = 24;

const combos = [];
for (const b of BLURS) {
  for (const a of ALPHAS) {
    if (b === 0 && a !== ALPHAS[0]) continue; // 블러 0 은 기준선 한 줄이면 충분
    combos.push({ blur: b, alpha: b === 0 ? 0 : a });
  }
}

if (process.argv[2] !== "measure") {
  const swatch = (m, c, i) => `
    <div class="cell">
      <button class="btn" data-mode="${m.key}" data-i="${i}" style="
        background-image: linear-gradient(to top right, ${m.from} 0%, ${m.to} 100%);
        box-shadow: 0 0 20px 3px ${m.glow}${
          c.blur === 0 ? "" : `, inset 0 0 ${c.blur}px 0 rgba(255,255,255,${c.alpha})`
        };
      ">${c.blur === 0 ? "없음" : `blur ${c.blur} / a ${c.alpha}`}</button>
    </div>`;

  const html = `<!doctype html>
<meta charset="utf-8">
<title>inner glow 탐침</title>
<style>
  html, body { margin:0; }
  .mode { padding:${GAP}px; }
  .cell { margin-bottom:${GAP}px; }
  .btn {
    display:block; width:${SW_W}px; height:${SW_H}px;
    border:0; border-radius:${SW_H / 2}px;
    font: 600 14px system-ui, sans-serif; color:#fff;
  }
</style>
${MODES.map(
  (m) => `<section class="mode" style="background:${m.page}">
  ${combos.map((c, i) => swatch(m, c, i)).join("")}
</section>`,
).join("\n")}
`;
  fs.writeFileSync(here("./_inner-glow.html"), html);
  const rows = combos.length;
  console.log(`_inner-glow.html 생성 — 모드 ${MODES.length} x 후보 ${rows}`);
  console.log(`견본 ${SW_W}x${SW_H}, 여백 ${GAP}`);
  console.log(`한 모드 높이 ${GAP + rows * (SW_H + GAP)}px`);
  console.log("\n다음: 루트를 서빙해 /doc/design/_inner-glow.html 을 캡처 → doc/design/_inner-glow.png");
} else {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(here("./_inner-glow.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const CH = info.channels;
  const px = (x, y) => {
    const i = (y * W + x) * CH;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  // scale:"css" 로 캡처하므로 1 CSS px = 1 이미지 px 다. 폭은 스크롤바 때문에 308 보다
  // 좁게 나오지만 버튼은 고정 폭이라 위치는 그대로다(섹션 패딩 GAP 에서 시작).
  const S = (n) => Math.round(n);

  // 버튼 왼쪽 가장자리에서 안쪽으로 들어가며 볼 지점들
  const PROBE = [1, 2, 3, 4, 6, 8, 12, 20];
  // 섹션 높이 = 위 패딩 + 행들 + 아래 패딩. 마지막 행의 margin-bottom 과 섹션 패딩이
  // 둘 다 살아 있어서 아래 GAP 을 한 번 더 더해야 실제 캡처 높이(984)와 맞는다.
  const modeH = GAP + combos.length * (SW_H + GAP) + GAP;

  if (process.argv[3] === "diag") {
    console.log(`이미지 ${W}x${info.height}, 섹션 높이 예상 ${modeH} (x2 = ${modeH * 2})`);
    const y = S(GAP + SW_H / 2);
    console.log(`기준선 행 y=${y} 에서 x=18..30:`);
    for (let x = 18; x <= 30; x++) console.log(`  x ${x}  ${hex(...px(x, y))}`);
    process.exit(0);
  }

  console.log("=".repeat(92));
  console.log("안쪽 글로우 — 왼쪽 가장자리에서 안쪽으로 들어가며 잰 OKLab L (기준선 대비 상승분)");
  console.log("=".repeat(92));

  for (let mi = 0; mi < MODES.length; mi++) {
    const m = MODES[mi];
    const base = [];
    const rowsOut = [];
    for (let i = 0; i < combos.length; i++) {
      const c = combos[i];
      const y = S(mi * modeH + GAP + i * (SW_H + GAP) + SW_H / 2);
      const x0 = S(GAP);
      const vals = PROBE.map((d) => toOklch(hex(...px(x0 + S(d), y))).L);
      if (i === 0) base.push(...vals);
      rowsOut.push({ c, vals });
    }
    console.log(`\n[${m.label}]  안쪽 거리(px):  ${PROBE.map((d) => String(d).padStart(7)).join("")}`);
    for (const { c, vals } of rowsOut) {
      const label = c.blur === 0 ? "기준선(없음)" : `blur ${c.blur} / a ${c.alpha}`;
      const cells = vals
        .map((v, k) => (c.blur === 0 ? v.toFixed(3) : `+${(v - base[k]).toFixed(3)}`).padStart(7))
        .join("");
      console.log(`  ${label.padEnd(20)}${cells}`);
    }
  }
  console.log("\n기준선 행은 L 절대값, 나머지는 기준선 대비 ΔL 이다.");
}
