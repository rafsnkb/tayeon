import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNT_PACKAGES,
  COMBOS,
  countAllowance,
  countAllowances,
  countAllowanceForCombo,
  countAllowancesForCombo,
  comboKeyFor,
  availableCount,
  remainingAfterUse,
  rewardPassesForWon,
  SIGNUP_FREE_PASS_BASIS,
  SIGNUP_FREE_PASSES,
  signupFreePassAllowances,
} from "./pricing.ts";

// 2026-09-24 사용자 확정 가격표. [상품][조합][스프레드] — 조합은 타로 / +사주 / +자미두수 /
// +사주+자미두수, 스프레드는 원카드·쓰리카드·양자택일·켈틱크로스 순.
const expected = [
  [[10, 7, 5, 4], [9, 6, 4, 3], [8, 5, 3, 2], [5, 4, 2, 1]],
  [[21, 14, 10, 8], [18, 12, 9, 7], [16, 11, 8, 6], [11, 7, 5, 4]],
  [[47, 31, 23, 19], [40, 26, 20, 16], [35, 23, 17, 14], [24, 16, 12, 10]],
  [[133, 89, 67, 53], [113, 76, 57, 45], [100, 67, 50, 40], [67, 45, 34, 27]],
  [[217, 144, 108, 87], [184, 122, 92, 74], [163, 108, 81, 65], [109, 72, 54, 44]],
  [[450, 300, 225, 180], [383, 255, 191, 153], [338, 225, 169, 135], [225, 150, 113, 90]],
];

test("purchase allowances match the published table", () => {
  const spreads = ["one", "three", "dual", "celtic"];
  const modes = [[false, false], [true, false], [false, true], [true, true]];
  const differences = [];
  COUNT_PACKAGES.forEach((pkg, index) => {
    modes.forEach(([saju, ziwei], mode) => {
      spreads.forEach((spread, column) => {
        const actual = countAllowance(pkg.basis, spread, saju, ziwei);
        const listed = expected[index][mode][column];
        if (actual !== listed) differences.push(`${pkg.name} ${spread} mode ${mode}: ${actual} vs ${listed}`);
      });
    });
  });
  assert.deepEqual(differences, []);
});

test("combo-locked allowance table matches the same published numbers", () => {
  const spreads = ["one", "three", "dual", "celtic"];
  const differences = [];
  COUNT_PACKAGES.forEach((pkg, index) => {
    (Object.keys(COMBOS)).forEach((combo) => {
      const { saju, ziwei } = COMBOS[combo];
      const mode = saju && ziwei ? 3 : saju ? 1 : ziwei ? 2 : 0;
      spreads.forEach((spread, column) => {
        const actual = countAllowanceForCombo(pkg.basis, spread, combo);
        const listed = expected[index][mode][column];
        if (actual !== listed) differences.push(`${pkg.name} ${combo} ${spread}: ${actual} vs ${listed}`);
      });
    });
  });
  assert.deepEqual(differences, []);
  assert.equal(comboKeyFor(false, false), "tarot");
  assert.equal(comboKeyFor(true, false), "tarot-saju");
  assert.equal(comboKeyFor(false, true), "tarot-ziwei");
  assert.equal(comboKeyFor(true, true), "tarot-saju-ziwei");
});

test("every advertised last use is available, including rounded counts (combo:any)", () => {
  for (const pkg of COUNT_PACKAGES) {
    const allowances = countAllowances(pkg.basis);
    for (const [key, allowance] of Object.entries(allowances)) {
      const [spread, saju, ziwei] = key.split("-");
      const pass = { basis: pkg.basis, remaining: 1, expiresAt: "2099-01-01", combo: "any", status: "unused", allowances };
      for (let used = 0; used < allowance; used++) {
        assert.ok(availableCount(pass, spread, saju === "1", ziwei === "1") > 0, `${pkg.name}: ${key} use ${used + 1}`);
        pass.remaining = remainingAfterUse(pass, spread, saju === "1", ziwei === "1");
      }
      assert.equal(availableCount(pass, spread, saju === "1", ziwei === "1"), 0);
    }
  }
});

test("switching options recalculates the same remaining entitlement (combo:any)", () => {
  const basis = COUNT_PACKAGES[1].basis;
  const pass = { basis, remaining: 1, expiresAt: "2099-01-01", combo: "any", status: "unused", allowances: countAllowances(basis) };
  assert.equal(availableCount(pass, "one", false, false), 21);
  assert.equal(availableCount(pass, "one", true, true), 11);
  pass.remaining = remainingAfterUse(pass, "one", true, true);
  assert.equal(availableCount(pass, "one", true, true), 10);
  assert.equal(availableCount(pass, "one", false, false), 19);
  assert.equal(availableCount({ ...pass, expiresAt: "2020-01-01" }, "one", false, false), 0);
});

test("a fractional remainder with no usable question is exhausted (combo:any)", () => {
  const basis = 3000;
  const pass = { basis, remaining: 0.05, expiresAt: "2099-01-01", combo: "any", status: "unused", allowances: countAllowances(basis) };
  assert.equal(availableCount(pass, "celtic", true, true), 0);
  assert.equal(remainingAfterUse(pass, "one", false, false), 0);
});

test("cashback is converted to rounded one-card passes", () => {
  // 원카드 단가 300원 기준(2026-09-24 개정). 27,000원 → 90회, 5,000원 → 16.67 → 17회.
  assert.equal(rewardPassesForWon(540_000, 0.05), 90);
  assert.equal(rewardPassesForWon(100_000, 0.05), 17);
  assert.equal(rewardPassesForWon(30_000, 0.01), 1);
});

test("free rewards do not inherit the published table's hand-tuned cells", () => {
  // 공표표는 스타터(basis 3000) 켈틱+자미두수를 2회로 깎아뒀지만, 같은 basis 를 우연히 갖게 된
  // 무료 리워드는 계산식 그대로 3회여야 한다(round(3000/750) = 4 → 4 × 0.75 = 3).
  assert.equal(countAllowances(3_000, false)["celtic-0-1"], 3);
  assert.equal(countAllowances(3_000, true)["celtic-0-1"], 2);
});

test("signup pass guarantees four uses regardless of spread or options", () => {
  const allowances = signupFreePassAllowances();
  const pass = { basis: SIGNUP_FREE_PASS_BASIS, remaining: 1, combo: "any", status: "unused", allowances };
  for (const allowance of Object.values(allowances)) assert.equal(allowance, SIGNUP_FREE_PASSES);

  for (let used = 0; used < SIGNUP_FREE_PASSES; used++) {
    assert.equal(availableCount(pass, "celtic", true, true), SIGNUP_FREE_PASSES - used);
    pass.remaining = remainingAfterUse(pass, "celtic", true, true);
  }
  assert.equal(availableCount(pass, "one", false, false), 0);
});

test("a combo-locked pass only matches its exact locked combo", () => {
  const basis = 2_000;
  const pass = {
    basis,
    remaining: 1,
    combo: "tarot",
    status: "unused",
    allowances: countAllowancesForCombo(basis, "tarot"),
  };
  assert.ok(availableCount(pass, "one", false, false) > 0);
  assert.equal(availableCount(pass, "one", true, false), 0);
  assert.equal(availableCount(pass, "one", false, true), 0);
  assert.equal(availableCount(pass, "one", true, true), 0);

  const comboPass = {
    basis,
    remaining: 1,
    combo: "tarot-saju-ziwei",
    status: "unused",
    allowances: countAllowancesForCombo(basis, "tarot-saju-ziwei"),
  };
  assert.equal(availableCount(comboPass, "one", false, false), 0);
  assert.ok(availableCount(comboPass, "one", true, true) > 0);
});

test("exhausted or expired status blocks availability regardless of remaining", () => {
  const basis = 2_000;
  const base = { basis, remaining: 5, combo: "tarot", allowances: countAllowancesForCombo(basis, "tarot") };
  assert.equal(availableCount({ ...base, status: "exhausted" }, "one", false, false), 0);
  assert.equal(availableCount({ ...base, status: "expired" }, "one", false, false), 0);
  assert.ok(availableCount({ ...base, status: "unused" }, "one", false, false) > 0);
  assert.ok(availableCount({ ...base, status: "active" }, "one", false, false) > 0);
});
