// 토스 앱 스크린샷(아이폰 15 Pro)에서 실측한 톤·글자 크기·대화방 구조 위에 타연 색을 올린 목업.
//   node doc/design/build-toss-tone-mockup.mjs  →  doc/design/toss-tone-mockup.html
//
// 입력값은 전부 measure-toss.mjs / measure-toss-chat.mjs / calibrate-type.mjs 가 픽셀에서
// 읽어온 것이다. 눈대중 없음.
//
// 색은 PALETTE 한 곳에서만 나온다. 사용자가 고른 코랄 값을 실측하면 여기만 갈면 된다.

import fs from "node:fs";
import { toOklch, oklch, rgbToHex, contrast } from "./build-point-ramp.mjs";

// ── 실측값: 홈·설정 화면 (measure-toss.mjs) ────────────────────────────────
const TOSS = {
  page: "#101012", // 그룹 배경
  card: "#171719", // 카드 면
  raised: "#2b2b2d", // 한 단계 더 올린 면 (검색창)
  strong: "#ffffff",
  text: "#dddfe5",
  label: "#b6b8bb",
  caption: "#8b8d8f",
  muted: "#6b6c6e",
  blueFill: "#3182f6", // CTA 채움
  blueText: "#4396fb", // 다크 면 위 글자
  radiusCss: 17.3, // 설정 카드 모서리
};

// ── 실측값: 대화방 (measure-toss-chat.mjs) ─────────────────────────────────
// 홈·설정과 다른 점이 셋이다.
//  · 대화방 페이지는 그룹 배경(#101012)이 아니라 카드 톤(#17171c)이다.
//  · 제안 패널·선택 카드·입력창이 전부 페이지와 같은 색이다 — 면을 올려서 나누지 않는다.
//  · 화면 아래쪽에 키 컬러 워시가 깔린다. 홈·설정이 완전한 무채색이었던 것과 정반대다.
const CHAT = {
  page: "#17171c",
  washPeak: "#212f4d", // CSS y 627~757에서 가장 진함
  washEnd: "#202c45", // 화면 맨 아래
  bubble: "#3485fa", // 사용자 말풍선 = 키 컬러 채움
  send: "#4396fb", // 보내기 버튼 = 한 단계 밝은 쪽
  danger: "#f04452", // 종료하기
  disFill: "#192b49", // 비활성 CTA 면
  disText: "#264a7f", // 그 위 글자
  dialog: "#2c2c35",
  dialogBtn: "#3f3f4b", // 닫기 버튼 면
  dialogTitle: "#e4e4e5", // 모달 제목 (면 위 10.88)
  dialogBtnText: "#c3c3c6", // 닫기 라벨 — 제목보다 한 단계 낮다 (5.90). 부차적 선택지라는 신호
  dangerText: "#ffffff", // 종료하기 라벨. 토스 자신은 3.71로 쓴다
  bot: "#e4e4e5", // 봇 글 (말풍선 없이 페이지 위)
  quiet: "#7e7e87", // 안내·날짜·시각·자리표시
  aiNote: "#9d9ea5",
  rPanel: 18.7,
  rBubble: 15.3,
  rField: 10,
};

// ── 글자 크기 (calibrate-type.mjs: 토스 잉크 → Pretendard font-size) ────────
const TYPE = {
  time: 11, // 말풍선 시각
  aiNote: 13, // AI 고지 · 아이콘 캡션
  notice: 15, // 대화 안내·날짜·구분선
  suggest: 16, // 제안 줄 · 섹션 제목 · 상담 종료
  body: 17, // 본문 · 봇 글 · 말풍선 · 행 라벨 · 입력창
  choice: 18, // 선택 카드 줄 · 섹션 헤더 · 종료하기
  dialog: 20, // 다이얼로그 제목
  title: 22, // 화면 제목
};

// ── 실측값: 사용자의 코랄 리컬러 (measure-coral.mjs) ───────────────────────
// 사용자가 토스 챗봇 화면을 직접 코랄로 칠한 판(asset/Screen/sample_003.webp)이 확정 방향이다.
// 여기서 잰 값이 팔레트의 기준이고, 토스 값은 "무엇이 어떻게 달라졌는지"를 설명하는 비교용이다.
const CORAL = {
  page: "#1d1818", // 대화방 페이지. 완전한 무채가 아니라 H 18°로 살짝 따뜻하다
  fill: "#f53a63", // 사용자 말풍선 채움
  washPeak: "#4a2229", // 워시 최고점 (CSS y ~750)
  washEnd: "#442126", // 화면 맨 아래
  border: "#573238", // 선택 카드 테두리
  disFill: "#471a23", // 비활성 CTA 면
  disText: "#7e3043", // 그 위 글자
  bot: "#f1ecec", // 봇 글
  endBtn: "#ece6e6", // 상담 종료
  quiet: "#8b8786", // 안내·시각·자리표시
  aiNote: "#b2a2a0",
};

const BRAND_H = toOklch("#ff007f").H;
const coralSrc = toOklch(CORAL.fill);
// 잰 자리가 없는 무채색은 사용자의 판과 같은 기울기로 만든다 — C 0.005~0.008, H 18°로 따뜻하다.
const WARM_H = toOklch(CORAL.page).H;
const warm = (L, C = 0.008) => rgbToHex(oklch(L, C, WARM_H));

// ── 절제 추출 ───────────────────────────────────────────────────────────────
// oklch()는 sRGB를 벗어나면 채도를 깎아 돌려주므로, 큰 C를 넣으면 그 L·H의 최대 채도가 나온다.
// 토스가 그 최대의 몇 %를 쓰는지 = 이 브랜드의 절제. 그 비율을 타연 색상각에 옮긴다.
const maxC = (L, H) => toOklch(rgbToHex(oklch(L, 0.5, H))).C;
// 이름이 use* 로 시작하면 eslint 가 React 훅으로 읽어 에러를 낸다 — chromaUse 로 둔다.
const chromaUse = (hex) => { const c = toOklch(hex); return c.C / maxC(c.L, c.H); };
const port = (srcHex, H = BRAND_H, L = null) => {
  const c = toOklch(srcHex);
  const LL = L ?? c.L;
  return rgbToHex(oklch(LL, maxC(LL, H) * chromaUse(srcHex), H));
};

const fillSrc = toOklch(TOSS.blueFill);
const textSrc = toOklch(TOSS.blueText);
const fillUse = chromaUse(TOSS.blueFill);
const textUse = chromaUse(TOSS.blueText);

// 채움은 사용자가 고른 코랄을 그대로 쓴다. 흰 글자 대비가 4.5에 못 미치므로(3.71),
// 작은 글자에 얹을 때를 위해 같은 색상각·같은 채도 사용률로 L만 내린 대안도 같이 만든다.
// 어느 쪽을 쓸지는 화면마다 사용자가 정할 일이라, 기본은 고른 값을 유지한다.
const CORAL_H = coralSrc.H;
const coralUse = chromaUse(CORAL.fill);
function darkenTo(target, startL, use, H) {
  let L = startL;
  for (let i = 0; i < 400 && L > 0; i++) {
    const hex = rgbToHex(oklch(L, maxC(L, H) * use, H));
    if (contrast(hex, "#ffffff") >= target) return { hex, L };
    L -= 0.002;
  }
  return { hex: rgbToHex(oklch(0.3, maxC(0.3, H) * use, H)), L: 0.3 };
}
const fillAA = darkenTo(4.5, coralSrc.L, coralUse, CORAL_H); // 흰 글자 4.5를 만족하는 대안
// 다크 면 위에 글자로 쓰는 코랄은 토스가 파랑에서 쓴 단차(+0.05 L)를 그대로 적용한다.
const coralText = rgbToHex(oklch(coralSrc.L + (textSrc.L - fillSrc.L),
  maxC(coralSrc.L + (textSrc.L - fillSrc.L), CORAL_H) * textUse, CORAL_H));

// ── 라이트는 다크에서 만든다 ────────────────────────────────────────────────
const dPage = toOklch(TOSS.page).L;
const gapCard = toOklch(TOSS.card).L - dPage;
const gapRaise = toOklch(TOSS.raised).L - toOklch(TOSS.card).L;
// 토스 면은 C 0.004로 살짝 푸르지만, 사용자의 코랄 판은 H 18°로 따뜻하다. 따뜻한 쪽을 따른다.
const gray = (L) => warm(L, 0.006);

const LIGHT = { page: gray(1.0 - gapCard), card: gray(1.0), raised: gray(1.0 - gapRaise) };

/** 다크에서 나온 명암비를 라이트가 밑돌지 않게 L을 내린다. */
function mirrorText(darkHex, darkBg, lightBg) {
  const target = contrast(darkHex, darkBg);
  const start = toOklch(lightBg).L - (toOklch(darkHex).L - toOklch(darkBg).L);
  let L = start;
  for (let i = 0; i < 400 && L > 0; i++) {
    const hex = gray(L);
    if (contrast(hex, lightBg) >= target) return { hex, L, start, moved: start - L };
    L -= 0.002;
  }
  return { hex: gray(0), L: 0, start, moved: start };
}
/** 코랄 글자도 같은 기준 — 다크에서의 대비를 라이트에서 재현한다. */
function mirrorPoint(darkHex, darkBg, lightBg, use) {
  const target = contrast(darkHex, darkBg);
  let L = toOklch(darkHex).L;
  for (let i = 0; i < 400 && L > 0; i++) {
    const hex = rgbToHex(oklch(L, maxC(L, CORAL_H) * use, CORAL_H));
    if (contrast(hex, lightBg) >= target) return { hex, L };
    L -= 0.002;
  }
  return { hex: rgbToHex(oklch(0.3, maxC(0.3, CORAL_H) * use, CORAL_H)), L: 0.3 };
}

const mirrorLog = [];
const lightOf = (darkHex, darkBg = TOSS.card, lightBg = LIGHT.card, role = "") => {
  const m = mirrorText(darkHex, darkBg, lightBg);
  mirrorLog.push({ role, dark: darkHex, darkBg, lightBg, ...m });
  return m.hex;
};

// 대화방 페이지는 사용자가 칠한 값을 그대로 쓴다. 라이트판은 같은 거리를 뒤집어 만든다.
const dChatPage = toOklch(CORAL.page).L;
const lChatPage = gray(1.0 - (dChatPage - dPage));

// 워시: 사용자 판에서 잰 두 지점을 그대로 쓰고, 라이트는 같은 거리를 아래로 뒤집는다.
const washDist = toOklch(CORAL.washPeak).L - dChatPage;
const washEndDist = toOklch(CORAL.washEnd).L - dChatPage;
const washAt = (baseL, dist, srcHex, up) => {
  const L = up ? baseL + dist : baseL - dist;
  return rgbToHex(oklch(L, maxC(L, CORAL_H) * chromaUse(srcHex), CORAL_H));
};

// 파괴적 버튼.
//  · 글자는 토스와 같은 순백이다. 토스 라벨의 글리프 내부 최빈색이 #ffffff(1397px)로 실측됐다.
//  · 면은 시인성을 위해 토스보다 한 단계 어둡게 쓴다. 토스 #f04452는 흰 글자가 3.71뿐이라,
//    색상각을 H 32°로 밀고 명도를 내려 4.53을 맞췄다. 코랄(H 14.1°)과도 그만큼 벌어진다.
const DANGER_H = 32;
const dangerShifted = port(CHAT.danger, DANGER_H); // 색상각만 민 단계 · 3.67
const danger = darkenTo(4.5, toOklch(dangerShifted).L, chromaUse(CHAT.danger), DANGER_H).hex;
const DANGER_TEXT = "#ffffff"; // 토스 실측 그대로

// ── 버튼 그라데이션·글로우 (asset/Screen/sample_005.png 실측) ───────────────
// 토스 CTA는 단색이 아니다. 좌하단 모서리에서 밝아져 우상단으로 사라지는 대각 그라데이션에,
// 버튼 아래로 번지는 글로우가 붙는다.
//  · 밝은 끝 #63a7ff = 기본 #3182f6 보다 L +0.102. 그 L·H에서 낼 수 있는 최대 채도를 100% 쓴다
//    (기본이 92.2%인 것과 다르다 — 밝아질수록 sRGB 천장이 내려와 저절로 꽉 찬다).
//  · 그라데이션은 버튼 폭의 절반쯤에서 기본색에 닿는다(좌하단 L 0.725 → x 중간에서 0.620).
//  · 글로우 최고점 #1e2d44 는 버튼 색을 알파 0.183 으로 페이지에 얹은 것과 같다.
//    아래로 약 19 CSS px 에 걸쳐 페이지 색까지 떨어진다.
const GRAD_DL = toOklch("#63a7ff").L - toOklch("#3182f6").L;
const GRAD_USE = chromaUse("#63a7ff");
const GLOW_PEAK = 0.183;
// 토스는 좌하단 모서리에만 하이라이트를 두고 폭의 2/3 지점에서 기본색에 닿지만,
// 우리는 면 전체를 쓴다 — 좌하단에서 우상단까지 끊기지 않고 밝은 끝 → 기본으로 흐른다.
const GRAD = "linear-gradient(to top right, var(--fill-light) 0%, var(--fill) 100%)";
const LIGHT_FILL = "#e04e6e"; // 라이트 모드 키컬러 (사용자 지정)

const lighten = (baseHex) => {
  const c = toOklch(baseHex);
  const L = c.L + GRAD_DL;
  return rgbToHex(oklch(L, maxC(L, c.H) * GRAD_USE, c.H));
};
/**
 * 글로우는 포토샵의 drop shadow 가 아니라 outer glow 다 — y 오프셋을 주면 아래로만 깔려
 * 그림자로 읽힌다. 오프셋 0 에 스프레드를 줘서 네 방향으로 고르게 번지게 한다.
 * box-shadow 알파는 블러를 거치며 옅어지므로, 넣은 값이 아니라 렌더를 재서 맞춘다.
 */
const rgba = (hex, a) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
};

// ── 패널 외곽선 (sample_005 실측) ──────────────────────────────────────────
// 토스 카드는 네 변에 1css px 띠를 두른다. #1f1f21 로, 카드 면 #1a1a1d 보다 OKLab L 이
// 0.021 높다(페이지보다는 0.066 높다). 면을 올려 나누는 대신 가장자리만 살짝 들어 올리는 방식.
//
// 라이트에서 "카드보다 0.021 내린다"로 뒤집었더니 선이 안 보였다. 다크에서는 선이
// 페이지(0.174) < 카드(0.219) < 선(0.240) 으로 범위 <바깥>에 있어 테두리로 읽히는데,
// 라이트에서 같은 식으로 잡으면 페이지(0.968) < 선(0.979) < 카드(1.0) 로 범위 <안쪽>에
// 들어가 버린다. 카드가 이미 흰색이라 위로 더 갈 데가 없기 때문이다.
// 그래서 기준을 "양쪽 이웃 모두와 최소 0.021 은 떨어져 있을 것"으로 바꾼다.
// 다크는 min(0.021, 0.066) = 0.021 로 이미 만족하고, 라이트는 페이지보다 0.021 더
// 내려야 만족한다 — 선이 페이지 아래로 빠지면서 비로소 테두리로 읽힌다.
const PANEL_LINE_DL = 0.021;

// 잰 자리가 없는 본문 계열은 토스에서 읽은 L을 그대로 두고 따뜻한 기울기만 입힌다.
const warmAs = (tossHex) => warm(toOklch(tossHex).L, 0.006);

// 모달도 나머지 면과 같은 따뜻한 기울기를 쓴다. 토스 모달은 C 0.016~0.020 / H -75°로
// 차가운 쪽이었지만, 이 판의 화면 전체가 H 18°로 따뜻하므로 모달만 식히면 따로 논다.
// 라이트 모달은 L을 그냥 뒤집으면 안 된다. 다크에서 모달은 페이지보다 "올라온" 면인데,
// 거리를 그대로 뒤집으면 라이트에서는 페이지보다 내려앉아 판때기가 된다.
// 올라온다는 성질을 지키려면 라이트에서도 면이 가장 밝아야 하므로, 모달을 흰색에 붙이고
// 그 안의 단차(모달 → 닫기 버튼 ΔL 0.075)만 아래로 파 내려간다.
const dlgStep = toOklch(CHAT.dialogBtn).L - toOklch(CHAT.dialog).L;
const lightDialog = warm(1.0, 0.004);
const lightDialogBtn = warm(1.0 - dlgStep, 0.008);
// 토스 모달은 제목(L 0.919)과 닫기 라벨(L 0.818)을 0.101 벌려 위계를 만든다.
// 같은 낙차를 우리 제목에서 내려 "닫기는 부차적"이라는 신호를 똑같이 준다.
const dlgTextStep = toOklch(CHAT.dialogTitle).L - toOklch(CHAT.dialogBtnText).L;

const DARK = {
  page: warm(dPage, 0.006), card: warm(toOklch(TOSS.card).L, 0.006),
  raised: warm(toOklch(TOSS.raised).L, 0.008), chatPage: CORAL.page,
  strong: "#ffffff", text: warmAs(TOSS.text), label: warmAs(TOSS.label),
  caption: warmAs(TOSS.caption), muted: warmAs(TOSS.muted),
  bot: CORAL.bot, quiet: CORAL.quiet, aiNote: CORAL.aiNote,
  fill: CORAL.fill, fillLight: lighten(CORAL.fill), fillGlow: rgba(CORAL.fill, 0.355),
  point: coralText, onFill: "#ffffff",
  send: coralText,
  wash: CORAL.washPeak, washEnd: CORAL.washEnd,
  border: CORAL.border,
  panelLine: warm(toOklch(TOSS.card).L + PANEL_LINE_DL, 0.006),
  disFill: CORAL.disFill, disText: CORAL.disText,
  danger, dialog: warm(toOklch(CHAT.dialog).L, 0.010),
  dialogBtn: warm(toOklch(CHAT.dialogBtn).L, 0.012), dialogText: CORAL.bot,
  dialogBtnText: warm(toOklch(CORAL.bot).L - dlgTextStep, 0.006),
};

const LIGHTT = {
  page: LIGHT.page, card: LIGHT.card, raised: LIGHT.raised, chatPage: lChatPage,
  strong: lightOf(DARK.strong, DARK.card, LIGHT.card, "strong"),
  text: lightOf(DARK.text, DARK.card, LIGHT.card, "text"),
  label: lightOf(DARK.label, DARK.card, LIGHT.card, "label"),
  caption: lightOf(DARK.caption, DARK.card, LIGHT.card, "caption"),
  muted: lightOf(DARK.muted, DARK.card, LIGHT.card, "muted"),
  bot: lightOf(CORAL.bot, CORAL.page, lChatPage, "bot"),
  quiet: lightOf(CORAL.quiet, CORAL.page, lChatPage, "quiet"),
  aiNote: lightOf(CORAL.aiNote, CORAL.page, lChatPage, "aiNote"),
  // 라이트 키컬러는 사용자 지정 #e04e6e. 다크의 #f53a63 를 밝은 배경에 그대로 올리면
  // 시인성이 떨어져 한 단계 내린 값이다(L 0.644 → 0.631, 채도 사용률 89.3% → 72.1%).
  // 그라데이션·글로우도 이 값에서 다시 파생시킨다.
  fill: LIGHT_FILL, fillLight: lighten(LIGHT_FILL), fillGlow: rgba(LIGHT_FILL, 0.40),
  point: mirrorPoint(coralText, DARK.card, LIGHT.card, textUse).hex,
  onFill: "#ffffff",
  send: LIGHT_FILL, // 라이트에선 밝은 코랄에 흰 화살표가 안 보인다 — 채움을 그대로 쓴다
  wash: washAt(toOklch(lChatPage).L, washDist, CORAL.washPeak, false),
  washEnd: washAt(toOklch(lChatPage).L, washEndDist, CORAL.washEnd, false),
  border: rgbToHex(oklch(1.0 - (toOklch(CORAL.border).L - dChatPage),
    maxC(1.0 - (toOklch(CORAL.border).L - dChatPage), CORAL_H) * chromaUse(CORAL.border), CORAL_H)),
  panelLine: warm(1.0 - gapCard - PANEL_LINE_DL, 0.006),
  disFill: rgbToHex(oklch(1.0 - (toOklch(CORAL.disFill).L - dPage),
    maxC(1.0 - (toOklch(CORAL.disFill).L - dPage), CORAL_H) * chromaUse(CORAL.disFill), CORAL_H)),
  disText: CORAL.disText,
  danger,
  dialog: lightDialog,
  dialogBtn: lightDialogBtn,
  dialogText: warm(1.0 - (toOklch(CORAL.bot).L - dPage), 0.006),
  dialogBtnText: warm(1.0 - (toOklch(CORAL.bot).L - dPage) + dlgTextStep, 0.006),
};

// ── 리포트 ──────────────────────────────────────────────────────────────────
const f3 = (n) => n.toFixed(3);
const bar = (n = 88) => "=".repeat(n);
console.log(bar());
console.log("토스 파랑의 절제 → 타연 핑크");
console.log(bar());
console.log(`토스 채움 ${TOSS.blueFill}  L ${f3(fillSrc.L)}  C ${f3(fillSrc.C)}  ` +
  `최대채도 ${f3(maxC(fillSrc.L, fillSrc.H))} → ${(fillUse * 100).toFixed(1)}% 사용`);
console.log(`토스 글자 ${TOSS.blueText}  L ${f3(textSrc.L)}  C ${f3(textSrc.C)}  ` +
  `최대채도 ${f3(maxC(textSrc.L, textSrc.H))} → ${(textUse * 100).toFixed(1)}% 사용`);
console.log(`타연 원래 #ff007f  L 0.645  C 0.260  → 99.2% 사용 (토스보다 훨씬 진하다)`);
console.log(`\n코랄 실측 ${CORAL.fill}  L ${f3(coralSrc.L)}  C ${f3(coralSrc.C)}  H ${coralSrc.H.toFixed(1)}°` +
  `  → 최대채도의 ${(coralUse * 100).toFixed(1)}% 사용`);
console.log(`  타연 핑크 대비: L ${(coralSrc.L - toOklch("#ff007f").L >= 0 ? "+" : "")}` +
  `${(coralSrc.L - toOklch("#ff007f").L).toFixed(3)}  C ${(coralSrc.C - 0.26).toFixed(3)}  ` +
  `H +${(coralSrc.H - BRAND_H).toFixed(1)}°  — 명도는 그대로, 채도를 낮추고 색상각을 주황 쪽으로`);
console.log(`  흰 글자 ${contrast(DARK.fill, "#ffffff").toFixed(2)} (4.5 미달, AA Large 3.0은 통과)` +
  ` · 4.5를 맞추려면 ${fillAA.hex} — 고른 값은 그대로 두고 대안만 계산해 둔다`);
console.log(`글자 ${DARK.point} (카드 위 ${contrast(DARK.point, TOSS.card).toFixed(2)})`);
console.log(`워시 ${DARK.wash} → ${DARK.washEnd}  (대화방 페이지 ${DARK.chatPage} 에서 시작)`);
console.log(`파괴적 면 ${DARK.danger} + 글자 ${DANGER_TEXT} → ${contrast(DARK.danger, DANGER_TEXT).toFixed(2)}`);
console.log(`  글자는 토스와 같은 순백(실측 확인). 면만 토스 ${CHAT.danger}(3.71)보다 한 단계 내렸다`);
console.log(`  토스 빨강은 코랄(H ${coralSrc.H.toFixed(1)}°)과 ${(toOklch(CHAT.danger).H - coralSrc.H).toFixed(1)}°밖에 안 떨어진다 — ` +
  `면을 H ${DANGER_H}°로 민 덕에 그 거리도 같이 벌어졌다`);

console.log("\n" + bar());
console.log("라이트 = 다크의 L 거리를 뒤집고, 다크 명암비에 못 미치면 더 내린다");
console.log(bar());
console.log("역할      다크      다크대비   뒤집은L   실제L    더내림    라이트    라이트대비");
for (const m of mirrorLog) {
  console.log(
    `${m.role.padEnd(10)}${m.dark}  ${contrast(m.dark, m.darkBg).toFixed(2).padStart(7)}   ` +
      `${f3(m.start)}   ${f3(m.L)}   ${f3(m.moved)}   ${m.hex}  ` +
      `${contrast(m.hex, m.lightBg).toFixed(2).padStart(7)}`,
  );
}

// ── HTML ────────────────────────────────────────────────────────────────────
const vars = (t) => `
      --page:${t.page}; --card:${t.card}; --raised:${t.raised}; --chat-page:${t.chatPage};
      --strong:${t.strong}; --text:${t.text}; --label:${t.label};
      --caption:${t.caption}; --muted:${t.muted};
      --bot:${t.bot}; --quiet:${t.quiet}; --ai-note:${t.aiNote};
      --fill:${t.fill}; --fill-light:${t.fillLight}; --fill-glow:${t.fillGlow};
      --point:${t.point}; --on-fill:${t.onFill}; --send:${t.send};
      --wash:${t.wash}; --wash-end:${t.washEnd};
      --border:${t.border}; --panel-line:${t.panelLine}; --dis-fill:${t.disFill}; --dis-text:${t.disText}; --danger:${t.danger};
      --dialog:${t.dialog}; --dialog-btn:${t.dialogBtn}; --dialog-text:${t.dialogText};
      --dialog-btn-text:${t.dialogBtnText};`;

const main = () => `
      <div class="col">
        <header class="topbar">
          <button class="icobtn"><span class="ico">☰</span><span class="icolbl">메뉴</span></button>
          <span class="spacer"></span>
          <button class="icobtn"><span class="ico av">◕</span><span class="icolbl">루미</span></button>
        </header>
        <div class="scroll">
          <p class="title">안녕하세요,<br><b class="brand">올빼미</b>님</p>
          <p class="sub">판단 없이, 재촉 없이. 오늘 마음에 걸리는 걸 편하게 말씀해 주세요.</p>
          <div class="group">
            <div class="grouphead">이용권</div>
            <div class="row"><span class="rowlbl">스탠다드 이용권</span><span class="rowval">14회 남았어요</span></div>
            <div class="row"><span class="rowlbl">시간제 이용권</span><span class="rowval point">구입하기</span></div>
          </div>
          <div class="sectionhead">최근 대화</div>
          <div class="group">
            <div class="row"><span class="rowlbl">이직 고민 상담</span><span class="rowval">어제 · 완드 7</span></div>
            <div class="row"><span class="rowlbl">요즘 자꾸 지치는 이유</span><span class="rowval">3일 전 · 컵 5</span></div>
            <div class="row"><span class="rowlbl">이 관계를 계속할까</span><span class="rowval">지난주 · 소드 2</span></div>
          </div>
        </div>
        <div class="composer">
          <div class="field">지금 마음을 편하게 적어보세요</div>
          <div class="actions">
            <button class="act"><span class="ico sm">◷</span>시간제</button>
            <button class="act">원 카드 <span class="caret">▾</span></button>
            <span class="spacer"></span>
            <button class="sendbtn">보내기</button>
          </div>
        </div>
        <footer class="legal">타연 · 사업자등록번호 000-00-00000 · <span class="link">회사 정보</span></footer>
      </div>`;

const chatHead = `
        <header class="chatbar">
          <button class="back">‹</button>
          <span class="spacer"></span>
          <button class="endbtn">상담 종료</button>
        </header>`;

const aiNote = `<p class="ainote"><span class="spark">✦</span> AI가 리딩을 제공하고 있어요 <span class="info">ⓘ</span></p>`;

const chat = () => `
      <div class="col chat">
        <div class="wash"></div>
        ${chatHead}
        <div class="scroll chatscroll">
          <p class="notice">최근 3개월 대화만 보관돼요</p>
          <p class="notice">2026년 9월 22일</p>
          <div class="rule"><span>상담을 시작했어요 · 오후 8:54</span></div>
          <p class="bot">안녕하세요, 타로 상담사 루미예요.<br>어떤 고민이든 편하게 말씀해 주세요.</p>
          <div class="mine">
            <div class="bubble">올해 이직해도 괜찮을까?</div>
            <div class="time">20:55</div>
          </div>
          <p class="cardname">완드 7</p>
          <p class="bot">지금 자리를 지키려는 힘과 밖으로 나가려는 힘이 맞붙어 있어요.
            버티는 쪽이 유리해 보이지만, 그 버팀이 목적이 되면 지칩니다.</p>
        </div>
        <div class="suggest">
          <button class="sugrow">지금 <b>준비</b>해야 할 건 뭘까?</button>
          <button class="sugrow"><b>올해 안에</b> 결정해도 될까?</button>
          <button class="sugrow sep">이 카드를 더 <b>자세히</b> 풀어줘</button>
          <button class="sendfab">↑</button>
        </div>
        ${aiNote}
      </div>`;

const choiceBody = `
        <div class="scroll chatscroll">
          <div class="mine">
            <div class="bubble">요즘 자꾸 지쳐</div>
            <div class="time">20:55</div>
          </div>
          <p class="bot">정확한 리딩을 위해 조금만 더 알려주세요.<br>아래 중에서 골라주세요.</p>
          <div class="choicecard">
            <button class="choicerow"><span>일 때문에 지치는 것<br>같아요</span><span class="check">✓</span></button>
            <button class="choicerow"><span>사람 관계가 힘들어요</span><span class="check">✓</span></button>
            <button class="choicerow"><span>이유를 잘 모르겠어요</span><span class="check">✓</span></button>
            <button class="ctadis">선택했어요</button>
          </div>
        </div>
        <div class="fieldwrap"><div class="fieldpill">내용을 입력해주세요</div></div>`;

const choice = () => `
      <div class="col chat">
        <div class="wash"></div>
        ${chatHead}${choiceBody}
        ${aiNote}
      </div>`;

const dialogFrame = () => `
      <div class="col chat">
        <div class="wash"></div>
        ${chatHead}${choiceBody}
        ${aiNote}
        <div class="scrim"></div>
        <div class="dialog">
          <p class="dtitle">상담을 종료할까요?</p>
          <div class="dbtns">
            <button class="dbtn">닫기</button>
            <button class="dbtn danger">종료하기</button>
          </div>
        </div>
      </div>`;

// ── 추가 화면 4종 ───────────────────────────────────────────────────────────
// 내용과 구조는 레퍼런스 화면(asset/Screen/MenuOpen.png, MyPage.png,
// "MyProfile - InputData.png", "Buy - CountPurchase.png")에서 가져왔다. 색만 이 팔레트다.

const subBar = (title) => `
        <header class="subbar">
          <button class="back">‹</button>
          <span class="subtitle">${title}</span>
          <span class="backspace"></span>
        </header>`;

const menuOpen = () => `
      <div class="col chat">
        <div class="wash"></div>
        <div class="drawer">
          <div class="brand"><b>타</b><i>연</i></div>
          <div class="drawerbody">
            <p class="drawerlbl">최근 대화</p>
            <button class="roomrow"><span class="dot"></span>이직 고민 상담</button>
            <button class="roomrow on"><span class="dot"></span>요즘 자꾸 지치는 이유</button>
            <button class="roomrow"><span class="dot"></span>이 관계를 계속할까</button>
          </div>
          <div class="drawerfoot">
            <div class="footrow">
              <button class="mypill"><span class="avatar"></span>마이 페이지</button>
              <button class="bell"><span class="bellico">🔔</span><i class="badge"></i></button>
            </div>
            <button class="ctaFill">이용권 구입하기</button>
            <button class="ctaQuiet"><span class="plus">⊕</span>새 대화</button>
          </div>
        </div>
        <div class="drawerScrim"></div>
      </div>`;

const myPage = () => `
      <div class="col">
        ${subBar("마이 페이지")}
        <div class="scroll">
          <p class="grouplbl">계정</p>
          <div class="group pad">
            <div class="acct">
              <span class="avatar big"></span>
              <span class="acctname">라프라움<em>redteart@kakao.com</em></span>
              <button class="chip">계정정보</button>
            </div>
            <div class="row"><span class="rowlbl">횟수제 이용권</span>
              <span class="rowend"><b class="rowstrong">프리미엄 이용권</b><button class="pill">구입</button></span></div>
            <div class="row"><span class="rowlbl">9월 보너스 리워드<span class="mag">⌕</span></span><span class="rowstrong">135회 예상</span></div>
            <div class="row"><span class="rowlbl"><i class="rowico">＋</i>친구 초대하기</span><span class="chev">›</span></div>
          </div>

          <p class="grouplbl">이용권 구입</p>
          <div class="group pad">
            <div class="row"><span class="rowlbl"><i class="rowico">▤</i>이용권 구입</span><span class="chev">›</span></div>
            <div class="row"><span class="rowlbl"><i class="rowico">▭</i>결제 내역</span><span class="chev">›</span></div>
            <div class="row"><span class="rowlbl"><i class="rowico">☰</i>받은 이용권 내역</span><span class="chev">›</span></div>
          </div>

          <p class="grouplbl">프로필</p>
          <div class="group pad">
            <div class="row"><span class="rowlbl"><i class="rowico">▣</i>내 프로필 관리</span><span class="chev">›</span></div>
            <div class="row"><span class="rowlbl"><i class="rowico">◑</i>궁합 상대 프로필 관리</span><span class="chev">›</span></div>
          </div>

          <p class="grouplbl">시스템</p>
          <div class="group pad">
            <div class="row"><span class="rowlbl"><i class="rowico">◎</i>공지사항</span><span class="chev">›</span></div>
            <div class="row"><span class="rowlbl"><i class="rowico">⚙</i>설정</span><span class="chev">›</span></div>
            <div class="row"><span class="rowlbl danger"><i class="rowico danger">⇥</i>로그아웃</span><span class="chev danger">›</span></div>
          </div>
        </div>
      </div>`;

const profileEdit = () => `
      <div class="col">
        ${subBar("내 프로필 관리")}
        <div class="scroll">
          <div class="group pad form">
            <label class="fieldlbl">닉네임 <em>(변경 가능)</em><i class="req">*</i></label>
            <div class="input">라프라움</div>

            <label class="fieldlbl">생년월일<i class="req">*</i></label>
            <div class="input">1987.09.14</div>
            <div class="seg">
              <button class="segbtn on">양력</button>
              <button class="segbtn">음력</button>
              <button class="segbtn">음력(윤달)</button>
            </div>

            <label class="fieldlbl">태어난 시간</label>
            <div class="input">09:07</div>
            <label class="chkrow"><span class="box"></span>태어난 시간을 몰라요</label>
            <p class="warn">태어난 시간을 모르면 자미두수 기능을 사용할 수 없어요</p>

            <label class="fieldlbl">성별<i class="req">*</i></label>
            <div class="seg">
              <button class="segbtn">여성</button>
              <button class="segbtn on">남성</button>
              <button class="segbtn">선택안함</button>
            </div>

            <label class="fieldlbl">출생지 <em>(선택)</em></label>
            <div class="input">대전</div>
            <p class="help">출생지를 입력하면 사주ㆍ자미두수 분석 정확도가 올라가요</p>
          </div>
        </div>
        <div class="ctabar"><button class="ctaFill sq">저장하기</button></div>
      </div>`;

const optionTable = (rows) => `
            <div class="opttable">
              <div class="optheadrow"><span>옵션 이름</span><span>질문 가능 횟수</span></div>
              ${rows.map(([a, b]) => `<div class="optrow"><span>${a}</span><b>${b}</b></div>`).join("")}
            </div>`;

const buyPass = () => `
      <div class="col">
        ${subBar("구입하기")}
        <div class="scroll">
          <div class="product">
            <p class="prodname">스탠다드 이용권</p>
            <span class="prodchip">추가 횟수 +8.5% 포함</span>
          </div>
          <p class="lead">구입하실 이용권의 옵션을 선택하세요</p>

          <div class="optcard on">
            <div class="opthead">
              <span class="opttitle">타로 전용</span>
              <span class="radio on"></span>
            </div>
            ${optionTable([["원 카드", "70회"], ["쓰리 카드", "47회"], ["양자택일", "35회"], ["켈틱 크로스", "28회"]])}
          </div>

          <div class="optcard">
            <div class="opthead">
              <span class="opttitle">타로+사주</span>
              <span class="radio"></span>
            </div>
            ${optionTable([["원 카드+사주", "60회"], ["쓰리 카드+사주", "40회"], ["양자택일+사주", "30회"]])}
          </div>
        </div>
        <div class="paybar">
          <p class="payhead">결제금액</p>
          <div class="payrow"><span>상품금액 (VAT 포함)</span><span>12,900원</span></div>
          <div class="payrow total"><span>총 결제금액</span><b>12,900원</b></div>
          <button class="ctaFill sq">₩12,900 결제하기</button>
        </div>
      </div>`;

const frame = (caption, mode, body) => `
  <figure class="frame">
    <figcaption>${caption}</figcaption>
    <div class="screen ${mode}" style="${vars(mode === "dark" ? DARK : LIGHTT)}">${body}</div>
  </figure>`;

const R = TOSS.radiusCss;
const html = `<!doctype html>
<html lang="ko"><meta charset="utf-8">
<title>타연 — 토스 톤 적용</title>
<style>
  @font-face { font-family:"Pretendard"; src:url("/asset/font/Pretendard-SemiBold.otf") format("opentype"); font-weight:600; }
  @font-face { font-family:"Pretendard"; src:url("/asset/font/Pretendard-Bold.otf") format("opentype"); font-weight:700; }
  * { box-sizing:border-box; }
  body { margin:0; padding:28px; background:#0b0b0d; color:#dddfe5;
         font-family:"Pretendard",system-ui,sans-serif; font-weight:600; font-size:14px; }
  h1 { font-size:22px; margin:0 0 6px; font-weight:700; }
  h2 { font-size:16px; margin:26px 0 10px; font-weight:700; color:#b6b8bb; }
  p.note { max-width:1000px; line-height:1.65; color:#b6b8bb; margin:0 0 4px; font-size:13px; }
  table { border-collapse:collapse; font-size:12px; margin:8px 0 0; }
  th,td { border:1px solid #2b2b2d; padding:5px 9px; text-align:left; }
  th { color:#8b8d8f; font-weight:600; }
  code { font-family:ui-monospace,monospace; }

  .frames { display:flex; flex-wrap:wrap; gap:22px; align-items:flex-start; margin-top:12px; }
  .frame { margin:0; }
  figcaption { font-size:12px; color:#8b8d8f; margin-bottom:7px; }

  /* 393x852 = 아이폰 15 Pro CSS 뷰포트. 스크린샷과 같은 자에 올려놓고 본다. */
  .screen { width:393px; height:852px; border-radius:26px; overflow:hidden;
            background:var(--page); color:var(--text); position:relative;
            display:flex; flex-direction:column; }
  .screen.light { box-shadow:0 0 0 1px #2b2b2d; }
  .col { display:flex; flex-direction:column; height:100%; position:relative; }
  .spacer { flex:1; }

  /* ── 메인화면 ── */
  .topbar { display:flex; align-items:center; gap:14px; padding:14px 16px 10px; }
  .icobtn { display:flex; flex-direction:column; align-items:center; gap:2px;
            background:none; border:0; padding:2px 4px; cursor:pointer; color:var(--text);
            font-family:inherit; font-weight:600; }
  .ico { width:26px; height:26px; display:grid; place-items:center; font-size:15px; line-height:1; }
  .ico.av { background:var(--fill); color:var(--on-fill); border-radius:50%; }
  .ico.sm { font-size:13px; width:auto; height:auto; }
  .icolbl { font-size:${TYPE.aiNote}px; color:var(--caption); }
  .scroll { flex:1; overflow:hidden; padding:8px 16px 0; }
  .title { font-size:${TYPE.title}px; line-height:1.35; margin:10px 0 8px; color:var(--strong); font-weight:700; }
  .brand { color:var(--point); font-weight:700; }
  .sub { font-size:${TYPE.notice}px; line-height:1.55; color:var(--muted); margin:0 0 18px; }
  /* 패널 외곽선: 면을 올려 나누는 대신 가장자리만 1px 들어 올린다(토스 실측 ΔL 0.021). */
  .group { background:var(--card); border:1px solid var(--panel-line);
           border-radius:${R}px; padding:4px 14px; margin-bottom:20px; }
  .grouphead { font-size:${TYPE.aiNote}px; color:var(--caption); padding:11px 0 5px; }
  .row { display:flex; align-items:center; justify-content:space-between; padding:11px 0;
         border-top:1px solid var(--raised); }
  .group .row:first-of-type { border-top:0; }
  .rowlbl { font-size:${TYPE.body}px; color:var(--label); display:flex; align-items:center; }
  /* 아이콘 칩: 토스 "금융 서비스" 행 실측 — 30x30css, 글자까지 12css. */
  .rowico { width:30px; height:30px; flex:none; margin-right:12px; border-radius:10px;
            background:var(--raised); color:var(--caption); display:grid; place-items:center;
            font-size:14px; line-height:1; }
  .rowval { font-size:${TYPE.notice}px; color:var(--muted); }
  .rowval.point { color:var(--point); }
  .sectionhead { font-size:${TYPE.choice}px; color:var(--text); font-weight:700; margin:0 0 10px; }
  .composer { padding:10px 16px 8px; background:var(--card); border-top:1px solid var(--raised); }
  .field { font-size:${TYPE.body}px; color:var(--muted); padding:6px 2px 10px; }
  .actions { display:flex; align-items:center; gap:8px; }
  .act { font-family:inherit; font-weight:600; font-size:${TYPE.notice}px; cursor:pointer; border:0;
         background:var(--raised); color:var(--label); border-radius:999px; padding:8px 13px;
         display:inline-flex; align-items:center; gap:5px; }
  .caret { font-size:10px; color:var(--caption); }
  .sendbtn { font-family:inherit; font-weight:700; font-size:${TYPE.notice}px; cursor:pointer; border:0;
             background:var(--fill); color:var(--on-fill); border-radius:999px; padding:9px 17px; }
  .legal { font-size:${TYPE.time}px; color:var(--muted); text-align:center; padding:9px 16px 14px;
           background:var(--card); }
  .link { color:var(--point); }

  /* ── 대화방 ──
     페이지가 카드 톤이고, 아래쪽에 키 컬러 워시가 깔린다. 그 위 요소들은 면을 올리지 않는다.
     토스 실측: 워시는 CSS y 627~757에서 가장 진하고 맨 아래에서 다시 옅어진다 — 아래 가장자리
     에서 시작하는 선형이 아니라 하단에 눌러 담은 타원형 글로우다. */
  .chat { background:var(--chat-page); }
  .wash { position:absolute; inset:0; pointer-events:none;
          background:
            radial-gradient(120% 42% at 50% 92%, var(--wash-end) 0%, transparent 70%),
            radial-gradient(135% 30% at 50% 78%, var(--wash) 0%, transparent 72%); }
  /* 워시 위로 내용을 올린다. 선택자를 .chat > * 로 넓게 잡으면 아래 .scrim/.dialog 의
     position:absolute 까지 relative 로 덮어써서 다이얼로그가 흐름에 끼어버린다 — 그래서
     겹침 순서가 따로 필요한 둘은 .chat > 로 한 단계 더 좁혀 다시 지정한다. */
  .chat > *:not(.wash) { position:relative; z-index:1; }
  .chat > .scrim { position:absolute; z-index:2; }
  .chat > .dialog { position:absolute; z-index:3; }
  .chat > .drawer { position:absolute; z-index:2; }
  .chat > .drawerScrim { position:absolute; z-index:1; }

  .chatbar { display:flex; align-items:center; padding:12px 16px 6px; }
  .back { font-family:inherit; background:none; border:0; cursor:pointer; color:var(--bot);
          font-size:26px; line-height:1; padding:0 6px 4px; }
  .endbtn { font-family:inherit; font-weight:600; background:none; border:0; cursor:pointer;
            color:var(--text); font-size:${TYPE.suggest}px; padding:4px; }

  .chatscroll { padding:2px 16px 0; overflow:hidden; }
  .notice { text-align:center; font-size:${TYPE.notice}px; color:var(--quiet); margin:16px 0; }
  .rule { display:flex; align-items:center; gap:10px; margin:18px 0 22px; }
  .rule::before, .rule::after { content:""; flex:1; height:1px; background:var(--raised); }
  .rule span { font-size:${TYPE.notice}px; color:var(--quiet); }

  /* 봇은 말풍선이 없다 — 페이지 위에 글만 얹힌다. 토스가 그렇게 한다. */
  .bot { font-size:${TYPE.body}px; line-height:1.5; color:var(--bot); margin:0 0 22px; max-width:330px; }
  .cardname { font-size:${TYPE.title}px; font-weight:700; color:var(--point); margin:0 0 6px; }

  .mine { display:flex; flex-direction:column; align-items:flex-end; margin:0 0 20px; }
  .bubble { background:var(--fill); color:var(--on-fill); border-radius:${CHAT.rBubble}px;
            padding:11px 16px; font-size:${TYPE.body}px; line-height:1.45; max-width:280px; }
  .time { font-size:${TYPE.time}px; color:var(--quiet); margin-top:7px; }

  /* 제안 패널: 페이지와 같은 색인데 워시 위에 놓여 저절로 갈린다 */
  .suggest { position:relative; margin:0 16px 4px; background:var(--chat-page);
             border:1px solid var(--panel-line);
             border-radius:${CHAT.rPanel}px; padding:6px 4px; }
  .sugrow { display:block; width:100%; text-align:left; font-family:inherit; font-weight:600;
            background:none; border:0; cursor:pointer; color:var(--strong);
            font-size:${TYPE.suggest}px; padding:14px 16px; }
  .sugrow b { color:var(--point); font-weight:600; }
  .sugrow.sep { border-top:1px solid var(--raised); padding-right:62px; }
  .sendfab { position:absolute; right:14px; bottom:12px; width:44px; height:44px; border:0;
             border-radius:50%; cursor:pointer; background:var(--send); color:var(--on-fill);
             font-size:19px; line-height:1; }

  .fieldwrap { padding:6px 16px 4px; }
  .fieldpill { background:var(--raised); border-radius:${CHAT.rField + 6}px; padding:15px 18px;
               font-size:${TYPE.body}px; color:var(--quiet); }
  .ainote { text-align:center; font-size:${TYPE.aiNote}px; color:var(--ai-note); margin:10px 0 14px; }
  .spark { color:var(--point); }
  .info { color:var(--quiet); }

  /* 선택 카드: 면을 올리는 대신 브랜드색 실선으로 잡는다 */
  .choicecard { border:1px solid var(--border); border-radius:${CHAT.rPanel}px; padding:6px 4px 12px; }
  .choicerow { display:flex; width:100%; align-items:center; justify-content:space-between; gap:12px;
               font-family:inherit; font-weight:700; background:none; border:0; cursor:pointer;
               color:var(--bot); font-size:${TYPE.choice}px; line-height:1.4; text-align:left;
               padding:14px 14px; }
  .check { flex:none; width:26px; height:26px; border-radius:50%; display:grid; place-items:center;
           color:var(--quiet); font-size:13px; box-shadow:inset 0 0 0 1.5px var(--quiet); }
  .ctadis { display:block; width:calc(100% - 28px); margin:6px 14px 0; font-family:inherit;
            font-weight:700; font-size:${TYPE.body}px; cursor:pointer; border:0;
            background:var(--dis-fill); color:var(--dis-text); border-radius:14px; padding:16px; }

  /* 종료 다이얼로그 */
  .scrim { position:absolute; inset:0; background:rgba(0,0,0,.5); z-index:2; }
  .dialog { position:absolute; left:26px; right:26px; top:355px; z-index:3;
            background:var(--dialog); border-radius:20px; padding:22px 20px 20px; }
  .dtitle { font-size:${TYPE.dialog}px; font-weight:700; color:var(--dialog-text); margin:0 0 18px; }
  .dbtns { display:flex; gap:10px; }
  .dbtn { flex:1; font-family:inherit; font-weight:700; font-size:${TYPE.choice}px; cursor:pointer;
          border:0; border-radius:14px; padding:15px; background:var(--dialog-btn); color:var(--dialog-btn-text); }
  .dbtn.danger { background:var(--danger); color:${DANGER_TEXT}; }

  /* ── 서브페이지 공통 ── */
  .subbar { display:flex; align-items:center; padding:14px 16px 10px; background:var(--page); }
  .subtitle { flex:1; text-align:center; font-size:${TYPE.body}px; font-weight:700; color:var(--text); }
  .backspace { width:26px; }
  /* 섹션 라벨은 토스 홈 "금융 서비스" 실측 기준이다. 잉크 13.67css 를 Bold 로 환산하면 15.27 →
     15px 이고(600 기준 15.53 을 16 으로 반올림했던 게 틀렸다), 색은 흐린 회색이 아니라
     본문색이다. 위계는 색이 아니라 크기(15 vs 행 17)로만 준다. */
  .grouplbl { font-size:${TYPE.notice}px; font-weight:700; color:var(--text); margin:20px 0 10px 4px; }
  .grouplbl:first-child { margin-top:6px; }
  .group.pad { padding:2px 16px; }
  .rowstrong { font-size:${TYPE.body}px; font-weight:700; color:var(--text); }
  .rowlbl em { display:block; font-style:normal; font-size:${TYPE.time}px; color:var(--caption); margin-top:2px; }
  .chev { color:var(--caption); font-size:19px; line-height:1; }
  .rowlbl.danger, .chev.danger { color:var(--danger); }
  .rowico.danger { color:var(--danger); }

  .acct { display:flex; align-items:center; gap:12px; padding:14px 0; }
  .avatar { width:26px; height:26px; border-radius:50%; background:var(--raised); flex:none; }
  /* 알약 안의 아바타는 알약과 같은 면이라 안 보인다 — 한 단계 내린 색을 쓴다. */
  .mypill .avatar { background:var(--page); }
  .avatar.big { width:46px; height:46px; }
  .acctname { flex:1; font-size:${TYPE.body}px; font-weight:700; color:var(--text); }
  .acctname em { display:block; font-style:normal; font-size:${TYPE.notice}px;
                 font-weight:600; color:var(--muted); margin-top:3px; }
  .pill { font-family:inherit; font-weight:700; font-size:${TYPE.aiNote}px; cursor:pointer; border:0;
          background:var(--fill); color:var(--on-fill); border-radius:999px; padding:6px 12px; }
  .chip { font-family:inherit; font-weight:600; font-size:${TYPE.aiNote}px; cursor:pointer; border:0;
          background:var(--raised); color:var(--label); border-radius:999px; padding:7px 12px; }

  /* ── 메뉴 드로어 ── */
  .drawer { position:absolute; inset:0 101px 0 0; z-index:2; background:var(--card);
            display:flex; flex-direction:column; }
  .drawerScrim { position:absolute; inset:0 0 0 292px; z-index:1; background:rgba(0,0,0,.45); }
  .brand { text-align:center; padding:16px 0 14px; font-size:${TYPE.title}px; font-weight:700;
           border-bottom:1px solid var(--raised); }
  .brand b { color:var(--text); }
  .brand i { font-style:normal; color:var(--point); }
  .drawerbody { flex:1; padding:14px 12px; }
  .drawerlbl { font-size:${TYPE.notice}px; font-weight:700; color:var(--text); margin:0 0 10px 6px; }
  /* 목록 행은 토스 설정 행 라벨 "언어"(17)에 맞춘다. */
  .roomrow { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
             font-family:inherit; font-weight:700; font-size:${TYPE.body}px; cursor:pointer;
             border:0; background:none; color:var(--label); border-radius:12px; padding:13px 12px; }
  .roomrow.on { background:var(--raised); color:var(--text); }
  .dot { width:5px; height:5px; border-radius:50%; background:var(--caption); flex:none; }
  .roomrow.on .dot { background:var(--point); }
  .drawerfoot { padding:12px; display:flex; flex-direction:column; gap:10px; }
  .footrow { display:flex; align-items:center; gap:10px; }
  .mypill { flex:1; display:flex; align-items:center; gap:10px; font-family:inherit; font-weight:700;
            font-size:${TYPE.notice}px; cursor:pointer; border:0; background:var(--raised);
            color:var(--text); border-radius:999px; padding:9px 14px; }
  .bell { position:relative; width:42px; height:42px; flex:none; border:0; cursor:pointer;
          border-radius:50%; background:var(--raised); }
  .bellico { font-size:15px; filter:grayscale(1) brightness(1.7); }
  .badge { position:absolute; top:7px; right:8px; width:8px; height:8px; border-radius:50%;
           background:var(--danger); }
  .ctaFill { width:100%; font-family:inherit; font-weight:700; font-size:${TYPE.body}px; cursor:pointer;
             border:0; background:var(--fill); color:var(--on-fill); border-radius:999px; padding:15px; }
  .ctaQuiet { width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
              font-family:inherit; font-weight:700; font-size:${TYPE.body}px; cursor:pointer; border:0;
              background:var(--raised); color:var(--text); border-radius:999px; padding:15px; }
  .plus { font-size:15px; color:var(--caption); }

  /* ── 프로필 편집 ── */
  .form { padding:16px; }
  .fieldlbl { display:block; font-size:${TYPE.notice}px; color:var(--muted); margin:18px 0 7px; }
  .form .fieldlbl:first-child { margin-top:2px; }
  .fieldlbl em { font-style:normal; color:var(--caption); }
  .input { background:var(--page); border-radius:12px; padding:14px 15px;
           font-size:${TYPE.body}px; font-weight:700; color:var(--text); }
  .seg { display:flex; gap:9px; margin-top:9px; }
  .segbtn { flex:1; font-family:inherit; font-weight:700; font-size:${TYPE.notice}px; cursor:pointer;
            border:0; background:var(--raised); color:var(--label); border-radius:12px; padding:13px 0; }
  .segbtn.on { background:var(--fill); color:var(--on-fill); }
  .warn { font-size:${TYPE.aiNote}px; color:var(--danger); margin:9px 0 0; }
  .chkrow { display:flex; align-items:center; gap:9px; margin-top:11px;
            font-size:${TYPE.notice}px; color:var(--label); }
  .box { width:18px; height:18px; flex:none; border-radius:6px; background:var(--raised); }
  .req { font-style:normal; color:var(--danger); margin-left:3px; }
  .rowend { display:flex; align-items:center; gap:9px; }
  .mag { display:inline-grid; place-items:center; width:17px; height:17px; margin-left:6px;
         border-radius:50%; background:var(--raised); color:var(--caption); font-size:10px;
         vertical-align:middle; }
  .payhead { font-size:${TYPE.notice}px; font-weight:700; color:var(--text); margin:0 0 6px; }
  .ctaFill.sq { border-radius:14px; }
  .help { font-size:${TYPE.aiNote}px; color:var(--muted); margin:9px 0 0; }
  .ctabar { padding:12px 16px 16px; background:var(--card); border-top:1px solid var(--raised); }

  /* ── 이용권 구매 ── */
  .product { border-radius:${R}px; padding:18px 18px 20px; margin:4px 0 4px;
             background:var(--dis-fill); box-shadow:inset 0 0 0 1px var(--border); }
  .prodname { font-size:${TYPE.title}px; font-weight:700; color:var(--text); margin:0 0 10px; }
  .prodchip { display:inline-block; font-size:${TYPE.aiNote}px; font-weight:700;
              background:var(--fill); color:var(--on-fill); border-radius:999px; padding:6px 11px; }
  .lead { text-align:center; font-size:${TYPE.notice}px; color:var(--muted); margin:18px 0 12px; }
  .optcard { background:var(--card); border:1px solid var(--panel-line);
             border-radius:${R}px; padding:14px; margin-bottom:12px; }
  .optcard.on { box-shadow:inset 0 0 0 1px var(--border); }
  .opthead { display:flex; align-items:flex-start; gap:12px; margin-bottom:12px; }
  .opttitle { flex:1; text-align:center; font-size:${TYPE.body}px; font-weight:700; color:var(--text); }
  .opttitle em { display:block; font-style:normal; font-size:${TYPE.aiNote}px; font-weight:600;
                 color:var(--muted); margin-top:4px; }
  .radio { width:18px; height:18px; flex:none; border-radius:50%; background:var(--raised); }
  .radio.on { background:var(--fill); box-shadow:inset 0 0 0 4px var(--card); }
  .opttable { background:var(--page); border-radius:12px; padding:4px 13px; }
  .optheadrow { display:flex; justify-content:space-between; padding:11px 0;
                font-size:${TYPE.notice}px; font-weight:700; color:var(--label);
                border-bottom:1px solid var(--raised); }
  .optrow { display:flex; justify-content:space-between; padding:9px 0;
            font-size:${TYPE.notice}px; color:var(--muted); }
  .optrow b { color:var(--text); }
  .paybar { padding:12px 16px 16px; background:var(--card); border-top:1px solid var(--raised); }
  .payrow { display:flex; justify-content:space-between; font-size:${TYPE.notice}px;
            color:var(--muted); padding:5px 0; }
  .payrow.total { font-size:${TYPE.body}px; color:var(--text); font-weight:700;
                  border-top:1px solid var(--raised); margin-top:6px; padding-top:11px; }
  .payrow.total b { color:var(--text); }
  .paybar .ctaFill { margin-top:12px; }

  /* ── 코랄 버튼의 그라데이션·글로우 (sample_005 실측을 옮긴 것) ──
     background 단축속성이 앞에서 image 를 지우므로, 이 블록은 반드시 뒤에 와야 한다. */
  .ctaFill, .sendbtn, .sendfab, .pill, .segbtn.on, .prodchip {
    background-image:${GRAD};
  }
  /* outer glow: 오프셋 0 + 스프레드. 아래로 치우치지 않고 면 둘레로 고르게 퍼진다. */
  .ctaFill, .sendbtn { box-shadow:0 0 20px 3px var(--fill-glow); }
  .sendfab { box-shadow:0 0 16px 2px var(--fill-glow); }
  .pill, .segbtn.on, .prodchip { box-shadow:0 0 11px 1px var(--fill-glow); }
</style>
<body>
<h1>타연 — 토스 톤 적용</h1>
<p class="note">
  토스 스크린샷 8장(아이폰 15 Pro, 1179×2556 @3x)에서 색·글자 크기·대화방 구조를 실측해 옮긴 판이다.
  무채색 계단과 대화방 구조는 토스 실측값을 그대로 쓰고, 글자 크기는 토스의 잉크 높이를
  Pretendard font-size로 환산해 맞췄다. 핑크는 색상각만 타연 것이고 명도·채도 절제는 토스 파랑에서 가져왔다.
</p>
<p class="note">
  <b>대화방에서 배운 것 세 가지.</b> ① 봇은 말풍선이 없다 — 페이지 위에 글만 얹힌다. 말풍선은 사용자 쪽만.
  ② 제안 패널·선택 카드·입력창이 전부 페이지와 같은 색이다. 면을 올려 나누지 않는다.
  ③ <b>화면 아래쪽에 키 컬러 워시가 깔린다.</b> 홈·설정이 완전한 무채색이었던 것과 정반대다 —
  즉 토스도 워시를 쓰되 <b>하단 조작 영역에만</b> 눌러 담는다.
</p>

<h2>시안</h2>
<div class="frames">
${frame("다크 · 대화방", "dark", chat())}
${frame("라이트 · 대화방", "light", chat())}
${frame("다크 · 선택 카드", "dark", choice())}
${frame("다크 · 종료 다이얼로그", "dark", dialogFrame())}
${frame("라이트 · 종료 다이얼로그", "light", dialogFrame())}
${frame("다크 · 메뉴 오픈", "dark", menuOpen())}
${frame("라이트 · 메뉴 오픈", "light", menuOpen())}
${frame("다크 · 마이 페이지", "dark", myPage())}
${frame("라이트 · 마이 페이지", "light", myPage())}
${frame("다크 · 내 프로필 관리", "dark", profileEdit())}
${frame("라이트 · 내 프로필 관리", "light", profileEdit())}
${frame("다크 · 이용권 구입", "dark", buyPass())}
${frame("라이트 · 이용권 구입", "light", buyPass())}
${frame("다크 · 메인화면", "dark", main())}
${frame("라이트 · 메인화면", "light", main())}
</div>

<h2>핑크 — 토스 파랑의 절제를 옮김</h2>
<table>
  <tr><th>색</th><th>L</th><th>C</th><th>그 L·H 최대채도</th><th>사용률</th></tr>
  <tr><td>토스 채움 <code>${TOSS.blueFill}</code></td><td>${f3(fillSrc.L)}</td><td>${f3(fillSrc.C)}</td>
      <td>${f3(maxC(fillSrc.L, fillSrc.H))}</td><td><b>${(fillUse * 100).toFixed(1)}%</b></td></tr>
  <tr><td>타연 원래 <code>#ff007f</code></td><td>0.645</td><td>0.260</td>
      <td>${f3(maxC(0.645, BRAND_H))}</td><td><b>99.2%</b></td></tr>
  <tr><td>새 채움 <code>${DARK.fill}</code></td><td>${f3(toOklch(DARK.fill).L)}</td><td>${f3(toOklch(DARK.fill).C)}</td>
      <td>${f3(maxC(toOklch(DARK.fill).L, BRAND_H))}</td><td>${(fillUse * 100).toFixed(1)}%</td></tr>
  <tr><td>새 글자(다크) <code>${DARK.point}</code></td><td>${f3(toOklch(DARK.point).L)}</td><td>${f3(toOklch(DARK.point).C)}</td>
      <td>${f3(maxC(toOklch(DARK.point).L, BRAND_H))}</td><td>${(textUse * 100).toFixed(1)}%</td></tr>
  <tr><td>새 글자(라이트) <code>${LIGHTT.point}</code></td><td>${f3(toOklch(LIGHTT.point).L)}</td><td>${f3(toOklch(LIGHTT.point).C)}</td>
      <td>${f3(maxC(toOklch(LIGHTT.point).L, BRAND_H))}</td><td>${(textUse * 100).toFixed(1)}%</td></tr>
</table>

<h2>글자 크기 — 토스 잉크 실측 → Pretendard</h2>
<table>
  <tr><th>역할</th><th>px</th><th>토스에서 어디</th></tr>
  <tr><td>말풍선 시각</td><td>${TYPE.time}</td><td>대화방 "20:55"</td></tr>
  <tr><td>AI 고지 · 캡션</td><td>${TYPE.aiNote}</td><td>대화방 "AI가 답변을…", 홈 "미니앱"</td></tr>
  <tr><td>안내 · 날짜 · 구분선</td><td>${TYPE.notice}</td><td>대화방 "최근 3개월 대화만 보관돼요"</td></tr>
  <tr><td>제안 줄 · 상담 종료</td><td>${TYPE.suggest}</td><td>대화방 제안 패널, 우상단 "상담 종료"</td></tr>
  <tr><td>본문 · 봇 글 · 말풍선</td><td>${TYPE.body}</td><td>대화방 봇 글, 설정 "언어"</td></tr>
  <tr><td>선택 카드 줄 · 섹션 헤더</td><td>${TYPE.choice}</td><td>선택 카드 줄, 설정 "인증 및 보안"</td></tr>
  <tr><td>다이얼로그 제목</td><td>${TYPE.dialog}</td><td>"상담을 종료할까요?"</td></tr>
  <tr><td>화면 제목</td><td>${TYPE.title}</td><td>뱅크 "가입해둔 보험이 있네요"</td></tr>
</table>

<h2>토큰</h2>
<table>
  <tr><th>토큰</th><th>다크</th><th>라이트</th><th>근거 / 대비</th></tr>
  <tr><td>page</td><td><code>${DARK.page}</code></td><td><code>${LIGHTT.page}</code></td><td>토스 그룹 배경</td></tr>
  <tr><td>card</td><td><code>${DARK.card}</code></td><td><code>${LIGHTT.card}</code></td><td>ΔL ${f3(gapCard)}</td></tr>
  <tr><td>raised</td><td><code>${DARK.raised}</code></td><td><code>${LIGHTT.raised}</code></td><td>ΔL ${f3(gapRaise)}, 라이트는 반대방향</td></tr>
  <tr><td>chat-page</td><td><code>${DARK.chatPage}</code></td><td><code>${LIGHTT.chatPage}</code></td><td>대화방은 카드 톤이 페이지</td></tr>
  <tr><td>wash</td><td><code>${DARK.wash}</code></td><td><code>${LIGHTT.wash}</code></td><td>토스 <code>${CHAT.washPeak}</code> 이식</td></tr>
  <tr><td>wash-end</td><td><code>${DARK.washEnd}</code></td><td><code>${LIGHTT.washEnd}</code></td><td>토스 <code>${CHAT.washEnd}</code> 이식</td></tr>
  <tr><td>bot</td><td><code>${DARK.bot}</code></td><td><code>${LIGHTT.bot}</code></td><td>${contrast(DARK.bot, DARK.chatPage).toFixed(2)} / ${contrast(LIGHTT.bot, LIGHTT.chatPage).toFixed(2)}</td></tr>
  <tr><td>quiet</td><td><code>${DARK.quiet}</code></td><td><code>${LIGHTT.quiet}</code></td><td>${contrast(DARK.quiet, DARK.chatPage).toFixed(2)} / ${contrast(LIGHTT.quiet, LIGHTT.chatPage).toFixed(2)}</td></tr>
  <tr><td>ai-note</td><td><code>${DARK.aiNote}</code></td><td><code>${LIGHTT.aiNote}</code></td><td>${contrast(DARK.aiNote, DARK.chatPage).toFixed(2)} / ${contrast(LIGHTT.aiNote, LIGHTT.chatPage).toFixed(2)}</td></tr>
  <tr><td>text</td><td><code>${DARK.text}</code></td><td><code>${LIGHTT.text}</code></td><td>${contrast(DARK.text, DARK.card).toFixed(2)} / ${contrast(LIGHTT.text, LIGHTT.card).toFixed(2)}</td></tr>
  <tr><td>label</td><td><code>${DARK.label}</code></td><td><code>${LIGHTT.label}</code></td><td>${contrast(DARK.label, DARK.card).toFixed(2)} / ${contrast(LIGHTT.label, LIGHTT.card).toFixed(2)}</td></tr>
  <tr><td>muted</td><td><code>${DARK.muted}</code></td><td><code>${LIGHTT.muted}</code></td><td>${contrast(DARK.muted, DARK.card).toFixed(2)} / ${contrast(LIGHTT.muted, LIGHTT.card).toFixed(2)}</td></tr>
  <tr><td>fill + 흰글자</td><td><code>${DARK.fill}</code></td><td><code>${LIGHTT.fill}</code></td><td>${contrast(DARK.fill, "#ffffff").toFixed(2)} 양쪽 동일</td></tr>
  <tr><td>point(글자)</td><td><code>${DARK.point}</code></td><td><code>${LIGHTT.point}</code></td><td>${contrast(DARK.point, DARK.card).toFixed(2)} / ${contrast(LIGHTT.point, LIGHTT.card).toFixed(2)}</td></tr>
  <tr><td>send(원형 버튼)</td><td><code>${DARK.send}</code></td><td><code>${LIGHTT.send}</code></td><td>흰 화살표 ${contrast(DARK.send, "#ffffff").toFixed(2)} / ${contrast(LIGHTT.send, "#ffffff").toFixed(2)}</td></tr>
  <tr><td>dis-fill / dis-text</td><td><code>${DARK.disFill}</code> / <code>${DARK.disText}</code></td>
      <td><code>${LIGHTT.disFill}</code> / <code>${LIGHTT.disText}</code></td>
      <td>${contrast(DARK.disText, DARK.disFill).toFixed(2)} / ${contrast(LIGHTT.disText, LIGHTT.disFill).toFixed(2)}</td></tr>
  <tr><td>danger</td><td colspan="2"><code>${DARK.danger}</code></td>
      <td>글자 <code>${DANGER_TEXT}</code>(토스와 동일) · 대비 ${contrast(DARK.danger, DANGER_TEXT).toFixed(2)}</td></tr>
</table>
<p class="note" style="margin-top:14px">
  <b>파괴적 버튼의 글자는 토스와 같은 순백</b>이다 — 토스 라벨의 글리프 내부 최빈색이
  <code>#ffffff</code>(1397px)로 실측됐다. <b>면만 토스보다 한 단계 어둡다.</b>
  토스 <code>${CHAT.danger}</code>는 흰 글자가 ${contrast(CHAT.danger, DANGER_TEXT).toFixed(2)}뿐이라,
  색상각을 H ${DANGER_H}°로 밀고(<code>${dangerShifted}</code>, ${contrast(dangerShifted, DANGER_TEXT).toFixed(2)})
  명도를 내려 <code>${DARK.danger}</code> ${contrast(DARK.danger, DANGER_TEXT).toFixed(2)}를 맞췄다.
  토스에서는 빨강 H ${toOklch(CHAT.danger).H.toFixed(0)}°와 파랑 H ${fillSrc.H.toFixed(0)}°가 123° 떨어져
  "위험"과 "브랜드"가 섞일 일이 없었지만, 코랄은 H ${coralSrc.H.toFixed(1)}°라 그 빨강과 7°밖에 차이가 안 난다 —
  면을 민 덕에 그 거리도 같이 벌어졌다.
</p>
<p class="note">생성: <code>node doc/design/build-toss-tone-mockup.mjs</code> ·
  실측: <code>measure-toss.mjs</code>, <code>measure-toss-chat.mjs</code>, <code>calibrate-type.mjs</code></p>
</body></html>
`;

fs.writeFileSync(new URL("./toss-tone-mockup.html", import.meta.url), html);
console.log("\ntoss-tone-mockup.html 생성 완료");
