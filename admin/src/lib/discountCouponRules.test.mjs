import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCouponIssue,
  periodsOverlap,
  findOverlapping,
  generateCouponCode,
  MAX_DISCOUNT_PERCENT,
} from "./discountCouponRules.ts";

// 2026-09-25 신설. 겹침 검사가 무너지면 "한 사용자가 쓸 수 있는 쿠폰은 최대 한 장"이라는
// 전제가 깨지고, 그 전제 위에 서 있는 구매 화면과 적용 로직이 같이 흔들린다.

const 유효입력 = {
  code: "launch30",
  name: "런칭 기념 30% 할인",
  discountPercent: 30,
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-07T23:59:59.000Z",
  maxRegistrations: 100,
};

test("정상 입력은 코드 대문자화와 비율 변환을 거쳐 통과한다", () => {
  const r = validateCouponIssue(유효입력);
  assert.equal(r.ok, true);
  assert.equal(r.value.code, "LAUNCH30");
  assert.equal(r.value.name, "런칭 기념 30% 할인");
  assert.equal(r.value.discountRate, 0.3);
  assert.equal(r.value.maxRegistrations, 100);
});

test("선착순을 비워두면 무제한이다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, maxRegistrations: null }).value.maxRegistrations, null);
  assert.equal(validateCouponIssue({ ...유효입력, maxRegistrations: undefined }).value.maxRegistrations, null);
});

test("쿠폰 이름은 필수다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, name: "  " }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, name: undefined }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, name: "가".repeat(51) }).ok, false);
});

test("코드 형식을 지킨다 — 본체의 등록 규칙과 같아야 한다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, code: "AB" }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, code: "LAUNCH-30" }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, code: "A".repeat(21) }).ok, false);
});

test("할인율은 1~99 정수다 — 100%는 청구액이 0이 되어 결제창이 뜨지 않는다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, discountPercent: 0 }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, discountPercent: 100 }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, discountPercent: 30.5 }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, discountPercent: MAX_DISCOUNT_PERCENT }).ok, true);
});

test("종료가 시작보다 뒤여야 한다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, endsAt: 유효입력.startsAt }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, endsAt: "2026-09-01T00:00:00.000Z" }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, startsAt: "언제" }).ok, false);
});

test("선착순 인원은 1 이상의 정수다", () => {
  assert.equal(validateCouponIssue({ ...유효입력, maxRegistrations: 0 }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, maxRegistrations: -1 }).ok, false);
  assert.equal(validateCouponIssue({ ...유효입력, maxRegistrations: 1.5 }).ok, false);
});

const 시월초 = { startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-07T00:00:00.000Z" };

test("기간이 한 순간이라도 겹치면 겹침이다", () => {
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-10-05T00:00:00.000Z", endsAt: "2026-10-10T00:00:00.000Z" }), true);
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-09-20T00:00:00.000Z", endsAt: "2026-10-03T00:00:00.000Z" }), true);
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-10-02T00:00:00.000Z", endsAt: "2026-10-03T00:00:00.000Z" }), true, "완전히 안쪽");
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z" }), true, "완전히 바깥");
});

test("경계가 맞닿는 것도 겹침으로 본다 — 그 순간 둘 다 유효하다", () => {
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-10-07T00:00:00.000Z", endsAt: "2026-10-14T00:00:00.000Z" }), true);
});

test("떨어져 있으면 겹치지 않는다", () => {
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-10-08T00:00:00.000Z", endsAt: "2026-10-14T00:00:00.000Z" }), false);
  assert.equal(periodsOverlap(시월초, { startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-30T00:00:00.000Z" }), false);
});

test("읽을 수 없는 기간은 겹침으로 본다 — 모르는 채로 발급을 통과시키지 않는다", () => {
  assert.equal(periodsOverlap(시월초, { startsAt: "", endsAt: "" }), true);
});

test("겹치는 기존 쿠폰을 찾아낸다", () => {
  const 기존 = [
    { code: "OLD", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-09-30T00:00:00.000Z" },
    { code: "SAME", ...시월초 },
  ];
  assert.equal(findOverlapping(기존, { startsAt: "2026-10-03T00:00:00.000Z", endsAt: "2026-10-05T00:00:00.000Z" }).code, "SAME");
  assert.equal(findOverlapping(기존, { startsAt: "2026-11-01T00:00:00.000Z", endsAt: "2026-11-05T00:00:00.000Z" }), null);
});

test("비활성화된 쿠폰은 새 쿠폰의 기간을 막지 않는다", () => {
  const 기존 = [{ code: "DEAD", ...시월초, disabled: true }];
  assert.equal(findOverlapping(기존, { startsAt: "2026-10-03T00:00:00.000Z", endsAt: "2026-10-05T00:00:00.000Z" }), null);
});

// ── 랜덤 코드 생성 ─────────────────────────────────────────────────────────
// 중복 판정은 여기가 아니라 서버(Firestore 조회)가 한다. 여기서 지킬 것은 "만들어진 코드를
// 사용자가 실제로 등록할 수 있는가" 하나다 — 형식이 어긋나면 발급이 통째로 헛돈다.

test("생성한 코드는 등록 규칙(영문 대문자·숫자 4~20자)을 통과한다", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCouponCode();
    assert.match(code, /^[A-Z0-9]{4,20}$/, code);
  }
});

test("헷갈리는 글자는 쓰지 않는다 — 옮겨 적다 틀리면 '코드가 안 먹는다'가 된다", () => {
  for (let i = 0; i < 200; i++) {
    assert.doesNotMatch(generateCouponCode(), /[O0I1L2Z5S8B]/);
  }
});

test("난수원을 주입하면 결과가 정해진다 (재현 가능)", () => {
  const always = () => 0;
  assert.equal(generateCouponCode(always), generateCouponCode(always));
});

test("서로 다른 코드가 나온다", () => {
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(generateCouponCode());
  assert.ok(seen.size > 290, `중복이 너무 많다: ${seen.size}/300`);
});
