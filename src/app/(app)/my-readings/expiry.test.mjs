import test from "node:test";
import assert from "node:assert/strict";
import { expiryLabel, expiryBadgeText } from "@/app/(app)/my-readings/expiry";
import { STORAGE_NOTICE } from "@/app/(app)/my-readings/storageNotice";
import { SAJU_REPORT_RETENTION_DAYS } from "@/lib/legal/retention";

// 2026-09-26 신설. 보관함 배지의 **남은 시간 계산**을 고정한다. 경계가 애매한 자리다 —
// 29일 23시간이 D-29 인가 D-30 인가, 1시간 미만은 무엇으로 말하는가, 만료 직후는.
//
// 규칙 하나로 정리된다: **전부 내림 — 남은 시간을 실제보다 많게 말하지 않는다.** 예외는
// 마지막 1분 미만뿐이고, 거기서 `0m` 이라고 하면 "이미 없다"는 거짓이 되므로 `1m` 으로 받친다.
//
// (2026-09-26 사용자 결정으로 「환불됨」·「만들어지는 중」·「N장까지 읽음」 배지는 없어졌다.
//  환불·만료된 건은 API 가 목록에서 빼므로 화면에 올 상태가 카운트다운 하나뿐이다.)

const now = new Date("2026-09-26T12:00:00.000Z");
const after = (ms) => new Date(now.getTime() + ms).toISOString();
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

test("하루 이상 남으면 D-n 이다", () => {
  assert.equal(expiryLabel(after(30 * DAY), now), "D-30");
  assert.equal(expiryLabel(after(29 * DAY), now), "D-29");
  assert.equal(expiryLabel(after(DAY), now), "D-1");
});

test("29일 23시간은 D-29 다 — 올려 말하지 않는다", () => {
  // 내림이 아니면 여기서 D-30 이 되어 하루를 더 있는 것처럼 말하게 된다.
  assert.equal(expiryLabel(after(29 * DAY + 23 * HOUR + 59 * MIN), now), "D-29");
  assert.equal(expiryLabel(after(DAY + 1), now), "D-1");
});

test("하루 미만은 시간, 한 시간 미만은 분이다", () => {
  assert.equal(expiryLabel(after(DAY - 1), now), "23h");
  assert.equal(expiryLabel(after(23 * HOUR + 59 * MIN), now), "23h");
  assert.equal(expiryLabel(after(14 * HOUR), now), "14h");
  assert.equal(expiryLabel(after(HOUR), now), "1h");
  assert.equal(expiryLabel(after(HOUR - 1), now), "59m");
  assert.equal(expiryLabel(after(9 * MIN), now), "9m");
});

test("1분 미만은 0m 이 아니라 1m 이다", () => {
  // 아직 목록에 떠 있다는 건 아직 안 사라졌다는 뜻이다. `0m` 은 그 말과 어긋난다.
  assert.equal(expiryLabel(after(59_000), now), "1m");
  assert.equal(expiryLabel(after(1), now), "1m");
});

test("만료됐거나 값이 없으면 배지를 그리지 않는다", () => {
  // 만료된 건은 API 가 빼므로 보통은 여기 오지 않는다. 시계가 어긋나거나 목록을 열어 둔 채
  // 시간이 지날 수는 있어서 null 로 받는다.
  assert.equal(expiryLabel(after(0), now), null);
  assert.equal(expiryLabel(after(-1), now), null);
  assert.equal(expiryLabel(after(-DAY), now), null);
  for (const missing of [null, undefined, ""]) {
    assert.equal(expiryLabel(missing, now), null, `${missing} 에서 배지가 생겼다`);
  }
  // 서버가 이상한 문자열을 주더라도 "NaN" 같은 걸 화면에 찍지 않는다.
  assert.equal(expiryLabel("not-a-date", now), null);
});

test("배지 문구는 목업 그대로 「보관만료」 + 값이다", () => {
  assert.equal(expiryBadgeText(after(29 * DAY), now), "보관만료 D-29");
  assert.equal(expiryBadgeText(after(14 * HOUR), now), "보관만료 14h");
  assert.equal(expiryBadgeText(after(9 * MIN), now), "보관만료 9m");
  assert.equal(expiryBadgeText(null, now), null);
});

test("하단 안내는 결제 화면의 환불 안내에서 그대로 온다", () => {
  // **문장을 여기 다시 적지 않는다.** 정본은 `refundNotice.ts` 의 `STORAGE_NOTICE` 하나뿐이고,
  // 여기 리터럴을 박으면 그게 두 번째 정본이 되어 문구를 고칠 때마다 이 파일도 따라 고쳐야
  // 한다(실제로 2026-09-26 문구 교정 때 이 테스트가 그래서 깨졌다).
  //
  // 대신 **연결이 살아 있는지**만 본다 — 두 줄이 오는가, 비어 있지 않은가, 보관 일수가 글자로
  // 들어 있는가. 셋 다 문구를 다듬어도 유지돼야 하는 것들이고, 재export 가 끊기면 즉시 깨진다.
  assert.equal(STORAGE_NOTICE.length, 2, "보관 안내 두 줄이 오지 않았다");
  for (const line of STORAGE_NOTICE) {
    assert.equal(typeof line, "string");
    assert.ok(line.trim().length > 0, "빈 줄이 왔다");
    assert.ok(
      line.includes(`${SAJU_REPORT_RETENTION_DAYS}일`),
      `보관 일수가 빠졌다: ${line}`
    );
  }
});
