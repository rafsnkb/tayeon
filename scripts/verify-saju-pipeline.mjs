// 사주 리포트 생성 파이프라인을 실제로 한 편 태워서, 원가·시간·품질을 재고 §11 의 미측정
// 항목을 닫는다. `src/lib/saju/generate/*` 는 타입체크만 통과한 상태이고 **한 번도 실호출된 적이
// 없다** — 이 스크립트가 그 유일한 검증 수단이다.
//
// ══════════════════════════════════════════════════════════════════════════════
// 기본값은 **드라이런**이다. 실제 호출은 `--live` 를 명시할 때만 한다.
// ══════════════════════════════════════════════════════════════════════════════
//
// 그렇게 한 이유: 이 스크립트를 실수로 한 번 돌리면 사용자 돈이 나간다. 드라이런이 기본이면
// 잘못 눌러도 계획과 예상 비용만 찍고 끝난다. 반대(기본이 실호출)로 두면 되돌릴 방법이 없다.
//
// ── 프로덕션 Firestore 에 **쓰지 않는다** ────────────────────────────────────
//
// `scripts/verify-instrumentation.mjs` 는 테스트 계정·이용권·방을 만들어야 했다. 그건 검증
// 대상이 HTTP 라우트였고, 라우트가 인증과 이용권 차감을 거치기 때문이다.
//
// 이쪽은 **생성 계층을 직접 부른다.** `generate/{chart,outline,section,closing,image}.ts` 는
// Firestore 를 한 줄도 건드리지 않는다(`storage.ts`·`produce.ts`·`purchase.ts` 가 하는 일이다).
// 그래서 이 스크립트에는 테스트 계정도, ADC 도, 정리해야 할 문서도 없다. 지난번에 정리 실패로
// 프로덕션에 계정이 남았던 위험 자체가 여기서는 존재하지 않는다.
//
// 대신 재는 것은 **모델 호출**이라, 나가는 돈은 그대로 나간다. 그게 아래 예상치다.
//
// 만드는 것은 로컬 파일뿐이다: `.tmp/saju-verify/` (`.gitignore` 의 `/.tmp` 에 들어간다).
//
// 사용:
//   node scripts/verify-saju-pipeline.mjs            ← 드라이런(호출 0, 0원)
//   node scripts/verify-saju-pipeline.mjs --live     ← 실제 호출
//   node scripts/verify-saju-pipeline.mjs --live --no-image --sections=2
//
// `@/...` 별칭을 런타임에 풀어 주는 훅. **정적 import 라 아래 동적 import 보다 먼저 돈다** —
// 그래야 `@/lib/...` 이 해석된다. 이것 덕분에 명령이 `node scripts/verify-saju-pipeline.mjs`
// 한 줄로 고정돼서, 권한 규칙을 이 파일 하나에만 걸 수 있다.
import "./test-alias.mjs";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

// ─────────────────────────────────────────────────────────────────────────────
// 단가 — doc/사주_구현설계.md §2 와 **같은 값이어야 한다**
// ─────────────────────────────────────────────────────────────────────────────
//
// 문서의 표가 한동안 308원으로 틀려 있었던 원인이 실측 스크립트의 단가 상수였다
// (`{in: 3, out: 15}` = Sonnet 4.6 단가). 그래서 여기 값을 바꿀 때는 §2 도 같이 고칠 것.
const SONNET_5 = { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 }; // $/1M
const IMAGE = { out: 30, in: 5 }; // $/1M — gpt-image-2.5-flare
const KRW_PER_USD = 1450;

// §2 의 실측은 **11회 호출**이다 — 골격 1 + 섹션 10. 총평은 그 안에 없다. 그래서 단계마다
// 따로 들고 있어야 섹션 수를 줄여 돌릴 때 예상치가 맞는다(골격·총평은 섹션 수와 무관한 고정비다).
const EXPECTED = {
  /** §2: 1단 골격. 출력 2,146 토큰으로 11회 중 제일 크다 — 골격이 전체를 한 번에 써서다. */
  outlineWon: 33,
  /** §2: 2단 섹션 1장(10장 실측이 14~20원, 뒤로 갈수록 입력이 늘어 조금씩 오른다). */
  perSectionWon: 17,
  /** §5: 3단 총평은 **미측정**이다. 입력이 골격 + 섹션 요지 10개라 뒤쪽 섹션 수준으로 본다. */
  closingWon: 20,
  /** §2: 1024×1536 low = 158 출력 + 약 151 입력 토큰. 입력도 과금된다(출력만 세면 7원). */
  imageWon: 8,
  /** §5: 시스템 블록 1,642 토큰(Sonnet 최소 캐시 길이 1,024 를 넘어야 캐시가 걸린다) */
  systemBlockTokens: 1642,
  /** §2 편당 합계 — 위 넷을 10섹션으로 더한 값. */
  perReportWon: 224,
};

// ─────────────────────────────────────────────────────────────────────────────
// 인자
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const numArg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`${name}=`));
  return hit ? Number(hit.slice(name.length + 1)) : fallback;
};

const LIVE = has("--live");
const WITH_IMAGE = !has("--no-image");
/** `output_format: "webp"` 가 먹는지 보는 별도 호출(§11). 먹으면 `sharp` 가 런타임에서 사라진다. */
const WITH_WEBP_PROBE = WITH_IMAGE && !has("--no-webp-probe");
const SECTION_LIMIT = numArg("--sections", Infinity);

const PRODUCT_SLUG = "single-love";
const MODE = "integrated";
// §2 의 실측과 **같은 샘플**이다. 다른 값으로 재면 편당 224원과 비교할 수 없다.
const BIRTH = {
  calendarType: "solar",
  isLeapMonth: false,
  birthDate: "1996-04-12",
  birthTime: "14:30",
  timeUnknown: false,
  jasiRule: "early",
  gender: "female",
  useTrueSolarTime: false,
  birthPlace: null,
};
const USER_INPUT = "올해 안에 좋은 인연을 만날 수 있을까요? 언제쯤일지도 궁금해요.";
const OUT_DIR = ".tmp/saju-verify";

const log = (...a) => console.log(...a);
const won = (usd) => Math.round(usd * KRW_PER_USD);
const secs = (ms) => (ms / 1000).toFixed(1);

/** 만든 것. 이 스크립트는 프로덕션에 아무것도 만들지 않으므로 늘 비어 있다 —
 *  나중에 쓰기가 생기면 여기에 넣고 `cleanup()` 이 지운다. 슬롯을 비워 두는 게 아니라
 *  **구조를 남겨 두는** 것이다(정리를 나중에 붙이면 반드시 빠뜨린다). */
const createdRemote = [];

// ─────────────────────────────────────────────────────────────────────────────
// .env.local — **읽기만** 한다
// ─────────────────────────────────────────────────────────────────────────────
// `\r` 을 먼저 턴다: 이 파일은 CRLF 이고 JS 정규식의 `.` 는 `\r` 을 먹지 않아 `(.*)$` 가 통째로
// 실패한다(줄이 하나도 안 잡혀서 "키를 못 읽었다"로 끝난다). 여기서 한 번 깨진 적 있다.
function readEnvLocal() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()])
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 토큰 집계
// ─────────────────────────────────────────────────────────────────────────────
/** 단계별 usage. `anthropic.messages.parse` 를 감싸서 모은다 — 생성 함수들이 usage 를 돌려주지
 *  않으므로(반환값은 파싱된 결과뿐) 소스를 고치지 않고 재려면 이 방법뿐이다. */
const stages = [];
let currentLabel = "unknown";

function textUsd(u) {
  return (
    (u.input * SONNET_5.in +
      u.output * SONNET_5.out +
      u.cacheWrite * SONNET_5.cacheWrite +
      u.cacheRead * SONNET_5.cacheRead) /
    1e6
  );
}

function totalTextUsd() {
  return stages.reduce((sum, s) => sum + textUsd(s.usage), 0);
}

/** 해요체 유지율. `.tmp/saju/compare.mts` 가 쓴 것과 같은 거친 방식이다 — 형태소 분석이 아니라
 *  "문체가 무너졌는지"만 본다. §5 주의 2 가 잡은 실패(해요체 0%, 문어체로 도망감)를 감지하는 게
 *  목적이라 이 정도로 충분하다. */
function haeyoRatio(text) {
  const sentences = text
    .split(/[.!?\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  if (!sentences.length) return null;
  const haeyo = sentences.filter((s) => /[가-힣]{2}(요|죠|예요|네요)$/.test(s)).length;
  return { ratio: haeyo / sentences.length, haeyo, total: sentences.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 드라이런 — 무엇을 몇 원어치 부르는지
// ─────────────────────────────────────────────────────────────────────────────
async function dryRun() {
  // 상품 정의만 읽는다. 모델 호출이 없으므로 API 키도 필요 없다.
  const { getSajuProduct } = await import("@/lib/saju/products");
  const product = getSajuProduct(PRODUCT_SLUG);
  if (!product) throw new Error(`상품을 못 찾았다: ${PRODUCT_SLUG}`);

  const sectionCount = Math.min(product.sections.length, SECTION_LIMIT);
  // 골격·총평은 섹션 수와 무관한 고정비다. 섹션 수로 전체를 비례 축소하면 과소 추정이 된다.
  const sectionsWon = EXPECTED.perSectionWon * sectionCount;
  const textWon = EXPECTED.outlineWon + sectionsWon + EXPECTED.closingWon;
  const imageWon = (WITH_IMAGE ? EXPECTED.imageWon : 0) + (WITH_WEBP_PROBE ? EXPECTED.imageWon : 0);

  log("═".repeat(78));
  log("드라이런 — 실제 호출은 하지 않았습니다. 아무 비용도 나가지 않았습니다.");
  log("═".repeat(78));
  log("");
  log(`상품      ${product.title} (${PRODUCT_SLUG}) / ${MODE}`);
  log(`샘플      ${BIRTH.birthDate} ${BIRTH.birthTime} ${BIRTH.gender}  ← §2 실측과 같은 샘플`);
  log(`섹션      ${sectionCount} / ${product.sections.length}${SECTION_LIMIT !== Infinity ? "  (--sections 로 제한)" : ""}`);
  log(`이미지    ${WITH_IMAGE ? "생성함" : "건너뜀"}${WITH_WEBP_PROBE ? " + output_format 확인 1회" : ""}`);
  log("");
  log("── 호출 계획");
  log(`  1단 골격        Sonnet 5 × 1회`);
  log(`  2단 섹션        Sonnet 5 × ${sectionCount}회 (순차)`);
  log(`  3단 총평        Sonnet 5 × 1회        ← §11 미측정 항목`);
  if (WITH_IMAGE) log(`  이미지          gpt-image-2.5-flare × 1회`);
  if (WITH_WEBP_PROBE) log(`  webp 확인       gpt-image-2.5-flare × 1회  ← §11 미확인 항목`);
  log(`  Firestore       **쓰기 0건** (생성 계층만 부르므로 DB 를 안 탄다)`);
  log("");
  log("── 예상 비용 (§2 실측 기준, 환율 1,450원/$)");
  log(`  1단 골격        약 ${EXPECTED.outlineWon}원   (고정)`);
  log(`  2단 섹션        약 ${sectionsWon}원   (장당 약 ${EXPECTED.perSectionWon}원 × ${sectionCount})`);
  log(`  3단 총평        약 ${EXPECTED.closingWon}원   (고정, **미측정 예상치**)`);
  if (imageWon) log(`  이미지          약 ${imageWon}원   (장당 8원 × ${imageWon / EXPECTED.imageWon})`);
  log(`  ─────────────────────────`);
  log(`  합계            **약 ${textWon + imageWon}원**`);
  if (sectionCount === product.sections.length && WITH_IMAGE && !WITH_WEBP_PROBE) {
    log(`                  (§2 의 편당 ${EXPECTED.perReportWon}원과 같아야 한다)`);
  }
  log("");
  log("실제로 돌리려면 `--live` 를 붙이세요. 예상치는 §2 기준이고, 실측이 이보다 높게 나오면");
  log("그 자체가 문서를 고쳐야 한다는 신호입니다.");
  log("═".repeat(78));
}

// ─────────────────────────────────────────────────────────────────────────────
// 실호출
// ─────────────────────────────────────────────────────────────────────────────
async function live() {
  const env = readEnvLocal();
  if (!env.ANTHROPIC_API_KEY) throw new Error(".env.local 에서 ANTHROPIC_API_KEY 를 못 읽었다.");
  if (WITH_IMAGE && !env.OPENAI_API_KEY) throw new Error(".env.local 에서 OPENAI_API_KEY 를 못 읽었다.");
  // SDK 는 생성 시점에 키를 읽는다. **동적 import 보다 먼저** 넣어야 한다.
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;

  const { anthropic } = await import("@/lib/anthropic");
  const { getSajuProduct } = await import("@/lib/saju/products");
  const { calculateChart, buildChartBlock, whyUnsellable } = await import("@/lib/saju/generate/chart");
  const { generateOutline, buildSystemBlock, SAJU_TEXT_MODEL } = await import("@/lib/saju/generate/outline");
  const { generateSection, echoOf } = await import("@/lib/saju/generate/section");
  const { generateClosing } = await import("@/lib/saju/generate/closing");

  // usage 를 모으려고 공용 클라이언트를 감싼다. 소스를 고치지 않는다.
  const originalParse = anthropic.messages.parse.bind(anthropic.messages);
  anthropic.messages.parse = async (...args) => {
    const startedAt = Date.now();
    const res = await originalParse(...args);
    const u = res.usage ?? {};
    stages.push({
      label: currentLabel,
      ms: Date.now() - startedAt,
      usage: {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      },
    });
    return res;
  };

  const product = getSajuProduct(PRODUCT_SLUG);
  if (!product) throw new Error(`상품을 못 찾았다: ${PRODUCT_SLUG}`);
  const today = new Date();

  // ── 0. 프리플라이트 ──────────────────────────────────────────────────────
  // **아무 과금 호출을 하기 전에** 인증을 확인한다. `count_tokens` 는 공짜라서, 키가 틀렸거나
  // 조직 권한이 없으면 1원도 쓰지 않고 여기서 멈춘다. 덤으로 시스템 블록 크기를 재는데, 그
  // 값이 Sonnet 의 최소 캐시 길이(1,024)를 넘어야 §5 의 캐시 절감이 성립한다.
  const unsellable = whyUnsellable(BIRTH, MODE);
  if (unsellable) throw new Error(`이 샘플은 팔 수 없는 조합이다: ${unsellable}`);
  const chart = calculateChart(BIRTH, MODE, today);
  if (!chart) throw new Error("계산 실패 — 리포트를 만들 수 없다(§9 전액 환불 대상).");

  const systemBlock = buildSystemBlock(product, chart, today);
  // 메서드 이름은 `countTokens` 다(camelCase). 와이어 형식의 `count_tokens` 로 부르면
  // undefined 라서 프리플라이트가 그대로 죽는다 — 과금 전이라 손해는 없지만 실행이 막힌다.
  const counted = await anthropic.messages.countTokens({
    model: SAJU_TEXT_MODEL,
    system: [{ type: "text", text: systemBlock }],
    messages: [{ role: "user", content: "." }],
  });
  log(`✓ 인증 정상 (count_tokens 는 무료)`);
  log(`  시스템 블록 ${counted.input_tokens} 토큰 (§5 기록 ${EXPECTED.systemBlockTokens})`);
  if (counted.input_tokens < 1024) {
    log("  ⚠️ 1,024 미만이면 Sonnet 에서 캐시가 아예 안 걸린다 — 원가 계산의 전제가 깨진다.");
  }
  log(`  명반: ${buildChartBlock(chart, today).length}자`);
  log("");

  // ── 1단 골격 ─────────────────────────────────────────────────────────────
  log("… 1단 골격");
  currentLabel = "1단 골격";
  const t0 = Date.now();
  const outline = await generateOutline({ product, chart, userInput: USER_INPUT, today });
  log(`✓ 1단 ${secs(Date.now() - t0)}초 — 섹션 ${outline.sections.length}개, 비유 ${outline.usedMetaphors.length}개`);
  log(`  image_brief ${outline.imageBrief ? `있음 (${outline.imageBrief.length}자)` : "**없음 ✗** (이미지 상품인데 비어 있다)"}`);

  // ── 2단 섹션 (순차) ──────────────────────────────────────────────────────
  // 순차인 것이 핵심이다 — 병렬로 하면 해요체 유지가 46% 로 떨어진다(§5).
  const count = Math.min(product.sections.length, SECTION_LIMIT);
  const sections = [];
  const written = [];
  for (let i = 0; i < count; i++) {
    currentLabel = `2단 섹션 ${i + 1}`;
    const s0 = Date.now();
    const section = await generateSection({ product, chart, outline, index: i, written, userInput: USER_INPUT, today });
    sections.push(section);
    // **`echoOf` 에 넣는 건 본문이 있는 섹션만이다.** 실패 자리표에는 본문이 없어서 터진다
    // (`storage.ts` 의 SajuReadingPage 주석). 여기서는 전부 본문이지만 계약을 따라 둔다.
    written.push(echoOf(section));
    log(`✓ 2단 ${i + 1}/${count} ${secs(Date.now() - s0)}초 — ${section.title} (${section.summary.length}자)`);
  }

  // ── 3단 총평 — §11 미측정 항목 ───────────────────────────────────────────
  log("… 3단 총평 (여기가 §11 의 미측정 항목이다)");
  currentLabel = "3단 총평";
  const c0 = Date.now();
  const closing = await generateClosing({ product, chart, sections, today });
  const closingMs = Date.now() - c0;
  log(`✓ 3단 ${secs(closingMs)}초 — ${closing.title}, 다음 걸음 ${closing.nextSteps.length}개`);

  // ── 이미지 ───────────────────────────────────────────────────────────────
  mkdirSync(OUT_DIR, { recursive: true });
  let imageReport = null;
  let webpProbe = null;

  if (WITH_IMAGE) {
    const { generateSajuImage, SAJU_IMAGE_MODEL, SAJU_IMAGE_SIZE, SAJU_IMAGE_QUALITY } = await import(
      "@/lib/saju/generate/image"
    );
    log("… 이미지");
    const i0 = Date.now();
    const img = await generateSajuImage({ product, imageBrief: outline.imageBrief });
    const ms = Date.now() - i0;
    const path = `${OUT_DIR}/image.webp`;
    writeFileSync(path, img.webp);
    // 출력 토큰만 세면 장당 7원이 된다 — 이미지는 **입력도 과금된다**(§2). 실측 토큰이 오면
    // 그걸 쓰고, 없으면 문서의 158 로 갈음한다.
    const outTok = img.outputTokens ?? 158;
    imageReport = { ms, bytes: img.webp.length, outTok, path, promptChars: img.prompt.length };
    log(`✓ 이미지 ${secs(ms)}초 — webp ${(img.webp.length / 1024).toFixed(0)}KB, 출력 ${outTok}토큰`);
    log(`  저장: ${path} (로컬, .gitignore 대상)`);

    if (WITH_WEBP_PROBE) {
      // §11: `output_format: "webp"` 가 먹으면 모델이 바로 webp 를 주므로 `toWebp()` 를 통째로
      // 지우고 `sharp` 의존을 런타임에서 없앨 수 있다. 미검증 파라미터라 400 이 날 수 있는데,
      // **400 은 과금되지 않으므로** 실패해도 잃는 게 없다.
      log("… output_format: \"webp\" 확인 (§11)");
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: SAJU_IMAGE_MODEL,
          prompt: "A quiet window seat at dusk, soft light, no text.",
          size: SAJU_IMAGE_SIZE,
          quality: SAJU_IMAGE_QUALITY,
          n: 1,
          output_format: "webp",
        }),
      });
      if (!res.ok) {
        webpProbe = { accepted: false, detail: (await res.text()).slice(0, 300) };
        log(`  ✗ 거부됨(${res.status}) — sharp 재인코딩을 유지해야 한다. 이 호출은 과금되지 않았다.`);
      } else {
        const body = await res.json();
        const b64 = body.data?.[0]?.b64_json ?? "";
        const bytes = Buffer.from(b64, "base64");
        // webp 매직 넘버: "RIFF"…"WEBP". 서버가 파라미터를 조용히 무시하고 PNG 를 줄 수도 있다.
        const isWebp = bytes.slice(0, 4).toString() === "RIFF" && bytes.slice(8, 12).toString() === "WEBP";
        writeFileSync(`${OUT_DIR}/probe.${isWebp ? "webp" : "png"}`, bytes);
        webpProbe = { accepted: true, isWebp, bytes: bytes.length, outTok: body.usage?.output_tokens ?? null };
        log(
          isWebp
            ? `  ✓ 먹는다 — 바로 webp(${(bytes.length / 1024).toFixed(0)}KB). image.ts 의 toWebp() 와 sharp 를 지울 수 있다.`
            : `  △ 400 은 아닌데 결과가 webp 가 아니다(무시된 것). sharp 를 유지할 것.`
        );
      }
    }
  }

  // ── 보고 ─────────────────────────────────────────────────────────────────
  const body = sections.map((s) => [s.summary, s.sajuBasis, s.ziweiBasis, s.actionGuide].join(" ")).join("\n");
  const style = haeyoRatio(body);
  const textUsdTotal = totalTextUsd();
  const imageUsd = imageReport ? (imageReport.outTok * IMAGE.out + 151 * IMAGE.in) / 1e6 : 0;

  writeFileSync(
    `${OUT_DIR}/report.json`,
    JSON.stringify({ stages, outline, sections, closing, imageReport, webpProbe, style }, null, 2)
  );

  log("");
  log("═".repeat(78));
  log("실측 결과");
  log("═".repeat(78));
  log("");
  log("단계                 시간      입력      캐시읽기    출력     원가");
  for (const s of stages) {
    log(
      `${s.label.padEnd(20)} ${`${secs(s.ms)}s`.padStart(6)} ${String(s.usage.input).padStart(9)} ` +
        `${String(s.usage.cacheRead).padStart(10)} ${String(s.usage.output).padStart(8)} ${`${won(textUsd(s.usage))}원`.padStart(8)}`
    );
  }
  const cacheReadTotal = stages.reduce((n, s) => n + s.usage.cacheRead, 0);
  const cacheWriteTotal = stages.reduce((n, s) => n + s.usage.cacheWrite, 0);
  log("");
  // §2 의 196원은 **골격 + 섹션 10회**다(총평 제외). 그래서 비교 대상도 그 구간만 고른다.
  const outlineAndSectionsUsd = stages
    .filter((s) => !s.label.startsWith("3단"))
    .reduce((sum, s) => sum + textUsd(s.usage), 0);
  log(
    `골격+섹션            ${won(outlineAndSectionsUsd)}원   ` +
      `(§2 기록 ${EXPECTED.outlineWon + EXPECTED.perSectionWon * count}원 = 골격 ${EXPECTED.outlineWon} + 섹션 ${count}장)`
  );
  log(`  └ 3단 총평만       ${won(textUsd(stages.at(-1).usage))}원, ${secs(closingMs)}초   ← §11 미측정 항목, 예상 ${EXPECTED.closingWon}원`);
  log(`  └ 캐시             읽기 ${cacheReadTotal} / 쓰기 ${cacheWriteTotal} 토큰`);
  if (cacheReadTotal === 0) {
    log("     ⚠️ 캐시 적중이 0이다. 시스템 블록이 호출마다 달라졌다는 뜻이고, 원가 전제가 깨진다.");
  }
  if (imageReport) log(`이미지               ${won(imageUsd)}원, ${secs(imageReport.ms)}초   (§2 기록 ${EXPECTED.imageWon}원)`);
  log(`텍스트 합계          ${won(textUsdTotal)}원   (총평 포함)`);
  log(`편당 합계            **${won(textUsdTotal + imageUsd)}원**   (§2 기록 ${EXPECTED.perReportWon}원)`);
  log("");
  if (style) {
    log(`해요체 유지율        ${(style.ratio * 100).toFixed(0)}%  (${style.haeyo}/${style.total}문장)  — §5 순차 기준 70%`);
    if (style.ratio < 0.5) log("     ⚠️ 50% 미만이면 문체가 무너진 것이다(§5 주의 2).");
  }
  if (SECTION_LIMIT !== Infinity) {
    log("");
    log(`※ 섹션을 ${count}개로 줄여 돌렸다. 편당 합계를 §2 의 ${EXPECTED.perReportWon}원과 직접 비교할 수 없다`);
    log(`   — 골격·총평은 고정비라, 비교하려면 장당 원가(위 2단 줄)를 보면 된다.`);
  }
  log("");
  log(`전문: ${OUT_DIR}/report.json`);
  log("═".repeat(78));
}

async function cleanup() {
  if (!createdRemote.length) {
    log("\n정리: 프로덕션에 만든 것이 없습니다(이 스크립트는 Firestore 를 쓰지 않습니다).");
    return;
  }
  // 지금은 도달하지 않는 경로다. 나중에 쓰기가 생기면 여기서 지운다.
  log("\n── 정리");
  for (const ref of createdRemote.reverse()) {
    await ref.delete().catch((e) => log(`  삭제 실패 ${ref.path}: ${e.message}`));
  }
  log(`  ${createdRemote.length}건 삭제`);
}

try {
  if (LIVE) await live();
  else await dryRun();
} catch (e) {
  log(`\n✗ 실패: ${e.stack ?? e.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
