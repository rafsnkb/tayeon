const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 상품 아트워크 18장을 public/pass 로 옮긴다. 원본은 1254px 정사각 JPG/PNG 로 합쳐 45MB라
// 그대로 web 에 올릴 수 없다 — 가장 크게 쓰이는 자리가 구입 상세의 히어로(화면 폭 412 CSS)라
// 824px(2x) webp 면 충분하다.
const OUT = "public/pass";
fs.mkdirSync(OUT, { recursive: true });

const COUNT = ['starter', 'basic', 'standard', 'plus', 'premium', 'ultimate'];
const jobs = [];
COUNT.forEach((name, i) => {
  jobs.push([`asset/texture/prizebg_tier_${i + 1}.jpg`, `${OUT}/count-${name}.webp`]);
});
for (const m of [15, 30, 60]) {
  for (let t = 1; t <= 4; t++) {
    jobs.push([`asset/texture/timepass_${m}m_tier_${t}.png`, `${OUT}/time-${m}-${t}.webp`]);
  }
}

(async () => {
  let total = 0;
  for (const [src, dst] of jobs) {
    await sharp(src).resize({ width: 824, withoutEnlargement: true }).webp({ quality: 72 }).toFile(dst);
    const kb = fs.statSync(dst).size / 1024;
    total += kb;
    console.log(`${path.basename(dst)}  ${kb.toFixed(0)}KB`);
  }
  console.log(`합계 ${(total / 1024).toFixed(1)}MB (원본 45MB)`);
})();
