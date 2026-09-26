// 뷰어 오케스트레이션의 계약. **여기서 지키는 건 대부분 돈이다.**
//
// `POST` 는 모델을 부른다(섹션 약 20원, 이미지 8원). 중복 요청은 그대로 중복 과금인데, 그 실패는
// 화면에 에러로 뜨지 않는다 — 사용자에게는 "가끔 좀 느림"으로만 보이고 로그를 봐야 드러난다.
// 그래서 "POST 가 몇 번 나갔는가"를 세는 테스트가 이 파일의 절반이다.
//
// 코어가 React 밖에 있는 이유가 이것이다(`sajuReaderCore.ts` 머리말). 저장소에 React 렌더러가
// 없어서, 논리가 훅 안에 있으면 이 파일을 쓸 수 없다.
import test from "node:test";
import assert from "node:assert/strict";
import { createSajuReaderCore } from "./sajuReaderCore.ts";

/** 섹션 한 장의 본문. 내용은 이 테스트가 보지 않으므로 최소만 채운다. */
function sectionPage(pageNumber) {
  return {
    kind: "section",
    pageNumber,
    createdAt: "2026-09-26T00:00:00.000Z",
    id: `s${pageNumber}`,
    title: `${pageNumber}장`,
    summary: "요약이에요.",
    sajuBasis: "",
    ziweiBasis: "",
    crossStatus: null,
    crossSummary: "",
    actionGuide: "",
  };
}

function failedPage(pageNumber, attempts = 3) {
  return { kind: "failed", pageNumber, createdAt: "2026-09-26T00:00:00.000Z", attempts };
}

const CLOSING = { title: "총평", body: "결론이에요.", nextSteps: ["하나", "둘"] };

const ANSWER = {
  summary: "답이에요.",
  sajuBasis: "",
  ziweiBasis: "",
  directAnswer: "다시 답을 드리면…",
  closingNote: "마무리예요.",
  sajuRefs: [],
  ziweiRefs: [],
  needsRedirect: false,
};

/**
 * 가짜 서버. 실제 라우트의 계약을 그대로 흉내낸다 — 순서 게이트(N 은 N-1 이 있어야 한다),
 * `sections_incomplete` 의 `missing` 번호 배열, 이미지 GET 의 404.
 *
 * `routes` 로 특정 경로만 덮어써서 오류 경로를 시험한다.
 */
function makeServer(options = {}) {
  const {
    sectionCount = 3,
    hasImage = false,
    initialPages = [],
    initialClosing = null,
    initialImage = null,
    lastReadPage = 0,
    status = "generating",
    userInput = "",
    initialAnswer = null,
    // 먼 미래 — 기본값은 "안 지났다"다. 만료 테스트만 과거 시각을 넣는다.
    routes = {},
  } = options;

  const stored = new Map(initialPages.map((p) => [p.pageNumber, p]));
  let closing = initialClosing;
  let image = initialImage;
  let answer = initialAnswer;
  const calls = [];
  /**
   * **실제로 모델을 불러 만든 것**만 담는다. 돈은 여기서 나간다.
   *
   * POST 횟수를 세는 것으로는 과금을 알 수 없다 — 순서 게이트에 걸린 409 는 모델을 부르기 전에
   * 돌아오므로 공짜다(`producePage` 가 `rejected` 를 먼저 반환한다). 그래서 회복 경로는 정상
   * 동작에서도 같은 번호에 POST 를 두 번 보낸다(409 한 번, 성공 한 번). 세야 하는 건 생성이다.
   */
  const created = [];

  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });

  async function handle(path, method) {
    const override = routes[`${method} ${path}`] ?? routes[method];
    if (override) return override({ json, stored, calls, created });

    if (method === "GET" && path === "/api/saju/readings/r1") {
      return json(200, {
        id: "r1",
        productSlug: "single-love",
        mode: "integrated",
        status,
        createdAt: "2026-09-26T00:00:00.000Z",
        outline: Array.from({ length: sectionCount }, (_, i) => ({ title: `${i + 1}장`, gist: "요지" })),
        sectionCount,
        pages: [...stored.values()],
        closing,
        image,
        lastReadPage,
        userInput,
        userAnswer: answer,
        myReview: null,
      });
    }

    const pageMatch = path.match(/^\/api\/saju\/readings\/r1\/pages\/(\d+)$/);
    if (pageMatch && method === "POST") {
      const n = Number(pageMatch[1]);
      if (n > sectionCount) return json(400, { error: "out_of_range" });
      if (stored.has(n)) return json(200, { page: stored.get(n) });
      // 순서 게이트 — 실제 `pageGateReason` 과 같다.
      if (n > 1 && !stored.has(n - 1)) return json(409, { error: "missing_previous", missing: n - 1 });
      created.push(n);
      stored.set(n, sectionPage(n));
      return json(200, { page: stored.get(n) });
    }

    if (path === "/api/saju/readings/r1/answer" && method === "POST") {
      if (!userInput.trim()) return json(409, { error: "no_question" });
      if (answer) return json(200, { answer });
      const missing = Array.from({ length: sectionCount }, (_, i) => i + 1).filter((n) => !stored.has(n));
      if (missing.length) return json(409, { error: "sections_incomplete", missing });
      created.push("answer");
      answer = ANSWER;
      return json(200, { answer });
    }

    if (path === "/api/saju/readings/r1/closing" && method === "POST") {
      if (closing) return json(200, { closing });
      const missing = Array.from({ length: sectionCount }, (_, i) => i + 1).filter((n) => !stored.has(n));
      if (missing.length) return json(409, { error: "sections_incomplete", missing });
      created.push("closing");
      closing = CLOSING;
      return json(200, { closing });
    }

    if (path === "/api/saju/readings/r1/image") {
      if (method === "POST") {
        created.push("image");
        image = { url: "/api/saju/readings/r1/image", regeneratedCount: image ? image.regeneratedCount + 1 : 0 };
        return json(200, { image });
      }
      if (!image) return json(404, { error: "not_generated" });
      return { ok: true, status: 200, json: async () => ({}), blob: async () => "BYTES" };
    }

    if (path === "/api/saju/readings/r1/last-read" && method === "PATCH") {
      return json(200, { lastReadPage: 0 });
    }

    return json(404, { error: "not_found" });
  }

  const fetch = async (path, init = {}) => {
    const method = init.method ?? "GET";
    calls.push(`${method} ${path}`);
    return handle(path, method);
  };

  return {
    fetch,
    calls,
    created,
    get closing() {
      return closing;
    },
    get answer() {
      return answer;
    },
    get image() {
      return image;
    },
    stored,
    hasImage,
  };
}

function makeCore(server, options = {}) {
  const revoked = [];
  let urlSeq = 0;
  const core = createSajuReaderCore({
    readingId: "r1",
    fetch: server.fetch,
    productHasImage: () => Boolean(options.hasImage ?? server.hasImage),
    createObjectUrl: () => `blob:${++urlSeq}`,
    revokeObjectUrl: (url) => revoked.push(url),
  });
  return { core, revoked };
}

/** 코어가 띄운 백그라운드 작업이 전부 가라앉을 때까지 기다린다. 가짜 서버가 동기라서 마이크로
 *  태스크 몇 바퀴면 끝나지만, 회복 경로는 중첩이 깊어서 넉넉히 돈다. */
async function settle(rounds = 60) {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

const countOf = (calls, entry) => calls.filter((c) => c === entry).length;
const postsTo = (calls, path) => countOf(calls, `POST ${path}`);
/** 이 번호가 **실제로 생성된** 횟수. 과금 횟수와 같다. */
const madeCount = (created, key) => created.filter((c) => c === key).length;

// ─────────────────────────────────────────────────────────────────────────────
// 중복 과금 방지 — 이 파일의 핵심
// ─────────────────────────────────────────────────────────────────────────────

test("같은 페이지에 POST 가 두 번 나가지 않는다", async () => {
  // 목차에서 1번을 미리 당기고, 1번으로 이동하면 1·2 를 확보한다. 1번은 이미 받았으므로
  // 다시 POST 하지 않아야 한다 — 다시 보내면 20원이 그대로 새고 사용자는 알 수 없다.
  const server = makeServer({ sectionCount: 3 });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(1);
  await settle();

  assert.deepEqual(server.created, [1, 2]);
});

test("앞뒤로 오가도 이미 받은 페이지를 다시 만들지 않는다", async () => {
  const server = makeServer({ sectionCount: 3 });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  for (const i of [1, 2, 1, 2, 3, 2, 1]) {
    core.goTo(i);
    await settle(10);
  }
  await settle();

  // 마지막 섹션(3)에 들어서면 총평도 걸리므로 섹션 생성만 골라 센다.
  assert.deepEqual(
    server.created.filter((c) => typeof c === "number"),
    [1, 2, 3],
    "같은 섹션을 두 번 생성했다"
  );
});

test("회복 경로가 같은 앞 페이지를 두 번 만들지 않는다 (낡은 클로저 회귀)", async () => {
  // 이게 이번 작업에서 실제로 잡은 버그의 회귀 테스트다.
  //
  // 2번으로 이동하면 2와 3을 동시에 확보하려 한다. 저장된 게 없으니 둘 다 `missing_previous` 를
  // 받고, 2는 1을, 3은 2를 채우러 간다 — **3의 회복이 이미 날아간 2의 요청과 만난다.** 이때
  // 진행 중인 약속을 공유하지 않으면(예전 코드는 낡은 `pages` 를 보고 "없다"고 판단했다) 2번이
  // 두 번 생성된다. 20원 × 중복이고, 증상은 에러가 아니라 "좀 느림"이라 눈에 안 띈다.
  const server = makeServer({ sectionCount: 3, lastReadPage: 2 });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  for (const n of [1, 2, 3]) {
    assert.equal(madeCount(server.created, n), 1, `${n}번이 두 번 생성됐다 — 중복 과금이다`);
  }
  assert.equal(core.getSnapshot().page.kind, "section");
  assert.equal(core.getSnapshot().page.pageNumber, 2);
});

test("총평은 이미지 장에 들어설 때 딱 한 번 나간다", async () => {
  const server = makeServer({
    sectionCount: 2,
    hasImage: true,
    initialPages: [sectionPage(1), sectionPage(2)],
    initialImage: { url: "/api/saju/readings/r1/image", regeneratedCount: 0 },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  // 0=목차, 1·2=섹션, 3=이미지, 4=총평.
  assert.equal(core.getSnapshot().pageCount, 5);
  assert.equal(madeCount(server.created, "closing"), 0, "섹션 구간에서 벌써 걸렸다");

  core.goTo(3);
  await settle();
  assert.equal(madeCount(server.created, "closing"), 1);

  // 총평 장까지 가고 다시 돌아와도 더 부르지 않는다 — 이미 받았다.
  core.goTo(4);
  await settle();
  core.goTo(3);
  await settle();
  core.goTo(4);
  await settle();
  assert.equal(madeCount(server.created, "closing"), 1);
  assert.deepEqual(core.getSnapshot().page.closing, CLOSING);
});

test("이미지가 없는 상품은 마지막 섹션에서 총평을 건다", async () => {
  const server = makeServer({ sectionCount: 2, initialPages: [sectionPage(1), sectionPage(2)] });
  const { core } = makeCore(server, { hasImage: false });
  await core.load();
  await settle();

  // 0=목차, 1·2=섹션, 3=총평. 이미지 장이 없다.
  assert.equal(core.getSnapshot().pageCount, 4);
  assert.equal(core.getSnapshot().hasImagePage, false);

  core.goTo(1);
  await settle();
  assert.equal(madeCount(server.created, "closing"), 0);

  core.goTo(2);
  await settle();
  assert.equal(madeCount(server.created, "closing"), 1);
});

test("이미지가 이미 있으면 다시 그리지 않는다", async () => {
  // POST 는 부를 때마다 새로 그린다. 조건 없이 걸면 **방문마다 8원**이 나간다.
  const server = makeServer({
    sectionCount: 1,
    hasImage: true,
    initialPages: [sectionPage(1)],
    initialImage: { url: "/api/saju/readings/r1/image", regeneratedCount: 0 },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  assert.equal(madeCount(server.created, "image"), 0, "이미 있는 그림을 다시 그렸다 — 방문마다 8원이다");
  // 바이트는 읽어 온다(공짜).
  assert.ok(countOf(server.calls, "GET /api/saju/readings/r1/image") >= 1);
  assert.equal(core.getSnapshot().hasImagePage, true);
});

test("이미지가 없으면 열 때 딱 한 장 그린다", async () => {
  const server = makeServer({ sectionCount: 1, hasImage: true, initialPages: [sectionPage(1)] });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  assert.equal(madeCount(server.created, "image"), 1);

  // 장을 옮겨 다녀도 더 그리지 않는다.
  core.goTo(2);
  await settle();
  core.goTo(1);
  await settle();
  assert.equal(madeCount(server.created, "image"), 1);
});

test("다시 뽑기는 누른 만큼만 그리고 앞선 blob 주소를 놓아준다", async () => {
  const server = makeServer({
    sectionCount: 1,
    hasImage: true,
    initialPages: [sectionPage(1)],
    initialImage: { url: "/api/saju/readings/r1/image", regeneratedCount: 0 },
  });
  const { core, revoked } = makeCore(server);
  await core.load();
  await settle();
  const before = madeCount(server.created, "image");

  core.regenerateImage();
  await settle();
  assert.equal(madeCount(server.created, "image"), before + 1);
  // 앞서 만든 주소를 놓아주지 않으면 누를 때마다 샌다.
  assert.equal(revoked.length, 1);

  core.regenerateImage();
  await settle();
  assert.equal(madeCount(server.created, "image"), before + 2);
  assert.equal(revoked.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 끝난 실패 — 다시 시도를 권하지 않는다
// ─────────────────────────────────────────────────────────────────────────────

test("실패 자리표에는 재시도를 걸지 않는다", async () => {
  // §9: 이미 3회 시도했고 운영자 알림도 나갔다. 다시 눌러도 아무 일이 안 일어난다.
  const server = makeServer({ sectionCount: 3, initialPages: [sectionPage(1), failedPage(2)] });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(2);
  await settle();
  const page = core.getSnapshot().page;
  assert.equal(page.kind, "section-failed");
  assert.equal(page.attempts, 3);
  // 제목은 골격에서 온다 — 자리표에는 제목이 없다.
  assert.equal(page.title, "2장");

  const before = postsTo(server.calls, "/api/saju/readings/r1/pages/2");
  core.retryPage(2);
  await settle();
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/pages/2"), before);
});

test("자리표는 뒤 페이지를 막지 않는다", async () => {
  // 자리표가 존재하는 것 자체가 게이트를 풀어 주는 장치다(§9).
  const server = makeServer({ sectionCount: 3, initialPages: [sectionPage(1), failedPage(2)] });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(3);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "section");
  assert.equal(core.getSnapshot().page.pageNumber, 3);
});

test("product_gone 은 재시도 불가로 표시하고 다시 누를 수 없다", async () => {
  const server = makeServer({
    sectionCount: 2,
    routes: {
      "POST /api/saju/readings/r1/pages/1": ({ json }) => json(409, { error: "product_gone" }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(1);
  await settle();
  const page = core.getSnapshot().page;
  assert.equal(page.kind, "section-pending");
  assert.equal(page.error.retryable, false);

  const before = postsTo(server.calls, "/api/saju/readings/r1/pages/1");
  core.retryPage(1);
  await settle();
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/pages/1"), before, "끝난 실패에 다시 POST 했다");
});

test("환불된 리포트(reading_failed)도 재시도 불가다", async () => {
  const server = makeServer({
    sectionCount: 2,
    routes: {
      "POST /api/saju/readings/r1/pages/1": ({ json }) => json(409, { error: "reading_failed" }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(1);
  await settle();

  assert.equal(core.getSnapshot().page.error.retryable, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 만료(§11) — 화면 안내와 별개로 `drive()` 자체가 아무것도 만들면 안 된다
// ─────────────────────────────────────────────────────────────────────────────



test("환불된 리포트(status: failed)도 이미지 상품이면 열자마자 그려질 뻔한 걸 막는다", async () => {
  // §9 표대로라면 실패는 골격 이전이라 섹션이 없는 게 보통이지만, 그거야말로 이 테스트가 확인할
  // 값이다 — 섹션이 0이어도 `hasImagePage()` 는 **상품 정의**만 보므로 `runImage` 가 무조건
  // 걸릴 뻔했다(레지스트리 조회만으로 이미지 유무를 정하기 때문).
  const server = makeServer({ sectionCount: 0, hasImage: true, status: "failed" });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  assert.deepEqual(server.created, [], "환불된 건인데 이미지가 생성됐다 — 8원이 샜다");
});

test("일시적 실패는 재시도할 수 있고, 재시도하면 한 번만 더 보낸다", async () => {
  let fail = true;
  const server = makeServer({
    sectionCount: 2,
    routes: {
      "POST /api/saju/readings/r1/pages/1": ({ json, stored }) => {
        if (fail) return json(500, {});
        stored.set(1, sectionPage(1));
        return json(200, { page: stored.get(1) });
      },
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(1);
  await settle();

  assert.equal(core.getSnapshot().page.error.retryable, true);
  const before = postsTo(server.calls, "/api/saju/readings/r1/pages/1");

  fail = false;
  core.retryPage(1);
  await settle();
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/pages/1"), before + 1);
  assert.equal(core.getSnapshot().page.kind, "section");
});

// ─────────────────────────────────────────────────────────────────────────────
// 회복 경로의 상한 — 무한 POST 는 무한 과금이다
// ─────────────────────────────────────────────────────────────────────────────

test("missing_previous 가 끝없이 와도 상한에서 멈춘다", async () => {
  // 서버가 앞 페이지를 채워도 계속 `missing_previous` 를 돌려주는 상태. 상한이 없으면 POST 가
  // 무한히 나가고 그대로 과금이 샌다.
  const server = makeServer({
    sectionCount: 4,
    routes: {
      POST: ({ json }) => json(409, { error: "missing_previous", missing: 1 }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle(200);

  core.goTo(2);
  await settle(200);

  const total = server.calls.filter((c) => c.startsWith("POST /api/saju/readings/r1/pages/")).length;
  assert.ok(total > 0, "아무것도 시도하지 않았다");
  // 상한은 `sectionCount + 2` 바퀴 × 두 번호라 넉넉히 잡아도 이 수를 넘지 않는다.
  assert.ok(total < 40, `POST 가 ${total}번 나갔다 — 상한이 안 걸렸다`);
  assert.equal(core.getSnapshot().page.error.retryable, false);
});

test("missing 이 자기 번호로 오면 교착 없이 실패로 끝낸다", async () => {
  // 실제 게이트는 늘 `n-1` 을 주지만, 자기 번호가 오면 진행 중인 **자기 약속**을 기다려 영구
  // 교착이 된다. 화면이 조용히 멈추는 쪽이 에러를 보이는 쪽보다 나쁘다.
  const server = makeServer({
    sectionCount: 3,
    routes: {
      "POST /api/saju/readings/r1/pages/1": ({ json }) => json(409, { error: "missing_previous", missing: 1 }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(1);
  await settle();

  const page = core.getSnapshot().page;
  assert.equal(page.kind, "section-pending");
  assert.equal(page.error.retryable, false);
});

test("missing 이 뒤 번호로 오면 따라가지 않는다", async () => {
  // 두 번호가 서로를 가리키면 맞물려 멈춘다. 엄격히 감소할 때만 회복을 따라간다.
  const server = makeServer({
    sectionCount: 3,
    routes: {
      "POST /api/saju/readings/r1/pages/1": ({ json }) => json(409, { error: "missing_previous", missing: 2 }),
      "POST /api/saju/readings/r1/pages/2": ({ json }) => json(409, { error: "missing_previous", missing: 1 }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle(200);

  core.goTo(1);
  await settle(200);
  assert.equal(core.getSnapshot().page.kind, "section-pending");
  assert.equal(core.getSnapshot().page.error.retryable, false);
});

test("총평의 sections_incomplete 는 받은 번호만 채우고 다시 부른다", async () => {
  const server = makeServer({ sectionCount: 3, hasImage: true, initialPages: [sectionPage(1)] });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(4); // 이미지 장 = 3 + 1
  await settle(200);

  // 빠진 2·3 을 채우고 총평까지 받아야 한다. **개수에서 역산하지 않는다** — 서버가 번호를 준다.
  for (const n of [2, 3]) {
    assert.equal(madeCount(server.created, n), 1, `${n}번`);
  }
  assert.deepEqual(server.closing, CLOSING);
});

// ─────────────────────────────────────────────────────────────────────────────
// 그 외 계약
// ─────────────────────────────────────────────────────────────────────────────

test("last-read 가 실패해도 읽기를 막지 않는다", async () => {
  const server = makeServer({
    sectionCount: 2,
    routes: {
      PATCH: () => {
        throw new Error("network down");
      },
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(1);
  await settle();

  // 이동도 되고 본문도 받아진다. 위치 기록 실패는 삼킨다.
  assert.equal(core.getSnapshot().index, 1);
  assert.equal(core.getSnapshot().page.kind, "section");
});

test("이동할 때마다 last-read 를 보낸다", async () => {
  const server = makeServer({ sectionCount: 2 });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(1);
  await settle();
  core.goTo(2);
  await settle();

  assert.equal(countOf(server.calls, "PATCH /api/saju/readings/r1/last-read"), 2);
});

test("같은 장으로 다시 이동하면 아무것도 보내지 않는다", async () => {
  const server = makeServer({ sectionCount: 2 });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(1);
  await settle();
  const before = server.calls.length;

  core.goTo(1);
  await settle();
  assert.equal(server.calls.length, before);
});

test("읽던 자리에서 이어 열고, 장 수를 넘는 값은 마지막 장으로 붙인다", async () => {
  const server = makeServer({ sectionCount: 2, initialPages: [sectionPage(1), sectionPage(2)], lastReadPage: 99 });
  const { core } = makeCore(server, { hasImage: false });
  await core.load();
  await settle();

  // 0=목차, 1·2=섹션, 3=총평 → 마지막은 3.
  assert.equal(core.getSnapshot().index, 3);
  assert.equal(core.getSnapshot().page.kind, "closing");
});

test("목차는 0번이고 골격의 줄을 그대로 준다", async () => {
  const server = makeServer({ sectionCount: 2 });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  const page = core.getSnapshot().page;
  assert.equal(page.kind, "toc");
  assert.equal(page.index, 0);
  assert.equal(page.entries.length, 2);
  assert.equal(page.entries[0].title, "1장");
});

test("없는 리포트는 읽기 전용 오류로 끝난다", async () => {
  const server = makeServer({
    routes: { GET: ({ json }) => json(404, { error: "not_found" }) },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  assert.match(core.getSnapshot().loadError, /찾을 수 없어요/);
  assert.equal(core.getSnapshot().page, null);
  // 리포트를 못 읽었으면 생성도 시작하지 않아야 한다.
  assert.equal(server.calls.filter((c) => c.startsWith("POST")).length, 0);
});

test("dispose 뒤에는 blob 주소를 놓아주고 더 알리지 않는다", async () => {
  const server = makeServer({
    sectionCount: 1,
    hasImage: true,
    initialPages: [sectionPage(1)],
    initialImage: { url: "/api/saju/readings/r1/image", regeneratedCount: 0 },
  });
  const { core, revoked } = makeCore(server);
  await core.load();
  await settle();

  let notified = 0;
  core.subscribe(() => notified++);
  core.dispose();
  assert.equal(revoked.length, 1);

  core.goTo(1);
  await settle();
  assert.equal(notified, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 사연 답변 장 — 총평 앞에 한 장이 끼어든다
//
// **장 번호가 밀리는 변경이라 위험하다.** 여기가 틀리면 총평이 답변 자리에 그려지거나,
// 마지막 장에 닿을 수 없게 된다. 그래서 유무·위치·개수를 전부 못 박는다.
// ─────────────────────────────────────────────────────────────────────────────

test("사연이 없으면 답변 장 자체가 없다 — 장 수가 전과 같다", async () => {
  const server = makeServer({ sectionCount: 3 });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  // 목차 1 + 섹션 3 + 총평 1
  assert.equal(core.getSnapshot().pageCount, 5);
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/answer"), 0);
});

test("사연이 있으면 총평 바로 앞에 한 장이 는다", async () => {
  const server = makeServer({ sectionCount: 3, userInput: "둘째는 언제쯤이 좋을까요?" });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  assert.equal(core.getSnapshot().pageCount, 6);

  core.goTo(4);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "answer");

  core.goTo(5);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "closing");
});

test("이미지가 있으면 이미지 다음, 총평 앞이다", async () => {
  const server = makeServer({ sectionCount: 3, hasImage: true, userInput: "궁금해요" });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  // 목차 1 + 섹션 3 + 이미지 1 + 답변 1 + 총평 1
  assert.equal(core.getSnapshot().pageCount, 7);

  core.goTo(4);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "image");
  core.goTo(5);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "answer");
  core.goTo(6);
  await settle();
  assert.equal(core.getSnapshot().page.kind, "closing");
});

test("답변 장이 늘어나도 총평은 여전히 '마지막 바로 앞'에서 걸린다", async () => {
  // 총평 트리거를 `pageCount() - 2` 로 일반화한 것의 회귀 테스트다. 예전처럼
  // `hasImagePage() ? imageIndex() : sectionCount()` 로 두면 답변 장이 끼는 순간
  // 총평이 **한 장 일찍** 걸려서, 사용자가 답변 장을 열기도 전에 총평이 만들어진다.
  const server = makeServer({ sectionCount: 3, userInput: "궁금해요" });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(3); // 마지막 섹션 — 답변(4) 앞이라 답변만 걸린다
  await settle();
  assert.equal(madeCount(server.created, "answer"), 1);
  assert.equal(madeCount(server.created, "closing"), 0, "답변 장에 닿기도 전에 총평이 만들어졌다");

  core.goTo(4); // 답변 장 = pageCount - 2 → 여기서 총평을 건다
  await settle();
  assert.equal(madeCount(server.created, "closing"), 1);
});

test("답변은 딱 한 번만 만든다 — 앞뒤로 오가도 다시 안 부른다", async () => {
  const server = makeServer({ sectionCount: 3, userInput: "궁금해요" });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(3);
  await settle();
  core.goTo(4);
  await settle();
  core.goTo(3);
  await settle();
  core.goTo(4);
  await settle();

  assert.equal(madeCount(server.created, "answer"), 1);
});

test("저장된 답변이 있으면 POST 를 아예 안 보낸다", async () => {
  const server = makeServer({
    sectionCount: 3,
    userInput: "궁금해요",
    initialAnswer: ANSWER,
    initialPages: [sectionPage(1), sectionPage(2), sectionPage(3)],
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(4);
  await settle();
  assert.equal(core.getSnapshot().page.answer.summary, "답이에요.");
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/answer"), 0);
});

test("섹션이 덜 찼으면 빠진 번호를 채우고 답변을 다시 부른다", async () => {
  const server = makeServer({ sectionCount: 3, userInput: "궁금해요", lastReadPage: 3 });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  // 3번 장에서 열렸으므로 답변이 걸리는데, 그 시점에 1·2·3 이 다 있진 않다.
  assert.equal(madeCount(server.created, "answer"), 1);
  assert.deepEqual([...server.stored.keys()].sort(), [1, 2, 3]);
});

test("환불된 리포트는 답변도 만들지 않는다", async () => {
  // 답변도 모델을 부르는 자리라(약 20원) 총평·이미지와 같은 가드를 타야 한다.
  const server = makeServer({ sectionCount: 3, userInput: "궁금해요", status: "failed", lastReadPage: 4 });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  assert.equal(postsTo(server.calls, "/api/saju/readings/r1/answer"), 0);
});

test("사연 원문은 답변이 아직 없어도 화면에 실린다", async () => {
  // "내 질문이 읽혔다"는 확인이 기다리는 동안에도 보여야 한다(`ReaderAnswer.tsx`).
  const server = makeServer({
    sectionCount: 3,
    userInput: "둘째는 언제쯤이 좋을까요?",
    routes: { "POST /api/saju/readings/r1/answer": ({ json }) => json(500, { error: "boom" }) },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(4);
  await settle();
  const page = core.getSnapshot().page;
  assert.equal(page.kind, "answer");
  assert.equal(page.question, "둘째는 언제쯤이 좋을까요?");
  assert.equal(page.answer, null);
  assert.ok(page.error, "실패했는데 오류가 안 실렸다");
});

// ─────────────────────────────────────────────────────────────────────────────
// 후기
// ─────────────────────────────────────────────────────────────────────────────

test("후기를 남기면 서버가 돌려준 값으로 총평 장이 바뀐다", async () => {
  const review = { readingId: "r1", productSlug: "single-love", stars: 5, body: "좋았어요 정말로요", createdAt: "2026-09-27T00:00:00.000Z" };
  const server = makeServer({
    sectionCount: 3,
    initialClosing: CLOSING,
    initialPages: [sectionPage(1), sectionPage(2), sectionPage(3)],
    routes: { "POST /api/saju/readings/r1/review": ({ json }) => json(200, { review }) },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();

  core.goTo(4);
  await settle();
  assert.equal(core.getSnapshot().page.myReview, null);

  const error = await core.submitReview(5, "좋았어요 정말로요");
  assert.equal(error, null);
  // **서버가 준 값**을 그대로 쓴다 — 화면이 자기 입력으로 그리면 서버가 다듬은 결과와 어긋난다.
  assert.deepEqual(core.getSnapshot().page.myReview, review);
});

test("후기 제출이 거절되면 서버 문구를 그대로 돌려주고 상태를 안 바꾼다", async () => {
  const server = makeServer({
    sectionCount: 3,
    initialClosing: CLOSING,
    initialPages: [sectionPage(1), sectionPage(2), sectionPage(3)],
    routes: {
      "POST /api/saju/readings/r1/review": ({ json }) => json(409, { error: "이미 후기를 남기셨어요." }),
    },
  });
  const { core } = makeCore(server);
  await core.load();
  await settle();
  core.goTo(4);
  await settle();

  const error = await core.submitReview(5, "좋았어요 정말로요");
  assert.equal(error, "이미 후기를 남기셨어요.");
  assert.equal(core.getSnapshot().page.myReview, null);
});
