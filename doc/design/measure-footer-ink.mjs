// 메인 하단 사업자정보의 글자색 실측. 12px 글자는 획이 얇아 한 픽셀만 보면 안티앨리어싱에
// 섞인 값을 집는다 — 띠 전체 픽셀을 모아 백분위로 "획의 중심"을 고른다.
import { load, px, hex, DPR } from "./measure-lib.mjs";
const css = (v) => +(v / DPR).toFixed(1);
const FILES = { dark: "asset/Screen/New/Main_Dark.png", light: "asset/Screen/New/Main_Light.png" };

// 실측 줄 위치: 정보 4줄 top 660·672·684·696.7, 링크 줄 top 711.3
const BANDS = {
  "정보 1줄": [659, 670], "정보 2줄": [671, 682], "정보 3줄": [683, 694], "정보 4줄": [695, 706],
  "링크 줄": [710, 723],
};

for (const [mode, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${mode} ===`);
  for (const [name, [y0, y1]] of Object.entries(BANDS)) {
    const lum = [];
    const pixels = [];
    for (let y = Math.round(y0 * DPR); y < Math.round(y1 * DPR); y++) {
      for (let x = Math.round(60 * DPR); x < Math.round(352 * DPR); x++) {
        const p = px(img, x, y);
        lum.push(p[0] + p[1] + p[2]);
        pixels.push(p);
      }
    }
    const order = lum.map((v, i) => i).sort((a, b) => lum[a] - lum[b]);
    // 다크: 글자가 밝다 → 위쪽 백분위. 라이트: 글자가 어둡다 → 아래쪽 백분위.
    const pick = (q) => pixels[order[Math.floor((order.length - 1) * q)]];
    const bgQ = mode === "dark" ? 0.5 : 0.5;
    console.log(
      `  ${name}: 배경 ${hex(...pick(bgQ))}  ` +
        (mode === "dark"
          ? `잉크 p98 ${hex(...pick(0.98))} / p99.5 ${hex(...pick(0.995))} / 최대 ${hex(...pick(1))}`
          : `잉크 p2 ${hex(...pick(0.02))} / p0.5 ${hex(...pick(0.005))} / 최소 ${hex(...pick(0))}`)
    );
  }
}
