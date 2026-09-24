// 스크린샷 실측 공용 함수. measure-toss.mjs / measure-toss-chat.mjs 가 같이 쓴다.
//
// 잉크 높이를 잴 때의 핵심은 "상자 중심을 포함하는 연속 잉크 덩어리만 고른다"는 것이다.
// 상자를 좁히면 글자가 잘리고, 넓히면 위아래 이웃 요소를 문다. 둘 다 조용히 틀린 값을 낸다.

import sharp from "sharp";

export const DPR = 3; // 아이폰 15 Pro 캡처 1179x2556 = CSS 393x852pt

export const hex = (r, g, b) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

export async function load(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

export const px = (img, x, y) => {
  const i = (y * img.w + x) * img.ch;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

export const pxHex = (img, x, y) => hex(...px(img, x, y));

const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];

/** 상자 위·아래 가장자리 행의 중앙값 = 배경 추정 */
export function bgOf(img, { x0, y0, x1, y1 }) {
  const edge = [];
  for (const y of [y0, y1 - 1]) for (let x = x0; x < x1; x++) edge.push(px(img, x, y));
  return [0, 1, 2].map((c) => med(edge.map((p) => p[c])));
}

/** 행별 잉크 픽셀 수 → 연속 덩어리 목록 */
export function bands(img, box, thresh = 28, gap = 3) {
  const { x0, y0, x1, y1 } = box;
  const bg = bgOf(img, box);
  const rows = [];
  for (let y = y0; y < y1; y++) {
    let ink = 0;
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      if (Math.max(...[0, 1, 2].map((c) => Math.abs(p[c] - bg[c]))) > thresh) ink++;
    }
    rows.push(ink);
  }
  const min = Math.max(2, Math.round((x1 - x0) * 0.01));
  const out = [];
  let cur = null;
  let blank = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] >= min) {
      if (!cur) cur = { first: i, last: i };
      else cur.last = i;
      blank = 0;
    } else if (cur && ++blank > gap) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return { bg: hex(...bg), rows, bands: out };
}

/** 상자 중심을 품은 덩어리의 높이. 경계에 닿으면 clipped로 표시한다. */
export function inkHeight(img, box, thresh = 28) {
  const { rows, bands: bs, bg } = bands(img, box, thresh);
  if (!bs.length) return null;
  const mid = Math.floor(rows.length / 2);
  const band =
    bs.find((b) => mid >= b.first && mid <= b.last) ??
    bs.reduce((a, b) =>
      Math.abs((b.first + b.last) / 2 - mid) < Math.abs((a.first + a.last) / 2 - mid) ? b : a,
    );
  const inkPx = band.last - band.first + 1;
  return {
    bg,
    inkPx,
    inkCss: inkPx / DPR,
    clipped: (band.first === 0 ? "위" : "") + (band.last === rows.length - 1 ? "아래" : ""),
  };
}

/** 상자 안에서 배경과 가장 먼 픽셀 = 안티앨리어싱에 안 섞인 글자 본색 */
export function inkColor(img, box) {
  const { x0, y0, x1, y1 } = box;
  const bg = bgOf(img, box);
  const bgLum = bg[0] + bg[1] + bg[2];
  let best = null;
  let bestD = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = px(img, x, y);
      const d = Math.abs(p[0] + p[1] + p[2] - bgLum);
      if (d > bestD) { bestD = d; best = p; }
    }
  }
  return { bg: hex(...bg), ink: hex(...best) };
}

/** 위에서 아래로 좌측 시작 x가 안정될 때까지의 행 수 = 모서리 반경 */
export function radius(img, { yTop, fill, scan = 90, tol = 10 }) {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const firsts = [];
  for (let dy = 0; dy < scan; dy++) {
    const y = yTop + dy;
    let fx = null;
    for (let x = 5; x < img.w - 5; x++) if (near(px(img, x, y), fill)) { fx = x; break; }
    firsts.push(fx);
  }
  const seen = firsts.filter((v) => v !== null);
  if (!seen.length) return null;
  const minX = Math.min(...seen);
  const settle = firsts.findIndex((v) => v !== null && v <= minX + 1);
  return { left: minX, rPx: settle, rCss: +(settle / DPR).toFixed(1) };
}
