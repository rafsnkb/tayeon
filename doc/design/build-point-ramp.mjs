// 브랜드 핑크 #ff007f 한 색으로 버튼·링크·뱃지·배경을 전부 처리하던 것을, 명도 계단으로
// 나눠 역할별로 배정하기 위한 계산기. 의존성 없이 돌아간다:
//   node doc/design/build-point-ramp.mjs
//
// OKLCH를 쓰는 이유: HSL에서 명도만 내리면 색상이 눈에 띄게 틀어지는데(특히 분홍/보라 구간),
// OKLab은 지각적으로 균등해서 L만 바꾸면 "같은 분홍의 밝기 차이"로 읽힌다. 채도(C)는 sRGB를
// 벗어나는 순간 클리핑되므로, 색역 안에 들어올 때까지 줄여서 맞춘다.

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function rgbToHex([r, g, b]) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const inGamut = ([r, g, b]) => [r, g, b].every((v) => v >= -0.0005 && v <= 1.0005);

/** 주어진 L·H에서 sRGB 안에 들어오는 가장 진한 색을 찾는다(채도를 이분 탐색으로 줄인다). */
export function oklch(L, C, H) {
  const rad = (H * Math.PI) / 180;
  const at = (c) => oklabToRgb([L, c * Math.cos(rad), c * Math.sin(rad)]);
  if (inGamut(at(C))) return at(C);
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(at(mid))) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

export function toOklch(hex) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return { L, C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180) / Math.PI };
}

const relLum = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BRAND = "#ff007f";
const base = toOklch(BRAND);

// 계단의 L 값. 50~900은 흔한 명명 규칙을 따른다(숫자가 클수록 어둡다).
const STEPS = [
  [50, 0.97], [100, 0.94], [200, 0.88], [300, 0.79],
  [400, 0.7], [500, base.L], [600, 0.56], [700, 0.48],
  [800, 0.4], [900, 0.32],
];

export const RAMP = Object.fromEntries(
  STEPS.map(([name, L]) => [name, rgbToHex(oklch(L, base.C, base.H))]),
);

// 표는 항상 출력한다 — 이 파일은 import용이자 곧 리포트다(윈도우에서는 import.meta.url과
// process.argv[1]의 경로 표기가 달라 "직접 실행인가" 판별이 조용히 빗나간다).
{
  console.log(`brand ${BRAND} → L ${base.L.toFixed(3)}  C ${base.C.toFixed(3)}  H ${base.H.toFixed(1)}°\n`);
  const ON = { "흰 글씨": "#ffffff", "검은 글씨": "#000000" };
  const SURFACES = { "라이트 bg #f7f4fb": "#f7f4fb", "다크 bg #141517": "#141517" };
  console.log("step  hex        흰글씨  검은글씨  라이트bg위  다크bg위");
  for (const [name, hex] of Object.entries(RAMP)) {
    const cells = [
      contrast(hex, ON["흰 글씨"]),
      contrast(hex, ON["검은 글씨"]),
      contrast(hex, SURFACES["라이트 bg #f7f4fb"]),
      contrast(hex, SURFACES["다크 bg #141517"]),
    ];
    console.log(
      `${String(name).padEnd(5)} ${hex}   ` +
        cells.map((c) => c.toFixed(2).padStart(6)).join("  "),
    );
  }
}
