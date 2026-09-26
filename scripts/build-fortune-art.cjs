const sharp = require('sharp');
const fs = require('fs');

/**
 * 운세 상품 썸네일 19종을 public/fortune 로 옮긴다.
 *
 * 원본(`asset/texture/fortune_prizeimage_{slug}.png`)은 1254×940 PNG 로 저장소에 두지 않는다
 * (.gitignore, `/asset/texture/`). 결과물인 public/fortune/*.webp 는 커밋 대상이라 새로 클론한
 * 곳에서도 화면은 그대로 뜬다 — 그림을 바꿀 때만 원본을 받아 다시 돌리면 된다. `build-pass-art.cjs`
 * 와 같은 구조다.
 *
 * 크기가 두 벌인 이유도 같다 — 쓰이는 자리의 CSS 폭이 다르다:
 * - `-card.webp` 384px  목록·보관함 카드(`w-32` = 128px × 3배)
 * - `.webp`      1254px 상세 히어로(풀블리드, 원본 그대로 — 이미 뷰포트 3배 폭에 맞는 해상도라
 *                업스케일하지 않는다)
 *
 * 원본이 이미 4:3(1254×940)이고 카드(128×96)·히어로(aspect-[4/3]) 전부 같은 비율이라 잘리지
 * 않는다 — object-cover 가 해상도만 줄일 뿐 크롭은 없다.
 */
const SRC_DIR = 'asset/texture';
const OUT = 'public/fortune';
const HERO_WIDTH = 1254;
const CARD_WIDTH = 384;
const QUALITY = 72;

const SLUGS = [
  'business-partnership',
  'career-fit',
  'couple-compatibility',
  'crush-reading',
  'exam-fortune',
  'family-planning',
  'intimacy-compatibility',
  'life-overview',
  'marriage-compatibility',
  'marriage-timing',
  'new-year-fortune',
  'personality-compatibility',
  'relationship-destiny',
  'reunion-reading',
  'single-love',
  'situationship-reading',
  'skinship-compatibility',
  'wealth-flow',
  'wellness-rhythm',
];

fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let hero = 0;
  let card = 0;
  for (const slug of SLUGS) {
    const src = `${SRC_DIR}/fortune_prizeimage_${slug}.png`;
    const a = `${OUT}/${slug}.webp`;
    const b = `${OUT}/${slug}-card.webp`;
    await sharp(src).resize({ width: HERO_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(a);
    await sharp(src).resize({ width: CARD_WIDTH, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(b);
    const ha = fs.statSync(a).size / 1024;
    const cb = fs.statSync(b).size / 1024;
    hero += ha;
    card += cb;
    console.log(`${slug.padEnd(28)} 히어로 ${ha.toFixed(0)}KB   카드 ${cb.toFixed(0)}KB`);
  }
  console.log(`히어로 합계 ${(hero / 1024).toFixed(2)}MB / 카드 합계 ${(card / 1024).toFixed(2)}MB`);
})();
