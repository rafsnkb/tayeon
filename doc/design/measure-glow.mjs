// 메인·대화방 하단의 코랄 글로우 실측. 세로/가로 단면을 떠서 모양(방사형 vs 선형)을 가린다.
import { load, px, hex, DPR } from "./measure-lib.mjs";
const css = (v) => +(v / DPR).toFixed(1);
const FILES = {
  "Main_Dark": "asset/Screen/New/Main_Dark.png",
  "Main_Light": "asset/Screen/New/Main_Light.png",
  "Chat_Dark": "asset/Screen/New/Chattingroom_UsingTimePass_Dark.png",
  "Chat_Light": "asset/Screen/New/Chattingroom_UsingTimePass_Light.png",
};

for (const [name, file] of Object.entries(FILES)) {
  const img = await load(file);
  console.log(`\n=== ${name} ===`);
  // 세로 단면 — 좌측 여백(x 4)과 화면 중앙(x 206) 둘 다. 중앙은 컴포저에 가리는 구간이 있다.
  for (const xCss of [4, 206]) {
    const x = Math.round(xCss * DPR);
    const row = [];
    for (let yCss = 80; yCss <= 728; yCss += 36) row.push(`${yCss}:${hex(...px(img, x, Math.round(yCss * DPR)))}`);
    console.log(`  세로 x=${xCss}: ${row.join(" ")}`);
  }
  // 가로 단면 — 컴포저 위(y 560)와 바닥 근처(y 726)
  for (const yCss of [560, 726]) {
    const y = Math.round(yCss * DPR);
    const row = [];
    for (let xCss = 4; xCss <= 408; xCss += 50) row.push(`${xCss}:${hex(...px(img, Math.round(xCss * DPR), y))}`);
    console.log(`  가로 y=${yCss}: ${row.join(" ")}`);
  }
}

// --- 2차: 촘촘한 세로 프로파일(x=4, 컴포저·글자에 안 가리는 좌측 여백) ---
for (const [name, file] of Object.entries({ Main_Dark: FILES.Main_Dark, Main_Light: FILES.Main_Light })) {
  const img = await load(file);
  const x = Math.round(4 * DPR);
  const rows = [];
  for (let yCss = 340; yCss <= 731; yCss += 12) rows.push([yCss, px(img, x, Math.round(yCss * DPR))]);
  console.log(`\n=== ${name} 촘촘 세로 ===`);
  console.log(rows.map(([y, p]) => `${y}(${(100 * y / 732).toFixed(1)}%):${hex(...p)}`).join(" "));
}
