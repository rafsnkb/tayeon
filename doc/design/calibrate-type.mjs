// 토스에서 잰 "잉크 높이"를 타연 폰트(Pretendard)의 font-size로 옮기기 위한 보정.
//
// 왜 필요한가: 한글 잉크 높이 / em 비율은 폰트마다, 글자마다 다르다("홈"과 "이성희님,"은
// 같은 크기여도 잉크 높이가 다르다). 비율을 짐작하면 그 오차가 그대로 화면에 남는다.
// 그래서 토스에서 읽은 문자열 그대로를 Pretendard 200px로 렌더해 잉크를 재고,
//   font-size = 토스_잉크CSS / (측정_잉크 / 200)
// 로 되돌린다. 같은 글자 · 같은 폰트끼리 비교하므로 비율 가정이 사라진다.
//
// 1단계:  node doc/design/calibrate-type.mjs        → _calibrate-type.html 생성
// 2단계:  (브라우저로 열어 풀페이지 스크린샷을 _calibrate-type.png 로 저장)
// 3단계:  node doc/design/calibrate-type.mjs measure → 보정표 출력

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
// 홈·설정 화면(_toss-ink.json)과 대화방 화면(_toss-chat-ink.json)을 함께 환산한다.
const INK = ["./_toss-ink.json", "./_toss-chat-ink.json"].flatMap((f) => {
  try { return JSON.parse(fs.readFileSync(here(f), "utf8")); } catch { return []; }
});
const REF = 200; // 렌더 기준 크기. 클수록 잉크 경계가 또렷해 비율 오차가 준다.
// 행 슬롯. 크롬 풀페이지 캡처는 16384px에서 잘리므로 문자열이 늘면 여기가 먼저 걸린다.
// 한글 잉크는 200px 행상자 안에서 176px 정도라 1.25배면 위아래 37px씩 남아 안전하다.
const SLOT = Math.round(REF * 1.25);

// 같은 문자열이 여러 번 나오므로 중복을 제거한다. 웨이트는 프로젝트가 싣는 600/700만.
const STRINGS = [...new Set(INK.map((r) => r.str))];
const WEIGHTS = [600, 700];

if (process.argv[2] !== "measure") {
  const rows = [];
  for (const w of WEIGHTS) {
    for (const s of STRINGS) {
      rows.push(
        `<div class="row" data-w="${w}" data-s="${encodeURIComponent(s)}">` +
          `<span style="font-weight:${w}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>` +
          `</div>`,
      );
    }
  }
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Pretendard 잉크 보정</title>
<style>
  @font-face { font-family:"Pretendard"; src:url("/asset/font/Pretendard-SemiBold.otf") format("opentype"); font-weight:600; }
  @font-face { font-family:"Pretendard"; src:url("/asset/font/Pretendard-Bold.otf") format("opentype"); font-weight:700; }
  /* 흰 바탕 · 검은 글자 · 여백 넉넉히. 행마다 정확히 ${REF}px 슬롯을 줘서 잉크가 섞이지 않게 한다. */
  html,body { margin:0; background:#fff; }
  .row { height:${SLOT}px; display:flex; align-items:center; padding-left:40px; }
  .row span { font-family:"Pretendard"; font-size:${REF}px; line-height:1; color:#000; white-space:pre; }
</style>
${rows.join("\n")}
`;
  fs.writeFileSync(here("./_calibrate-type.html"), html);
  console.log(`_calibrate-type.html 생성 — 행 ${rows.length}개 (문자열 ${STRINGS.length} x 웨이트 ${WEIGHTS.length})`);
  console.log(`행 높이 ${SLOT}px, 총 높이 ${rows.length * SLOT}px`);
  console.log("\n다음: 저장소 루트를 서빙해 /doc/design/_calibrate-type.html 을 풀페이지 캡처 →");
  console.log("      doc/design/_calibrate-type.png 로 저장한 뒤 `node doc/design/calibrate-type.mjs measure`");
} else {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(here("./_calibrate-type.png"))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const CH = info.channels;
  const dark = (x, y) => data[(y * W + x) * CH] < 128; // 흰 바탕 위 검은 글자

  const measured = new Map();
  let i = 0;
  for (const w of WEIGHTS) {
    for (const s of STRINGS) {
      const y0 = i * SLOT;
      const y1 = Math.min(info.height, y0 + SLOT);
      let first = -1;
      let last = -1;
      for (let y = y0; y < y1; y++) {
        let ink = 0;
        for (let x = 0; x < W; x++) if (dark(x, y)) { ink++; if (ink > 1) break; }
        if (ink > 1) { if (first < 0) first = y; last = y; }
      }
      measured.set(`${w}|${s}`, first < 0 ? null : last - first + 1);
      i++;
    }
  }

  console.log("=".repeat(96));
  console.log(`Pretendard 잉크 비율 — ${REF}px 렌더 실측`);
  console.log("=".repeat(96));
  console.log("웨이트  문자열                  잉크px   잉크/em");
  for (const w of WEIGHTS) {
    for (const s of STRINGS) {
      const m = measured.get(`${w}|${s}`);
      console.log(
        `${String(w).padEnd(8)}${s.padEnd(24)}${String(m ?? "—").padStart(6)}   ${m ? (m / REF).toFixed(4) : "—"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(96));
  console.log("토스 잉크 → Pretendard font-size 환산");
  console.log("=".repeat(96));
  console.log("샷       항목                       토스잉크  w600    w700   반올림  비고");
  const STEPS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30, 32];
  for (const r of INK) {
    const out = WEIGHTS.map((w) => {
      const m = measured.get(`${w}|${r.str}`);
      return m ? (r.inkCss / (m / REF)) : null;
    });
    const pick = out[0]; // 본문 기본은 600
    const snap = pick ? STEPS.reduce((a, b) => (Math.abs(b - pick) < Math.abs(a - pick) ? b : a)) : "—";
    console.log(
      `${r.shot.padEnd(9)}${r.label.padEnd(27)}${r.inkCss.toFixed(2).padStart(7)}  ` +
        out.map((v) => (v ? v.toFixed(2).padStart(6) : "     —")).join("  ") +
        `  ${String(snap).padStart(6)}  ${r.ink}`,
    );
  }
}
