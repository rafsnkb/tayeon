import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNT_PACKAGES,
  COMBOS,
  countAllowance,
  countAllowances,
  countAllowanceForCombo,
  countAllowancesForCombo,
  rewardAllowanceForCombo,
  rewardAllowancesForCombo,
  SPREADS,
  PAYMENT_BONUS_REWARD_TIERS,
  REFERRAL_MONTHLY_MIN_WON,
  basisForOneCardCount,
  isHeldPass,
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

// 리워드 basis 는 원카드 단가의 배수라, 상품 basis 중 3,000(스타터)과 135,000(얼티밋) 두 곳에
// 정확히 겹친다. 그 두 지점만 공표표로 빠지면 리워드를 더 받았는데 쓸 수 있는 횟수가 줄어드는
// 역전이 생긴다 — 무상 지급은 금액과 무관하게 제 규칙만 쓴다(2026-09-24).
test("a reward never falls through to the purchase table, even at a colliding basis", () => {
  assert.equal(countAllowanceForCombo(3_000, "one", "tarot-ziwei"), 8); // 공표표(구매분)
  assert.equal(rewardAllowanceForCombo(3_000, "one", "tarot-ziwei"), 7); // 무상 지급
});

test("a bigger reward is never worth fewer uses than a smaller one", () => {
  for (const combo of Object.keys(COMBOS)) {
    for (const spread of Object.keys(SPREADS)) {
      let previous = 0;
      for (let passes = 1; passes <= 500; passes++) {
        const count = rewardAllowanceForCombo(passes * SPREADS.one.cost, spread, combo);
        assert.ok(count >= previous, `${combo}/${spread} ${passes}회분에서 ${previous} → ${count} 로 줄었다`);
        previous = count;
      }
    }
  }
});

// 같은 스프레드인데 비싼 조합이 싼 조합과 횟수가 같으면 조합을 나눈 의미가 없고, 같은 조합인데
// 카드가 많은 쪽이 적은 쪽과 같아도 마찬가지다. 버림만으로는 동률이 남아서 따로 강제한다.
test("a costlier combo or spread always buys strictly fewer uses", () => {
  const combos = ["tarot", "tarot-saju", "tarot-ziwei", "tarot-saju-ziwei"];
  const spreads = ["one", "three", "dual", "celtic"];
  for (let passes = 1; passes <= 500; passes++) {
    const basis = passes * SPREADS.one.cost;
    const grid = combos.map((combo) => spreads.map((spread) => rewardAllowanceForCombo(basis, spread, combo)));
    for (let c = 0; c < combos.length; c++) {
      for (let s = 0; s < spreads.length; s++) {
        // 0 은 바닥이다 — 더 내려갈 곳이 없으니 동률을 허용한다.
        if (s > 0 && grid[c][s] > 0) assert.ok(grid[c][s] < grid[c][s - 1], `${passes}회분 ${combos[c]} ${spreads[s]}`);
        if (c > 0 && grid[c][s] > 0) assert.ok(grid[c][s] < grid[c - 1][s], `${passes}회분 ${combos[c]} ${spreads[s]}`);
      }
    }
  }
});

// 반올림이 두 번 겹치면 작은 리워드가 제 가치의 몇 배까지 나갔다(최대 3.98배, 2026-09-24).
test("a reward is never worth more than the money behind it", () => {
  for (const [combo, { saju, ziwei }] of Object.entries(COMBOS)) {
    const multiplier = saju && ziwei ? 0.5 : saju ? 0.85 : ziwei ? 0.75 : 1;
    for (const [spread, { cost }] of Object.entries(SPREADS)) {
      for (let passes = 1; passes <= 500; passes++) {
        const basis = passes * SPREADS.one.cost;
        const worth = rewardAllowanceForCombo(basis, spread, combo) * (cost / multiplier);
        assert.ok(worth <= basis, `${combo}/${spread} ${passes}회분: ${worth}원어치가 ${basis}원을 넘는다`);
      }
    }
  }
});

test("the agreed reward tables come out exactly", () => {
  // 2026-09-24 사용자 확정. 보너스 5만원 상당(basis 900)과 12만원 상당(basis 3,600).
  assert.deepEqual(rewardAllowancesForCombo(900, "tarot"), { one: 3, three: 2, dual: 1, celtic: 0 });
  assert.deepEqual(rewardAllowancesForCombo(900, "tarot-saju"), { one: 2, three: 1, dual: 0, celtic: 0 });
  assert.deepEqual(rewardAllowancesForCombo(900, "tarot-ziwei"), { one: 1, three: 0, dual: 0, celtic: 0 });
  assert.deepEqual(rewardAllowancesForCombo(900, "tarot-saju-ziwei"), { one: 0, three: 0, dual: 0, celtic: 0 });
  assert.deepEqual(rewardAllowancesForCombo(3_600, "tarot"), { one: 12, three: 8, dual: 6, celtic: 4 });
  assert.deepEqual(rewardAllowancesForCombo(3_600, "tarot-saju"), { one: 10, three: 6, dual: 5, celtic: 3 });
  assert.deepEqual(rewardAllowancesForCombo(3_600, "tarot-ziwei"), { one: 9, three: 5, dual: 4, celtic: 2 });
  assert.deepEqual(rewardAllowancesForCombo(3_600, "tarot-saju-ziwei"), { one: 6, three: 4, dual: 3, celtic: 1 });
});

// 두 리워드의 진입선이 다르면 안내가 두 배로 복잡해진다. 한쪽만 고치는 걸 막는다.
test("both rewards start at the same amount", () => {
  const lowestTier = PAYMENT_BONUS_REWARD_TIERS.at(-1);
  assert.equal(lowestTier.minWon, REFERRAL_MONTHLY_MIN_WON);
  assert.equal(REFERRAL_MONTHLY_MIN_WON, 100_000);
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

// basisForOneCardCount — "이 조합으로 정확히 N회"라는 약속을 basis 로 되돌리는 역산.
// 생일 쿠폰(8/6/4회)과 어드민 커스텀 지급이 광고한 횟수를 그대로 주는지가 여기 달려 있다.
// 예전엔 N × 200(나중엔 N × 300)을 basis 로 썼는데, 조합 배율이 한 번 더 곱해져서 광고의 절반만
// 나갔다. 되돌린 basis 는 무상 지급 규칙(rewardAllowance*)으로 읽어야 한다 — 생일 쿠폰도 어드민
// 커스텀 지급도 구매가 아니라 공짜로 주는 것이라 공표표를 타지 않는다(2026-09-24).
test("a promised count is delivered exactly, whatever the combo", () => {
  for (const combo of Object.keys(COMBOS)) {
    for (let promised = 1; promised <= 60; promised++) {
      const basis = basisForOneCardCount(promised, combo);
      assert.equal(
        rewardAllowanceForCombo(basis, "one", combo),
        promised,
        `${combo} ${promised}회 → basis ${basis}`
      );
    }
  }
});

test("the birthday coupon's advertised counts survive the round trip", () => {
  // functions/src/index.ts 의 BIRTHDAY_COUPON_OPTIONS 와 같은 표.
  for (const [combo, freePasses] of [
    ["tarot-saju", 8],
    ["tarot-ziwei", 6],
    ["tarot-saju-ziwei", 4],
  ]) {
    const basis = basisForOneCardCount(freePasses, combo);
    assert.equal(rewardAllowanceForCombo(basis, "one", combo), freePasses);
    // 단가를 그대로 곱하던 옛 계산은 약속보다 적게 준다 — 회귀하면 여기서 걸린다.
    assert.notEqual(rewardAllowanceForCombo(freePasses * 300, "one", combo), freePasses);
  }
});

test("a nonsensical promised count yields no entitlement rather than NaN", () => {
  for (const bad of [0, -3, NaN, Infinity]) {
    assert.equal(basisForOneCardCount(bad, "tarot"), 0);
  }
});

// isHeldPass — 재구매를 막아야 하는 "아직 들고 있는" 이용권인가.
// 만료된 이용권에 status:"expired" 를 써 주는 코드가 아무 데도 없어서, 상태만 보면
// 만료분 하나가 재구매를 영구히 막았다(화면은 "보유 없음"인데 구매는 409).
const NOW = Date.parse("2026-09-24T00:00:00.000Z");
const ago = (days) => new Date(NOW - days * 86400000).toISOString();
const ahead = (days) => new Date(NOW + days * 86400000).toISOString();

test("an unexpired pass in a holding status blocks re-purchase", () => {
  for (const status of ["unused", "active", "refund_pending"]) {
    assert.equal(isHeldPass({ status, expiresAt: ahead(30) }, NOW), true, status);
  }
  assert.equal(isHeldPass({ status: "unused", expiresAt: null }, NOW), true, "기간 없는 이용권");
});

test("a finished pass never blocks re-purchase", () => {
  for (const status of ["exhausted", "expired", "refunded", "revoked"]) {
    assert.equal(isHeldPass({ status, expiresAt: ahead(30) }, NOW), false, status);
  }
});

test("an expired pass stops blocking re-purchase even though its status was never updated", () => {
  assert.equal(isHeldPass({ status: "unused", expiresAt: ago(1) }, NOW), false, "횟수제 expiresAt");
  assert.equal(isHeldPass({ status: "active", usableUntil: ago(1) }, NOW), false, "시간제 usableUntil");
  assert.equal(isHeldPass({ status: "unused", expiresAt: NOW ? ago(0) : null }, NOW), false, "정확히 만료 시점");
});

test("a refund still in flight keeps blocking even past its expiry", () => {
  // 돈이 아직 정리되지 않았고, 거절되면 되살아난다.
  assert.equal(isHeldPass({ status: "refund_pending", expiresAt: ago(1) }, NOW), true);
});

test("a garbled expiry is treated as no expiry rather than as expired", () => {
  assert.equal(isHeldPass({ status: "unused", expiresAt: "언젠가" }, NOW), true);
  assert.equal(isHeldPass({ status: undefined }, NOW), false);
});
