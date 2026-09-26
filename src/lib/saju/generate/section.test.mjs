// `echoOf` — 다음 섹션에게 넘길 "앞에서 이미 쓴 것".
//
// 순차 생성이 중복을 막는 장치가 이 한 함수에 달려 있다(§5: 해요체 유지 46% → 70%). 그런데
// 종결어미 추출이 정규식이라 조용히 빈 배열을 돌려주기 쉽고, 그러면 모델은 "앞에서 아무 어미도
// 안 썼다"고 읽어서 같은 어미를 반복한다 — **터지지 않고 품질만 떨어지는** 실패라 테스트로 잡는다.
import test from "node:test";
import assert from "node:assert/strict";
import { echoOf } from "./section.ts";

/** 섹션 한 장. 테스트마다 필요한 칸만 덮어쓴다. */
function section(over = {}) {
  return {
    id: "s1",
    title: "관계의 흐름",
    summary: "",
    sajuBasis: "",
    ziweiBasis: "",
    crossStatus: null,
    crossSummary: "",
    actionGuide: "",
    ...over,
  };
}

test("제목은 그대로 넘긴다", () => {
  assert.equal(echoOf(section({ title: "다음 인연의 시기" })).title, "다음 인연의 시기");
});

test("해요체 종결어미를 뽑는다", () => {
  const echo = echoOf(
    section({
      summary: "올해는 흐름이 열려요.",
      actionGuide: "먼저 연락해 보세요.",
    })
  );
  assert.deepEqual(echo.endings, ["열려요", "보세요"]);
});

test("네 칸 전부에서 어미를 모은다", () => {
  // summary 만 보면 근거 문단이 쓴 어미가 안 잡혀서 모델이 그걸 반복한다.
  const echo = echoOf(
    section({
      summary: "흐름이 좋아요.",
      sajuBasis: "일간이 강해요.",
      ziweiBasis: "명궁이 밝아요.",
      actionGuide: "천천히 가세요.",
    })
  );
  assert.deepEqual(echo.endings, ["좋아요", "강해요", "밝아요", "가세요"]);
});

test("같은 어미는 한 번만 남긴다", () => {
  // 중복을 보여줄 목적이 아니라 "무엇을 썼는지" 목록이라 중복은 자리만 차지한다.
  const echo = echoOf(
    section({
      summary: "좋아요. 정말 좋아요.",
      actionGuide: "해보세요. 또 해보세요.",
    })
  );
  assert.deepEqual(echo.endings, ["좋아요", "보세요"]);
});

test("어미는 항상 `요` 앞 두 글자까지만 잡는다", () => {
  // 정규식이 `[가-힣]{2}요` 라서 어미는 늘 세 글자로 잘린다 — `해보세요` 는 `보세요` 가 되고,
  // 따라서 `보세요`·`해보세요`·`가 보세요` 가 **같은 어미 하나**로 합쳐진다. 목적이 형태소
  // 분석이 아니라 "같은 어미가 반복되는가"를 모델에게 보여주는 것이므로 이 거칠음은 의도다.
  // 다만 그걸 모르고 보면 결과가 틀린 것처럼 보이니 계약으로 박아 둔다.
  assert.deepEqual(echoOf(section({ summary: "해보세요." })).endings, ["보세요"]);
  assert.deepEqual(echoOf(section({ summary: "해보세요. 보세요." })).endings, ["보세요"]);
});

test("어미는 6개로 자른다", () => {
  const summary = ["열려요", "좋아요", "강해요", "밝아요", "가세요", "보세요", "많아요", "적어요"]
    .map((e) => `${e}.`)
    .join(" ");
  const echo = echoOf(section({ summary }));
  assert.equal(echo.endings.length, 6);
  assert.deepEqual(echo.endings, ["열려요", "좋아요", "강해요", "밝아요", "가세요", "보세요"]);
});

test("해요체가 없으면 빈 배열이다", () => {
  // 문어체로 도망간 응답(§5 주의 2)이 여기로 온다. 던지지 않고 빈 배열이어야 다음 섹션 생성이
  // 그대로 진행된다 — 한 섹션이 문체를 놓친 것이 리포트 전체를 멈출 이유는 아니다.
  const echo = echoOf(section({ summary: "관계가 좋아진다.", actionGuide: "연락한다." }));
  assert.deepEqual(echo.endings, []);
});

test("느낌표·물음표로 끝나는 어미도 잡는다", () => {
  const echo = echoOf(section({ summary: "정말 좋아요!", actionGuide: "어때요?" }));
  assert.deepEqual(echo.endings, ["좋아요", "어때요"]);
});

test("문장부호 없이 끝나면 어미로 세지 않는다", () => {
  // 현재 정규식의 계약이다(마침표까지 있어야 문장 끝으로 본다). 바꾸면 이 줄이 깨지므로,
  // 바꾸는 사람이 의도한 변경인지 한 번 보게 된다.
  assert.deepEqual(echoOf(section({ summary: "좋아요" })).endings, []);
});

test("첫 문장은 summary 에서만 뽑는다", () => {
  const echo = echoOf(
    section({ summary: "올해는 흐름이 열려요. 다만 서두르면 놓쳐요.", sajuBasis: "일간이 강해요." })
  );
  assert.equal(echo.firstSentence, "올해는 흐름이 열려요.");
});

test("summary 에 문장이 하나뿐이어도 된다", () => {
  // `split` 이 한 조각만 돌려주는 경우다. 여기서 undefined 가 새면 다음 섹션 프롬프트에
  // "undefined" 라는 글자가 그대로 들어간다.
  const echo = echoOf(section({ summary: "올해는 흐름이 열려요." }));
  assert.equal(echo.firstSentence, "올해는 흐름이 열려요.");
});

test("summary 가 비어도 첫 문장은 문자열이다", () => {
  const echo = echoOf(section({ summary: "" }));
  assert.equal(typeof echo.firstSentence, "string");
  assert.equal(echo.firstSentence, "");
});

test("단일 모드의 빈 칸이 첫 문장·어미를 오염시키지 않는다", () => {
  // 사주 단일 모드면 ziweiBasis·crossSummary 가 빈 문자열로 온다(section.ts 가 잘라서 넣는다).
  const echo = echoOf(
    section({ summary: "흐름이 열려요.", sajuBasis: "일간이 강해요.", ziweiBasis: "", crossSummary: "" })
  );
  assert.equal(echo.firstSentence, "흐름이 열려요.");
  assert.deepEqual(echo.endings, ["열려요", "강해요"]);
});
