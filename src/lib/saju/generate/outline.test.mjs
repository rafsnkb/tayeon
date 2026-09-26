// `buildSystemBlock` — 1·2·3단이 **바이트 단위로 공유**하는 캐시 블록(설계 §5).
//
// 세 단계가 전부 이 함수를 그대로 가져다 쓰므로(`section.ts`·`closing.ts` 가 `import
// { buildSystemBlock } from "./outline"`) "세 단계가 같은 문자열을 받는가"는 사실 "이 함수가
// 같은 입력에 항상 같은 출력을 내는가" 하나로 줄어든다. 페르소나가 상품마다 다른 문체 지시를
// 이 블록에 꽂기 시작하면서(2026-09-26), 그 지시문이 조용히 상품별로 달라지거나 페르소나
// 교체가 반영이 안 되는 회귀를 여기서 막는다.
import test from "node:test";
import assert from "node:assert/strict";
import { buildSystemBlock } from "./outline.ts";
import { calculateChart } from "./chart.ts";
import { getSajuProduct } from "@/lib/saju/products";

const TODAY = new Date("2026-09-26T00:00:00Z");

/** 팔 수 있는 최소 조건을 갖춘 출생 정보(`chart.test.mjs` 와 같은 모양). */
function birthInfo(over = {}) {
  return {
    calendarType: "solar",
    isLeapMonth: false,
    birthDate: "1996-04-12",
    birthTime: "14:30",
    timeUnknown: false,
    jasiRule: "midnight",
    gender: "female",
    useTrueSolarTime: false,
    birthPlace: null,
    ...over,
  };
}

const SINGLE_LOVE = getSajuProduct("single-love"); // persona: warm-romantic-friend (반말)
const BUSINESS = getSajuProduct("business-partnership"); // persona: pragmatic-strategist (격식체)

test("같은 상품·차트·날짜면 buildSystemBlock 이 바이트 단위로 같다", () => {
  // 이게 캐시가 걸리는 이유의 전부다 — prefix 가 한 바이트라도 다르면 1·2·3단이 캐시를 못
  // 나눠 쓴다(설계 §5 "재조립 금지"). 1단·2단·3단이 각자 이 함수를 호출하는 자리(outline.ts
  // 의 generateOutline, section.ts 의 generateSection, closing.ts 의 generateClosing)는
  // 전부 같은 `(product, chart, today)` 세 인자만 넘긴다 — 그래서 이 함수의 순수성 하나만
  // 지키면 세 단계의 동일성이 보장된다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  assert.ok(chart, "픽스처 차트 계산이 실패했다");

  const first = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  const second = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.equal(first, second);
});

test("페르소나가 다른 상품이면 문체 줄이 실제로 달라진다", () => {
  // 배선이 실수로 한 페르소나에 고정되지 않았는지 확인한다 — single-love(반말)와
  // business-partnership(격식체)는 endingRegister 부터 다르다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  const loveBlock = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  const businessBlock = buildSystemBlock(BUSINESS, chart, TODAY);
  assert.notEqual(loveBlock, businessBlock);
  assert.match(loveBlock, /반말/);
  assert.match(businessBlock, /격식체/);
});

test("전문 용어·퍼센트 규칙 두 줄은 페르소나와 무관하게 고정이다", () => {
  // 이 두 줄은 품질 규칙이지 페르소나가 아니다 — 첫 줄만 페르소나로 바뀐다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  for (const product of [SINGLE_LOVE, BUSINESS]) {
    const block = buildSystemBlock(product, chart, TODAY);
    assert.match(block, /전문 용어는 근거를 말할 때만 쓰고, 바로 쉬운 말로 풀어 준다\./);
    assert.match(block, /퍼센트나 점수로 일치도를 말하지 않는다\. 근거 없는 수치다\./);
  }
});

test("모드가 바뀌어도 페르소나 문체 줄은 그대로 들어간다", () => {
  // 분석 모드(사주/자미두수/통합)와 문체(페르소나)는 서로 다른 축이다 — 섞이면 안 된다.
  for (const mode of ["saju", "ziwei", "integrated"]) {
    const chart = calculateChart(birthInfo(), mode, TODAY);
    const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
    assert.match(block, /반말/, mode);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 모드별 자기모순 회귀(2026-09-26) — "자미두수 쓰지 말 것"이라 해 놓고 바로 아래
// "## 자미두수 중점"이 궁·주성 이름을 대며 그 체계를 쓰라고 말하던 버그.
// ─────────────────────────────────────────────────────────────────────────────

test("사주 단일 모드는 자미두수 중점 블록이 아예 없다", () => {
  const chart = calculateChart(birthInfo(), "saju", TODAY);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.match(block, /## 사주 중점/);
  assert.doesNotMatch(block, /## 자미두수 중점/);
  // 안 쓰기로 한 체계의 실제 문구(명궁·부처궁 등, sajuFocus/ziweiFocus 원문)가 남아있으면
  // 안 된다 — 제목만 지우고 본문이 새는 회귀를 잡는다.
  assert.doesNotMatch(block, new RegExp(SINGLE_LOVE.ziweiFocus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("자미두수 단일 모드는 사주 중점 블록이 아예 없다", () => {
  const chart = calculateChart(birthInfo(), "ziwei", TODAY);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.match(block, /## 자미두수 중점/);
  assert.doesNotMatch(block, /## 사주 중점/);
  assert.doesNotMatch(block, new RegExp(SINGLE_LOVE.sajuFocus.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("통합 모드는 둘 다 있고 '통합 교차 포인트' 제목을 쓴다", () => {
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.match(block, /## 사주 중점/);
  assert.match(block, /## 자미두수 중점/);
  assert.match(block, /## 통합 교차 포인트/);
  assert.doesNotMatch(block, /## 이 리포트가 짚어야 할 것/);
});

test("단일 모드는 crossPoints 제목이 '이 리포트가 짚어야 할 것'으로 바뀐다 (내용은 그대로)", () => {
  // 제목만 바꾸고 내용(product.crossPoints)은 지우지 않는다 — 대부분 모드 중립적인
  // 우선순위라 단일 모드에서도 쓸모가 있다(control tower 판단, 2026-09-26).
  for (const mode of ["saju", "ziwei"]) {
    const chart = calculateChart(birthInfo(), mode, TODAY);
    const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
    assert.match(block, /## 이 리포트가 짚어야 할 것/, mode);
    assert.doesNotMatch(block, /## 통합 교차 포인트/, mode);
    assert.ok(block.includes(SINGLE_LOVE.crossPoints), mode);
  }
});

test("모드별로도 같은 입력이면 바이트 단위로 같다 (세 모드 각각)", () => {
  for (const mode of ["saju", "ziwei", "integrated"]) {
    const chart = calculateChart(birthInfo(), mode, TODAY);
    const first = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
    const second = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
    assert.equal(first, second, mode);
  }
});

test("단일 모드 시스템 블록이 통합 모드보다 짧다", () => {
  // 안 쓰는 체계의 중점 블록 하나를 통째로 빼므로, 단일 모드 쪽이 항상 더 짧아야 한다.
  const integrated = buildSystemBlock(SINGLE_LOVE, calculateChart(birthInfo(), "integrated", TODAY), TODAY);
  const saju = buildSystemBlock(SINGLE_LOVE, calculateChart(birthInfo(), "saju", TODAY), TODAY);
  const ziwei = buildSystemBlock(SINGLE_LOVE, calculateChart(birthInfo(), "ziwei", TODAY), TODAY);
  assert.ok(saju.length < integrated.length);
  assert.ok(ziwei.length < integrated.length);
});

// ─────────────────────────────────────────────────────────────────────────────
// `## 등장인물`(personRule) — 계산만 되고 실제로 프롬프트에 안 들어가던 회귀(2026-09-26).
// `needsPartner: false` 상품 다수에서 "없는 상대 명반을 인용하지 말라"는 안전 규칙이 한 번도
// 전달된 적이 없었다 — lint 의 no-unused-vars 경고가 계속 알려주고 있었는데 경고 22개에
// 묻혀서 아무도 못 봤다. 다시 안 묻히게 테스트로 고정한다.
// ─────────────────────────────────────────────────────────────────────────────

const CRUSH_READING = getSajuProduct("crush-reading"); // needsPartner: true

test("등장인물 블록이 실제로 시스템 블록에 들어간다 — 상대 없음", () => {
  // single-love 는 needsPartner: false 다. chart.partner 가 없다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  assert.equal(chart.partner, null);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.match(block, /## 등장인물/);
  assert.match(block, /명반은 여기 없다/);
});

test("등장인물 블록이 실제로 시스템 블록에 들어간다 — 상대 있음", () => {
  const chart = calculateChart(
    birthInfo(),
    "integrated",
    TODAY,
    { required: true, birthInfo: birthInfo({ birthDate: "1997-08-20", birthTime: "09:15", gender: "male" }) }
  );
  assert.ok(chart.partner, "픽스처가 상대 명반을 못 만들었다");
  const block = buildSystemBlock(CRUSH_READING, chart, TODAY);
  assert.match(block, /## 등장인물/);
  assert.match(block, /두 사람의 명반이 모두 있다/);
});

test("등장인물 규칙이 '상대 언급 금지'로 퇴화하지 않는다 — 인용 금지만 말한다", () => {
  // 이 문구가 퇴화하면 안 되는 이유가 파일 머리말에 있다: single-love 의 "들어올 인연"처럼
  // 명반이 없는 사람을 다루는 것 자체가 상품인 경우가 있다. 금지 대상은 "그 사람을 언급하는
  // 것"이 아니라 "그 사람의 없는 명반을 인용하는 것"이어야 한다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  assert.match(block, /명반을 인용하지 말 것/);
  assert.doesNotMatch(block, /상대(방|를|에 대해)[^.]*(이야기하지|언급하지|말하지) ?말/);
});

test("등장인물 블록은 분석 모드 블록 바로 뒤에 온다", () => {
  // "이 리포트에 없는 것을 이름 대고 금지한다"는 같은 종류의 규칙이라 붙어 있어야 읽힌다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY);
  const block = buildSystemBlock(SINGLE_LOVE, chart, TODAY);
  const modeIdx = block.indexOf("## 분석 모드");
  const personIdx = block.indexOf("## 등장인물");
  assert.ok(modeIdx >= 0 && personIdx >= 0);
  assert.ok(personIdx > modeIdx);
  // 둘 사이에 다른 "## " 헤딩이 끼어들지 않는다 — 붙어 있어야 한다는 요구사항 그대로.
  const between = block.slice(modeIdx + "## 분석 모드".length, personIdx);
  assert.doesNotMatch(between, /## /);
});
