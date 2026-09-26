// `toReadingView` — 저장 문서에서 **화면에 내보낼 것만** 고른다.
//
// 이 테스트가 지키는 건 모양이 아니라 **약속**이다. 설계 §1 이 `outline.thesis` 를 "화면에 절대
// 노출하지 않는다"로 정했는데, 화면에 안 그리는 것만으로는 그 약속이 안 지켜진다 — 응답 JSON 에
// 실리면 **개발자 도구 네트워크 탭에 그대로 보인다.** 총평을 마지막 페이지에 두기로 한 결정이
// 거기서 통째로 무너진다.
//
// 그래서 "필드가 있는가"가 아니라 **"직렬화한 문자열 어디에도 없는가"** 로 본다. 중첩된 곳에
// 딸려 나가는 경우까지 잡아야 해서다.
import test from "node:test";
import assert from "node:assert/strict";
import { toReadingView } from "./view.ts";

const THESIS = "이 사람은 관계에서 먼저 물러서는 편이다";
const SAJU_BASIS = "비견 과다, 부처궁 공망";
// 안 쓰는 필드(sign·zodiac)가 새면 안 된다는 걸 잡으려고 공통 접미사를 쓴다 — 둘 중 하나라도
// 그대로 나가면 이 문자열이 걸린다. sajuFortune·ziweiHoroscope 는 2026-09-27 부터 정반대다 —
// 이제는 나가야 하는 값이라(아래 sajuFortune/horoscope 참고) 이 마커를 안 쓴다.
const LEAK_MARK = "유출되면_안됨";

function sajuResult(over = {}) {
  return {
    pillars: { year: "병자", month: "임진", day: "기묘", hour: "신미" },
    tenGods: {
      year: { stem: "정인", branch: "편재" },
      month: { stem: "정재", branch: "겁재" },
      day: { stem: "일간", branch: "편관" },
      hour: { stem: "식신", branch: "비견" },
    },
    voidBranches: ["신", "유"],
    timeUnknown: false,
    ...over,
  };
}

function ziweiResult(over = {}) {
  return {
    soul: "자미",
    body: "천부",
    fiveElementsClass: "화육국",
    sign: `SIGN_${LEAK_MARK}`,
    zodiac: `ZODIAC_${LEAK_MARK}`,
    palaces: [{ name: "명궁", majorStars: ["자미"], minorStars: ["문창"] }],
    timeUnknown: false,
    ...over,
  };
}

/** 사주 시간축(대운·세운·월운) — 2026-09-27 부터 화면에 나간다(모델은 이미 받고 있었다,
 *  view.ts 머리말 참고). 값 전체가 `buildSajuFortunePromptBlock` 이 쓰는 것과 같다 — 뺄 필드가
 *  없다. */
function sajuFortune(over = {}) {
  return {
    luck: { forward: true, pillars: [{ age: 8, korean: "경진" }, { age: 18, korean: "기묘" }], currentAge: 18 },
    annual: [{ year: 2025, pillar: "갑진" }, { year: 2026, pillar: "을사" }, { year: 2027, pillar: "병오" }],
    monthly: [{ month: 1, pillar: "정축" }],
    ...over,
  };
}

/** 자미두수 시간축(대한·유년·사화) — 같은 이유로 화면에 나간다. */
function horoscope(over = {}) {
  return {
    decadal: { stem: "갑", branch: "자", palaceNames: ["명궁", "형제"], mutagen: ["염정", "파군", "무곡", "탐랑"] },
    yearly: { stem: "을", branch: "축", palaceNames: ["형제", "명궁"], mutagen: ["천기", "천량", "자미", "거문"] },
    ...over,
  };
}

/** 한 사람분 명식. */
function personChart(over = {}) {
  return {
    saju: sajuResult(),
    sajuFortune: sajuFortune(),
    ziwei: ziweiResult(),
    ziweiHoroscope: horoscope(),
    ...over,
  };
}

function chart(over = {}) {
  return { mode: "integrated", self: personChart(), partner: null, ...over };
}

function reading(over = {}) {
  return {
    id: "r1",
    productSlug: "single-love",
    mode: "integrated",
    status: "generating",
    createdAt: "2026-09-26T10:00:00.000Z",
    birthSnapshot: { birthDate: "1996-04-12", gender: "female" },
    partnerBirthSnapshot: null,
    chart: chart(),
    outline: {
      sections: [
        { id: "a", gist: "지금 흐름", sajuBasis: SAJU_BASIS, ziweiBasis: "천부성" },
        { id: "b", gist: "다가올 시기", sajuBasis: "정관", ziweiBasis: "" },
      ],
      thesis: THESIS,
      usedMetaphors: ["문", "계단"],
      imageBrief: "비 오는 거리",
    },
    userInput: "요즘 어떤가요",
    closing: null,
    image: null,
    lastReadPage: 0,
    paymentId: "pay_secret_123",
    failedReason: null,
    ...over,
  };
}

function product(over = {}) {
  return {
    slug: "single-love",
    sections: [
      { id: "a", title: "지금 두 사람의 거리" },
      { id: "b", title: "관계가 움직이는 시기" },
    ],
    ...over,
  };
}

function sectionPage(pageNumber) {
  return {
    kind: "section",
    pageNumber,
    createdAt: "2026-09-26T10:01:00.000Z",
    id: "a",
    title: `${pageNumber}장`,
    summary: "요약",
    sajuBasis: "",
    ziweiBasis: "",
    crossStatus: null,
    crossSummary: "",
    actionGuide: "",
  };
}

test("thesis 는 직렬화 결과 어디에도 나오지 않는다", () => {
  const view = toReadingView(reading(), [], product());
  assert.ok(!JSON.stringify(view).includes(THESIS));
});

test("골격의 근거 배정(sajuBasis·ziweiBasis)도 나가지 않는다", () => {
  // 어느 궁·십신을 어느 섹션에 배정했는지는 생성을 위한 내부 배정이다. 사용자는 본문에서
  // 그 근거를 문장으로 읽지, 목차에서 키워드로 미리 보지 않는다.
  const view = toReadingView(reading(), [], product());
  assert.ok(!JSON.stringify(view).includes(SAJU_BASIS));
});

test("chart 의 안 쓰는 필드(sign·zodiac)는 안 나가고, paymentId 도 안 나간다", () => {
  const view = toReadingView(reading(), [], product());
  const json = JSON.stringify(view);
  assert.ok(!json.includes("유출되면_안됨"), "ziwei 의 sign·zodiac 이 새고 있다");
  assert.ok(!json.includes("pay_secret_123"));
  // 음성 대조만으로는 "명식을 통째로 안 보낸 것"과 구분이 안 된다 — 실제로 나가야 하는 값도
  // 확인한다(2026-09-26, 사용자 결정 "명식도 보여주자").
  assert.equal(view.chart.self.saju.pillars.day, "기묘");
  assert.equal(view.chart.self.ziwei.palaces[0].name, "명궁");
});

test("시간축(대운·세운·대한·유년)도 나간다 — 모델은 이미 받고 있던 값이다(2026-09-27)", () => {
  const view = toReadingView(reading(), [], product());
  assert.equal(view.chart.self.sajuFortune.luck.currentAge, 18);
  assert.deepEqual(view.chart.self.sajuFortune.annual.map((a) => a.year), [2025, 2026, 2027]);
  assert.equal(view.chart.self.ziweiHoroscope.decadal.stem, "갑");
  assert.deepEqual(view.chart.self.ziweiHoroscope.yearly.mutagen, ["천기", "천량", "자미", "거문"]);
});

test("사주 단일 모드는 자미두수 명식·시간축을 절대 내보내지 않는다 — 안 낸 돈으로 산 값이 보이면 안 된다", () => {
  // `calculatePerson`(chart.ts)이 정상적으로 동작하면 mode:"saju" 일 때 person.ziwei·
  // person.ziweiHoroscope 는 이미 null 이지만, 그건 계산 계층의 약속이지 이 계층의 방어가
  // 아니다. 여기서는 계산 계층이 실수로(또는 앞으로) 둘 다 채워 보내는 경우까지 가정해서, view
  // 계층이 **그래도** 막는지 본다 — 방어가 어느 한쪽에만 있으면 다른 쪽이 뚫렸을 때 못 잡는다.
  const view = toReadingView(
    reading({
      mode: "saju",
      chart: chart({
        mode: "saju",
        self: personChart({
          ziwei: ziweiResult({ soul: `SOUL_${LEAK_MARK}` }),
          ziweiHoroscope: horoscope({ decadal: { stem: `STEM_${LEAK_MARK}`, branch: "", palaceNames: [], mutagen: [] } }),
        }),
      }),
    }),
    [],
    product()
  );
  assert.equal(view.chart.self.ziwei, null);
  assert.equal(view.chart.self.ziweiHoroscope, null);
  assert.ok(!JSON.stringify(view).includes(LEAK_MARK));
});

test("자미두수 단일 모드는 사주 명식·시간축을 절대 내보내지 않는다", () => {
  const view = toReadingView(
    reading({
      mode: "ziwei",
      chart: chart({
        mode: "ziwei",
        self: personChart({
          saju: sajuResult({ pillars: { year: `Y_${LEAK_MARK}`, month: "", day: "", hour: null } }),
          sajuFortune: sajuFortune({ annual: [{ year: 1, pillar: `P_${LEAK_MARK}` }] }),
        }),
      }),
    }),
    [],
    product()
  );
  assert.equal(view.chart.self.saju, null);
  assert.equal(view.chart.self.sajuFortune, null);
  assert.ok(!JSON.stringify(view).includes(LEAK_MARK));
});

test("상대방 명식은 궁합 상품에만 있다 — 없으면 빈 칸이 아니라 null 이어야 한다", () => {
  const solo = toReadingView(reading(), [], product());
  assert.equal(solo.chart.partner, null);
  assert.equal(solo.partnerNickname, null);

  const withPartner = toReadingView(
    reading({ partnerBirthSnapshot: { nickname: "민준" }, chart: chart({ partner: personChart() }) }),
    [],
    product()
  );
  assert.equal(withPartner.partnerNickname, "민준");
  assert.equal(withPartner.chart.partner.saju.pillars.day, "기묘");
});

test("§7 에 필드가 하나 늘어도 저절로 새지 않는다", () => {
  // `toReadingView` 가 "뺄 목록"이 아니라 "내보낼 목록"으로 짜였는지 보는 것이다. 저장 문서에
  // 모르는 필드를 하나 얹어도 결과에 나타나면 안 된다 — 그게 빼는 목록 방식의 실패 모양이다.
  const view = toReadingView(
    reading({ 나중에추가된필드: "절대 나가면 안 되는 값" }),
    [],
    product()
  );
  assert.ok(!JSON.stringify(view).includes("절대 나가면 안 되는 값"));
});

test("페이지의 expiresAtTs(TTL 전용 Timestamp)는 나가지 않는다 — pages 는 통째로 스프레드해서 §7 필드 테스트가 안 잡는다", () => {
  // `pages` 는 위 테스트와 달리 저장 문서를 통째로 스프레드해서 내보낸다(§7 필드가 늘 때마다
  // 이 파일을 고치지 않으려는 의도적 선택, view.ts 머리말). 그래서 페이지에 새 필드가 붙으면
  // 자동으로 새는데, `expiresAtTs` 는 실제로는 Firestore Timestamp 인스턴스라 그대로 내보내면
  // `_seconds`/`_nanoseconds` 같은 낯선 모양으로 직렬화된다(storage.ts 의 SajuReadingPage 주석,
  // 2026-09-26). 여기서는 "이 키 자체가 없다"만 본다 — 값이 뭐든 상관없다.
  const page = { ...sectionPage(1), expiresAtTs: { seconds: 1234567890, nanoseconds: 0 } };
  const view = toReadingView(reading(), [page], product());
  assert.ok(!("expiresAtTs" in view.pages[0]));
  assert.ok(!JSON.stringify(view).includes("1234567890"));
});

test("목차 제목은 상품에서 오고 요지는 골격에서 온다", () => {
  const view = toReadingView(reading(), [], product());
  assert.deepEqual(view.outline, [
    { title: "지금 두 사람의 거리", gist: "지금 흐름" },
    { title: "관계가 움직이는 시기", gist: "다가올 시기" },
  ]);
});

test("상품이 사라진 리포트도 읽힌다 — 제목만 요지로 대신한다", () => {
  // 이미 돈을 받은 결과물이라 읽기를 막으면 안 된다. 상품에서 오는 건 섹션 제목뿐이고 본문은
  // 문서에 얼려 있다.
  const view = toReadingView(reading(), [sectionPage(1)], undefined);
  assert.deepEqual(
    view.outline.map((o) => o.title),
    ["지금 흐름", "다가올 시기"]
  );
  assert.equal(view.pages.length, 1);
});

test("상품의 섹션 수가 모자라도 그 자리만 요지로 메운다", () => {
  const view = toReadingView(reading(), [], product({ sections: [{ id: "a", title: "첫 장" }] }));
  assert.deepEqual(
    view.outline.map((o) => o.title),
    ["첫 장", "다가올 시기"]
  );
});

test("페이지는 번호 순으로 나간다", () => {
  // 저장소가 정렬해서 주지만 여기서 한 번 더 맞춘다 — 화면이 배열 순서를 그대로 페이지 순서로
  // 믿기 때문이다. 문자열 정렬이 섞이면 10장이 2장 앞에 온다.
  const view = toReadingView(reading(), [sectionPage(10), sectionPage(2), sectionPage(1)], product());
  assert.deepEqual(
    view.pages.map((p) => p.pageNumber),
    [1, 2, 10]
  );
});

test("sectionCount 는 골격의 섹션 수다", () => {
  // 화면이 `outline.length` 로 세지 않게 따로 내보낸다. 목차와 페이지 수가 갈라지면
  // "다음 페이지가 있는가" 판단이 틀린다.
  const view = toReadingView(reading(), [], product());
  assert.equal(view.sectionCount, 2);
});

test("실패 자리표도 그대로 나간다", () => {
  // 화면이 그 페이지에 안내를 그려야 하므로 숨기면 안 된다(§9).
  const failed = { kind: "failed", pageNumber: 3, createdAt: "2026-09-26T10:02:00.000Z", attempts: 3 };
  const view = toReadingView(reading(), [failed], product());
  assert.equal(view.pages[0].kind, "failed");
  assert.equal(view.pages[0].attempts, 3);
});
