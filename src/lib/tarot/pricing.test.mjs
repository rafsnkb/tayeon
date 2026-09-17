import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNT_PACKAGES,
  countAllowance,
  countAllowances,
  availableCount,
  remainingAfterUse,
  rewardPassesForWon,
  SIGNUP_FREE_PASS_BASIS,
  SIGNUP_FREE_PASSES,
  signupFreePassAllowances,
} from "./pricing.ts";

const expected = [
  [[15, 10, 8, 6], [13, 9, 7, 5], [11, 8, 6, 4], [8, 5, 4, 3]],
  [[31, 21, 16, 12], [26, 18, 14, 10], [23, 16, 12, 9], [16, 11, 8, 6]],
  [[70, 47, 35, 28], [60, 40, 30, 24], [53, 35, 26, 21], [35, 24, 18, 14]],
  [[200, 133, 100, 80], [170, 113, 85, 68], [150, 100, 75, 60], [100, 67, 50, 40]],
  [[325, 217, 163, 130], [276, 184, 139, 111], [244, 163, 122, 98], [163, 109, 82, 65]],
  [[675, 450, 338, 270], [574, 383, 287, 230], [506, 338, 254, 203], [338, 225, 169, 135]],
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

test("every advertised last use is available, including rounded counts", () => {
  for (const pkg of COUNT_PACKAGES) {
    const allowances = countAllowances(pkg.basis);
    for (const [key, allowance] of Object.entries(allowances)) {
      const [spread, saju, ziwei] = key.split("-");
      const pass = { basis: pkg.basis, remaining: 1, expiresAt: "2099-01-01", allowances };
      for (let used = 0; used < allowance; used++) {
        assert.ok(availableCount(pass, spread, saju === "1", ziwei === "1") > 0, `${pkg.name}: ${key} use ${used + 1}`);
        pass.remaining = remainingAfterUse(pass, spread, saju === "1", ziwei === "1");
      }
      assert.equal(availableCount(pass, spread, saju === "1", ziwei === "1"), 0);
    }
  }
});

test("switching options recalculates the same remaining entitlement", () => {
  const basis = COUNT_PACKAGES[1].basis;
  const pass = { basis, remaining: 1, expiresAt: "2099-01-01", allowances: countAllowances(basis) };
  assert.equal(availableCount(pass, "one", false, false), 31);
  assert.equal(availableCount(pass, "one", true, true), 16);
  pass.remaining = remainingAfterUse(pass, "one", true, true);
  assert.equal(availableCount(pass, "one", true, true), 15);
  assert.equal(availableCount(pass, "one", false, false), 29);
  assert.equal(availableCount({ ...pass, expiresAt: "2020-01-01" }, "one", false, false), 0);
});

test("a fractional remainder with no usable question is exhausted", () => {
  const basis = 3000;
  const pass = { basis, remaining: 0.05, expiresAt: "2099-01-01", allowances: countAllowances(basis) };
  assert.equal(availableCount(pass, "celtic", true, true), 0);
  assert.equal(remainingAfterUse(pass, "one", false, false), 0);
});

test("cashback is converted to rounded one-card passes", () => {
  assert.equal(rewardPassesForWon(540_000, 0.05), 135);
  assert.equal(rewardPassesForWon(100_000, 0.05), 25);
  assert.equal(rewardPassesForWon(30_000, 0.01), 2);
});

test("free rewards do not inherit a paid-package display exception", () => {
  assert.equal(countAllowances(3_000, false)["celtic-0-1"], 5);
});

test("signup pass guarantees four uses regardless of spread or options", () => {
  const allowances = signupFreePassAllowances();
  const pass = { basis: SIGNUP_FREE_PASS_BASIS, remaining: 1, allowances };
  for (const allowance of Object.values(allowances)) assert.equal(allowance, SIGNUP_FREE_PASSES);

  for (let used = 0; used < SIGNUP_FREE_PASSES; used++) {
    assert.equal(availableCount(pass, "celtic", true, true), SIGNUP_FREE_PASSES - used);
    pass.remaining = remainingAfterUse(pass, "celtic", true, true);
  }
  assert.equal(availableCount(pass, "one", false, false), 0);
});

test("tarot-only admin passes cannot be used with add-on features", () => {
  const pass = {
    basis: 2_000,
    remaining: 1,
    featureScope: "tarot-only",
    allowances: Object.fromEntries(
      ["one", "three", "dual", "celtic"].flatMap((spread) =>
        ["0", "1"].flatMap((saju) => ["0", "1"].map((ziwei) => [`${spread}-${saju}-${ziwei}`, 10]))
      )
    ),
  };
  assert.equal(availableCount(pass, "one", false, false), 10);
  assert.equal(availableCount(pass, "one", true, false), 0);
  assert.equal(availableCount(pass, "one", false, true), 0);
  assert.equal(availableCount(pass, "one", false, false, true), 0);
});
