// `whyUnsellable` — 이 모드를 이 사람에게 팔 수 있는가(§10 판매 제약).
//
// 화면(구매 버튼)과 결제(금액 확정)가 **둘 다 이 함수 하나만** 판정으로 쓰기로 했으므로 여기가
// 계약이다. 두 곳이 각자 조건을 다시 쓰면 반드시 갈라지고, 갈라지는 방향이 "화면은 막는데 API 는
// 통과"면 돈을 받고 어긋난 리포트를 주게 된다.
import test from "node:test";
import assert from "node:assert/strict";
import { buildChartBlock, calculateChart, whyUnsellable } from "./chart.ts";

/** 팔 수 있는 최소 조건을 갖춘 출생 정보. 테스트마다 한 칸만 망가뜨려서 그 칸의 효과를 본다. */
function birthInfo(over = {}) {
  return {
    calendarType: "solar",
    isLeapMonth: false,
    birthDate: "1996-04-12",
    birthTime: "14:30",
    timeUnknown: false,
    // "modern" 이었는데 `JasiRule` 에 없는 값이라 고쳤다(2026-09-26). `whyUnsellable` 은 이 칸을
    // 안 봐서 조용히 통과했지만, 같은 픽스처로 `calculateChart` 를 부르는 순간 manseryeok 이
    // RangeError 를 던진다.
    jasiRule: "midnight",
    gender: "female",
    useTrueSolarTime: false,
    birthPlace: null,
    ...over,
  };
}

const MODES = ["saju", "ziwei", "integrated"];

const TODAY = new Date("2026-09-26T00:00:00Z");

test("정보가 갖춰지면 세 모드 모두 판다", () => {
  for (const mode of MODES) {
    assert.equal(whyUnsellable(birthInfo(), mode), null, mode);
  }
});

test("생년월일이 없으면 어떤 모드도 못 판다", () => {
  for (const mode of MODES) {
    const why = whyUnsellable(birthInfo({ birthDate: null }), mode);
    assert.equal(typeof why, "string", mode);
    assert.match(why, /생년월일/);
  }
});

test("성별 '선택안함'은 어떤 모드도 못 판다", () => {
  // 타로에서는 허용이었다 — 사주 대운은 성별 없이 계산이 생략되고 자미두수는 지금 남성으로
  // 때우고 있어서, 돈을 받는 상품에서는 "다른 사람 얘기"가 되기 때문에 막는다.
  for (const mode of MODES) {
    const why = whyUnsellable(birthInfo({ gender: "unspecified" }), mode);
    assert.equal(typeof why, "string", mode);
    assert.match(why, /성별/);
  }
});

test("남성·여성은 둘 다 통과한다", () => {
  for (const gender of ["male", "female"]) {
    for (const mode of MODES) {
      assert.equal(whyUnsellable(birthInfo({ gender }), mode), null, `${gender}/${mode}`);
    }
  }
});

test("시간을 모르면 자미두수·통합은 못 팔고 사주는 판다", () => {
  // 시진이 틀리면 명궁이 통째로 다른 궁으로 가서 자미두수 리포트 전체가 어긋난다. 사주는 시주만
  // 빼고 해석하면 성립하므로 사주 모드만 판다 — 이 비대칭이 이 함수의 존재 이유다.
  const unknown = birthInfo({ timeUnknown: true, birthTime: null });
  assert.equal(whyUnsellable(unknown, "saju"), null);
  for (const mode of ["ziwei", "integrated"]) {
    const why = whyUnsellable(unknown, mode);
    assert.equal(typeof why, "string", mode);
    assert.match(why, /태어난 시간/);
  }
});

test("성별과 시간이 함께 빠지면 성별을 먼저 말한다", () => {
  // 안내 문구가 하나만 나가므로 순서가 곧 사용자가 먼저 고칠 항목이다. 성별은 세 모드 전부를
  // 막으므로 그쪽이 먼저 나오는 게 맞다.
  const why = whyUnsellable(birthInfo({ gender: "unspecified", timeUnknown: true }), "integrated");
  assert.match(why, /성별/);
});

test("생년월일과 성별이 함께 빠지면 생년월일을 먼저 말한다", () => {
  const why = whyUnsellable(birthInfo({ birthDate: null, gender: "unspecified" }), "saju");
  assert.match(why, /생년월일/);
});

test("사유는 사용자에게 보여줄 문장이다", () => {
  // 에러 코드가 아니라 화면에 그대로 띄우는 문구라, 비면 사용자가 무엇을 고쳐야 할지 모른다.
  const whys = [
    whyUnsellable(birthInfo({ birthDate: null }), "saju"),
    whyUnsellable(birthInfo({ gender: "unspecified" }), "saju"),
    whyUnsellable(birthInfo({ timeUnknown: true }), "ziwei"),
  ];
  for (const why of whys) {
    assert.ok(why.length > 5, why);
    assert.match(why, /니다\.$/);
  }
});

test("timeUnknown 이 false 면 birthTime 유무와 무관하게 통과한다", () => {
  // 판정은 `timeUnknown` 플래그만 본다. 두 값이 어긋난 문서가 과거에 저장돼 있어도 이 함수의
  // 답이 흔들리지 않아야 화면과 결제가 같은 결론에 도달한다.
  assert.equal(whyUnsellable(birthInfo({ timeUnknown: false, birthTime: null }), "ziwei"), null);
});

// ── 두 사람 (2026-09-26) ────────────────────────────────────────────────────
// `needsPartner: true` 상품이 19개 중 10개다. 계산 계층이 상대를 받게 되면서 생긴 계약을 여기
// 고정한다 — 특히 **상대가 빠졌는데 계산이 성립해 버리는 것**이 제일 위험하다. 그러면 두 사람
// 얘기를 하기로 하고 판 리포트가 한 사람 얘기로 나오고, 사용자는 그걸 읽고 나서야 안다.

test("상대가 필요한 상품인데 상대가 없으면 계산이 성립하지 않는다", () => {
  for (const mode of MODES) {
    const chart = calculateChart(birthInfo(), mode, TODAY, { required: true, birthInfo: null });
    assert.equal(chart, null, mode);
  }
});

test("상대에게도 같은 판매 제약이 걸린다", () => {
  // 내담자는 멀쩡한데 상대의 성별이 없다. 상대의 시진이 틀리면 상대의 명궁이 통째로 다른 궁으로
  // 가는 건 내담자 쪽과 똑같으므로, 같은 함수가 같은 답을 내야 한다.
  const noGender = { required: true, birthInfo: birthInfo({ gender: "unspecified" }) };
  const noTime = { required: true, birthInfo: birthInfo({ timeUnknown: true }) };
  for (const mode of MODES) {
    assert.equal(calculateChart(birthInfo(), mode, TODAY, noGender), null, `성별/${mode}`);
  }
  // 시간 모름은 사주 단품만 막지 않는다 — 내담자 쪽 규칙과 같다.
  assert.notEqual(calculateChart(birthInfo(), "saju", TODAY, noTime), null);
  assert.equal(calculateChart(birthInfo(), "ziwei", TODAY, noTime), null);
  assert.equal(calculateChart(birthInfo(), "integrated", TODAY, noTime), null);
});

test("상대가 필요 없는 상품은 상대 명반을 만들지 않는다", () => {
  // `required: false` 면 상대 정보가 들어와도 무시한다. 상품이 한 사람짜리인데 상대 명반이
  // 프롬프트에 끼면 모델이 그걸 근거로 쓴다.
  const chart = calculateChart(birthInfo(), "integrated", TODAY, {
    required: false,
    birthInfo: birthInfo({ gender: "male" }),
  });
  assert.notEqual(chart, null);
  assert.equal(chart.partner, null);
  assert.equal(buildChartBlock(chart, TODAY), buildChartBlock(calculateChart(birthInfo(), "integrated", TODAY), TODAY));
});

test("상대가 있으면 명반 블록이 누구 것인지 밝힌다", () => {
  const chart = calculateChart(birthInfo(), "integrated", TODAY, {
    required: true,
    birthInfo: birthInfo({ gender: "male", birthDate: "1994-08-03" }),
  });
  assert.notEqual(chart, null);
  const block = buildChartBlock(chart, TODAY);
  assert.match(block, /^# 내담자$/m);
  assert.match(block, /^# 상대방$/m);
  // 섞지 말라는 규칙이 프롬프트에 실제로 들어가야 한다 — 화면 규칙만으로는 본문 문장을 못 막는다.
  assert.match(block, /## 두 사람을 함께 쓸 때/);
  // 두 사람의 명반이 실제로 둘 다 들어 있다(사주 원국이 사람마다 한 번씩).
  assert.equal(block.match(/## 사주 원국/g).length, 2);
});

test("상대가 없는 상품의 블록에는 사람 머리말이 붙지 않는다", () => {
  // 캐시 때문이다(설계 §5). 1·2·3단이 바이트 단위로 같은 시스템 블록을 받아야 하는데, 한 명뿐인
  // 상품에 이름표를 달면 가리킬 대상이 하나뿐이라 의미도 없이 캐시만 깨진다.
  const block = buildChartBlock(calculateChart(birthInfo(), "integrated", TODAY), TODAY);
  assert.doesNotMatch(block, /^# /m);
  assert.doesNotMatch(block, /두 사람을 함께 쓸 때/);
});
