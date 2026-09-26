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

// 원본이 **전부 있는지 먼저 본다**(2026-09-26). 전에는 없는 파일을 만나면 sharp 가 그 자리에서
// 예외를 던지고 스크립트가 멈췄다 — 19개 중 15번째가 없으면 앞 14개만 구워진 채로 끝나고,
// 무엇이 빠졌는지는 그 한 개만 알려 줬다. 새 상품 그림을 여러 장 받는 상황에서 제일 나쁜
// 모양이다(한 장 받아서 돌리고 또 멈추고를 반복하게 된다).
//
// 아무것도 굽기 전에 **빠진 것을 한 번에** 알려주고 멈춘다. 절반만 구운 `public/fortune/` 을
// 남기지 않는 것도 목적이다 — 그 상태로 커밋되면 화면에서 몇 장만 자리표로 뜬다.
const absent = SLUGS.filter((slug) => !fs.existsSync(`${SRC_DIR}/fortune_prizeimage_${slug}.png`));
if (absent.length > 0) {
  console.error(`원본이 없는 슬러그 ${absent.length}개 — ${SRC_DIR}/ 에 받아 두고 다시 돌릴 것:`);
  for (const slug of absent) console.error(`  fortune_prizeimage_${slug}.png`);
  process.exit(1);
}

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
