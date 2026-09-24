const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * 상품 아트워크 18종을 public/pass 로 옮긴다.
 *
 * 원본(`asset/texture/`)은 1254px 정사각 JPG/PNG 로 합쳐 45MB라 그대로 web 에 올릴 수 없다.
 * 쓰이는 자리가 두 곳이고 필요한 해상도가 4배 넘게 차이나서 **크기도 두 벌**로 만든다 —
 * 하나로 합치면 한쪽이 반드시 손해다:
 *
 * - `-card.webp` 552px — 목록의 2열 그리드(카드 폭 184 CSS × 3배). 한 화면에 6장이 한꺼번에
 *   깔리는 자리라 여기가 무거우면 목록 전체가 느려진다.
 * - `.webp` 1254px — 구입 상세의 히어로(화면 폭 412 CSS × 3배). 원본이 정확히 1254라
 *   확대 없이 3배 화면까지 선명하다.
 *
 * 그림 자체에는 흰 그러데이션이 없다. 아래로 흐려지는 건 카드가 덧씌우는 것이다
 * (src/components/PassArtCard.tsx) — 그래야 다크 모드에서도 카드 바탕색으로 이어진다.
 */
const OUT = 'public/pass';
const HERO_WIDTH = 1254;
const CARD_WIDTH = 552;
const QUALITY = 72;

fs.mkdirSync(OUT, { recursive: true });

const COUNT = ['starter', 'basic', 'standard', 'plus', 'premium', 'ultimate'];
const jobs = [];
COUNT.forEach((name, i) => {
  jobs.push([`asset/texture/prizebg_tier_${i + 1}.jpg`, `count-${name}`]);
});
for (const m of [15, 30, 60]) {
  // 파일 이름의 tier 1~4 는 COMBO_ORDER(타로 / +사주 / +자미두수 / +사주+자미두수) 순서다.
  for (let t = 1; t <= 4; t++) {
    jobs.push([`asset/texture/timepass_${m}m_tier_${t}.png`, `time-${m}-${t}`]);
  }
}

(async () => {
  let hero = 0;
  let card = 0;
  for (const [src, name] of jobs) {
    const a = `${OUT}/${name}.webp`;
    const b = `${OUT}/${name}-card.webp`;
    await sharp(src).resize({ width: HERO_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(a);
    await sharp(src).resize({ width: CARD_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(b);
    const ha = fs.statSync(a).size / 1024;
    const cb = fs.statSync(b).size / 1024;
    hero += ha;
    card += cb;
    console.log(`${path.basename(name).padEnd(16)} 히어로 ${ha.toFixed(0)}KB   카드 ${cb.toFixed(0)}KB`);
  }
  console.log(`히어로 합계 ${(hero / 1024).toFixed(2)}MB / 카드 합계 ${(card / 1024).toFixed(2)}MB (원본 45MB)`);
  console.log(`한 화면 기준: 목록 6장 ≈ ${((card / jobs.length) * 6 / 1024).toFixed(2)}MB, 상세 1장 ≈ ${(hero / jobs.length).toFixed(0)}KB`);
})();
