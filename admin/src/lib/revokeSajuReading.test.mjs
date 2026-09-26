import test from "node:test";
import assert from "node:assert/strict";
import { revokeSajuReading } from "./revokeSajuReading.ts";

// 2026-09-26 신설. 이 창구 호출의 실패는 **조용한 실패**다 — 환불은 끝났는데 리포트가 계속
// 읽히는 상태로 남고, 아무 화면에도 그 흔적이 없다. 그래서 "무엇을 실패로 보는가"를 여기서
// 고정한다. 특히 `locked: false` 를 실패로 취급하면 타로 환불마다 urgent 가 울리고, 그러면
// 호출부가 알림을 무시하게 되고 정작 진짜 실패가 묻힌다.

function withEnv(env, run) {
  const saved = { TAYEON_BASE_URL: process.env.TAYEON_BASE_URL, INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET };
  const savedFetch = globalThis.fetch;
  Object.assign(process.env, env);
  return (async () => {
    try {
      return await run();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      globalThis.fetch = savedFetch;
    }
  })();
}

const ENV = { TAYEON_BASE_URL: "https://tayeon.example/", INTERNAL_API_SECRET: "s3cret" };

const respond = (status, body) => {
  globalThis.fetch = async (url, init) => {
    globalThis.fetch.calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body ?? ""),
    };
  };
  globalThis.fetch.calls = [];
};

test("잠금에 성공하면 ok 와 readingId 를 돌려준다", async () => {
  await withEnv(ENV, async () => {
    respond(200, { ok: true, locked: true, readingId: "r-1" });
    const result = await revokeSajuReading("u-1", "pay-1", "운영자 환불");
    assert.deepEqual(result, { ok: true, locked: true, readingId: "r-1" });

    // 창구 계약: 공유 시크릿 헤더 + { uid, paymentId, reason }. 끝의 슬래시는 중복되지 않는다.
    const [call] = globalThis.fetch.calls;
    assert.equal(call.url, "https://tayeon.example/api/internal/saju/revoke");
    assert.equal(call.init.headers["x-internal-secret"], "s3cret");
    assert.deepEqual(JSON.parse(call.init.body), { uid: "u-1", paymentId: "pay-1", reason: "운영자 환불" });
  });
});

test("locked:false 는 실패가 아니다 — 사주 주문이 아니거나 아직 열지 않은 건이다", async () => {
  await withEnv(ENV, async () => {
    respond(200, { ok: true, locked: false, readingId: null });
    const result = await revokeSajuReading("u-1", "pay-tarot");
    // ok 가 true 여야 호출부가 urgent 를 띄우지 않는다. 그게 이 테스트의 요점이다.
    assert.equal(result.ok, true);
    assert.equal(result.locked, false);
    assert.equal(result.readingId, null);
    // reason 을 안 넘기면 바디에도 넣지 않는다(창구가 기본값을 쓴다).
    assert.deepEqual(JSON.parse(globalThis.fetch.calls[0].init.body), { uid: "u-1", paymentId: "pay-tarot" });
  });
});

test("HTTP 실패는 ok:false — 호출부가 여기서만 urgent 를 띄운다", async () => {
  await withEnv(ENV, async () => {
    respond(503, { error: "not_configured" });
    const result = await revokeSajuReading("u-1", "pay-1");
    assert.equal(result.ok, false);
    assert.match(result.reason, /503/);
  });
});

test("네트워크가 끊겨도 던지지 않는다 — 환불 트랜잭션을 되돌릴 수는 없다", async () => {
  await withEnv(ENV, async () => {
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const result = await revokeSajuReading("u-1", "pay-1");
    assert.equal(result.ok, false);
    assert.match(result.reason, /ECONNREFUSED/);
  });
});

test("환경변수가 없으면 부르지 않고 실패로 알린다 — 조용히 넘기면 리포트가 안 잠긴다", async () => {
  await withEnv({ TAYEON_BASE_URL: "", INTERNAL_API_SECRET: "" }, async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      throw new Error("불려서는 안 된다");
    };
    const result = await revokeSajuReading("u-1", "pay-1");
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });
});

test("응답이 깨져 있으면 잠기지 않은 것으로 읽는다", async () => {
  await withEnv(ENV, async () => {
    respond(200, null);
    const result = await revokeSajuReading("u-1", "pay-1");
    // HTTP 는 성공했으니 urgent 대상은 아니지만, locked 를 함부로 true 로 보지 않는다.
    assert.deepEqual(result, { ok: true, locked: false, readingId: null });
  });
});
