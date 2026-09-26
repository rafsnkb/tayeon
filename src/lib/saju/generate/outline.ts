// 1단 — 골격. 리포트 한 편에 딱 한 번 부른다.
//
// 이 단계가 하는 일은 본문을 쓰는 게 아니라 **섹션마다 쓸 근거를 미리 나눠주는 것**이다.
// doc/사주_구현설계.md §5 의 실측이 그 근거다 — 배정을 안 하면 연애 상품의 10섹션이 전부
// 부처궁만 쳐다본다(부처궁 인용 10/10 → 2/10, 등장한 궁 3종 → 11종). 원가는 185 → 194원,
// 품질 개선이 사실상 공짜였다.
//
// 출력 필드 순서가 `sections` → `thesis` 인 것도 의도다(§1 "총평은 마지막이다"): 0페이지가
// 목차라 그게 먼저 도착해야 하고, 사용자에게 보여줄 총평은 3단에서 본문을 받아 따로 쓴다.
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic } from "@/lib/anthropic";
import type { SajuProduct } from "@/lib/saju/products";
import { SAJU_PERSONAS } from "@/lib/saju/personas";
import { buildChartBlock, type SajuChart } from "./chart";

/** 사주 상품 텍스트 생성 모델. 원가가 판매가의 2% 수준이라 Haiku 로 아낄 이유가 없고,
 *  Haiku 는 시스템 블록이 2,048토큰 미만이면 캐시가 아예 안 걸린다(§5). */
export const SAJU_TEXT_MODEL = "claude-sonnet-5";

/** 사주 네 기둥 자리. `SajuResult.pillars`/`tenGods` 의 키와 같다(`calculate.ts`). */
export type SajuPillarKey = "year" | "month" | "day" | "hour";

/** `manseryeok` 패키지의 `TenGod` 유니온과 정확히 같다(`node_modules/manseryeok/dist/types.d.ts`).
 *  그 패키지가 값 목록을 export 하지 않아서(타입만 .d.ts 에 있다) 여기 다시 적는다 — 라이브러리가
 *  이 열 개를 바꾸면 같이 갱신해야 한다.
 *
 *  **카테고리명("인성"·"재성"·"식상"·"관성"·"비겁")은 일부러 뺐다.** 목업을 실제 명식과
 *  대조하다 "그 사람은 인성이 0개인데 '인성'을 근거로 든" 사고가 났다(2026-09-27) — 카테고리는
 *  구체적으로 어느 항목(편인/정인)을 가리키는지 모호해서 검증할 수 없다. 카테고리로 말하고
 *  싶으면 자유 텍스트인 `sajuBasis` 에만 쓰고, `sajuRefs` 는 구체적 열 개 중 하나만 쓴다. */
export const SAJU_TEN_GODS = [
  "비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인",
] as const;
export type SajuTenGod = (typeof SAJU_TEN_GODS)[number];

/** 이 근거가 누구의 명식인가. **생략하면 `"self"`다** — 궁합 아닌 상품 11개는 상대가 아예
 *  없어서 매번 이 필드를 채우게 하면 순수한 잡음이고, 잡음이 늘면 모델이 다른 필드에 쓸 주의를
 *  뺏긴다. 궁합 상품(`needsPartner: true`, 8개)에서는 사실상 필수다 — `personRule`(등장인물
 *  블록)이 이미 "근거를 인용할 때 누구의 것인지 반드시 밝힌다"고 요구하고 있고, 이 필드가 그
 *  말에 대응한다(2026-09-27, ①에서 `person` 없이 승인했던 설계를 검증 구멍이 발견돼 수선). */
export type ChartPerson = "self" | "partner";

/** `sajuBasis`(자유 텍스트, 프롬프트에 그대로 나가는 값)가 실제로 가리키는 명식 칸을
 *  **검증 가능한 형태**로 나란히 둔 것(2026-09-27). `sajuBasis` 를 대체하지 않는다.
 *
 *  ⚠️ `person` 이 없던 첫 버전은 "내담자 또는 상대 어느 쪽에라도 있으면 통과"로 검증해서
 *  **검증 구멍**이었다 — 본문이 내담자 얘기를 하면서 근거로는 상대방의 십신을 대도 통과했다.
 *  `person` 을 넣어 "지정된 사람의 명식에서만" 찾도록 좁혔다. */
export type SajuRef = { person?: ChartPerson; pillar: SajuPillarKey; tenGod: SajuTenGod };

/** `iztro` 패키지의 ko-KR 12궁 이름과 정확히 같다
 *  (`node_modules/iztro/lib/i18n/locales/ko-KR/palace.js`) — "궁" 접미사는 이 코드베이스가
 *  이미 정규화해 붙이는 방식과 맞췄다(`ziwei/calculate.ts` 의 `label` 계산 참고).
 *
 *  **신궁(身宮)은 뺐다.** 독립된 궁이 아니라 12궁 중 하나 위에 겹치는 표시라, 겹친 궁의
 *  이름으로 인용해야 맞다. */
export const ZIWEI_PALACES = [
  "명궁", "형제궁", "부처궁", "자녀궁", "재백궁", "질액궁",
  "천이궁", "노복궁", "관록궁", "전택궁", "복덕궁", "부모궁",
] as const;
export type ZiweiPalace = (typeof ZIWEI_PALACES)[number];

/** `star`(주성·보조성 이름)는 열거형으로 안 좁힌다 — 사람마다 실제 배치가 달라 보편 고정
 *  목록이 없다. enum 으로 좁히면 "이 사람에게 없는 별"도 그 enum 안에서는 통과해 버려
 *  **거짓 안전**이 된다. 대신 실행 시점에 이 사람의 실제 명반과 대조한다(아래
 *  `logSajuRefMismatches`). */
export type ZiweiRef = { person?: ChartPerson; palace: ZiweiPalace; star: string };

/** 2단이 섹션 하나를 쓸 때 받는 배정표. */
export type OutlineSection = {
  id: string;
  /** 이 섹션이 무슨 말을 할 것인지 한 줄. 0페이지 목차에 그대로 나간다. */
  gist: string;
  /** 이 섹션에서 쓸 사주 근거(십신·궁·운). 단일 자미두수 모드에서는 빈 문자열. */
  sajuBasis: string;
  ziweiBasis: string;
  /** `sajuBasis`/`ziweiBasis` 가 실제로 가리키는 명식 칸(2026-09-27). 안 쓰는 체계면 빈 배열
   *  — `sajuBasis`/`ziweiBasis` 문자열이 빈 것과 같은 조건이다. */
  sajuRefs: SajuRef[];
  ziweiRefs: ZiweiRef[];
};

export type SajuOutline = {
  sections: OutlineSection[];
  /** 섹션 생성의 내부 기준. **화면에 절대 노출하지 않는다** — 사용자가 읽는 총평은 3단의
   *  `closing` 이다(§1 "총평은 마지막이다"). 둘을 섞으면 반드시 혼동된다. */
  thesis: string;
  /** 이미 쓴 비유. 2단이 이걸 받아 같은 비유를 반복하지 않는다. */
  usedMetaphors: string[];
  /** 이미지 지원 상품만. 골격이 나오는 즉시 이미지 생성을 병행할 수 있다(§6) —
   *  이미지를 맨 뒤에 붙이면 사용자가 마지막 페이지에서 기다리게 된다. */
  imageBrief: string | null;
};

const OUTLINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  // 필드 순서가 곧 도착 순서다. 목차부터 채우려면 sections 가 맨 앞이어야 한다.
  required: ["sections", "thesis", "used_metaphors", "image_brief"],
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "gist", "saju_basis", "ziwei_basis", "saju_refs", "ziwei_refs"],
        properties: {
          id: { type: "string", description: "주어진 섹션 id 를 그대로 쓸 것. 새로 만들지 말 것." },
          gist: { type: "string", description: "이 섹션이 무슨 말을 할지 한 문장. 이 리포트의 문체를 그대로 따를 것." },
          saju_basis: {
            type: "string",
            description:
              "이 섹션에서만 쓸 사주 근거(십신·합충·대운/세운 중 해당하는 것). 사주를 쓰지 않는 모드면 빈 문자열.",
          },
          ziwei_basis: {
            type: "string",
            description:
              "이 섹션에서만 쓸 자미두수 근거(궁·주성·사화 중 해당하는 것). 자미두수를 쓰지 않는 모드면 빈 문자열.",
          },
          // 2026-09-27. `saju_basis`/`ziwei_basis` 는 자유 텍스트라 화면·코드가 "이 섹션이
          // 명식의 어느 칸을 쓰는지" 알 수 없었다 — 목업 대조에서 없는 궁·없는 십신을 근거로
          // 든 사고가 났다. 이 참조는 그 텍스트를 대체하지 않고 **검증 가능한 형태로 나란히**
          // 둔 것이다(`OutlineSection.sajuRefs`/`ziweiRefs` 주석 참고).
          saju_refs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              // `person` 은 required 가 아니다 — 생략하면 "self"로 본다(궁합 아닌 상품 11개는
              // 이 필드가 항상 무의미해서 매번 채우게 하면 잡음이다, SajuRef 주석 참고).
              required: ["pillar", "ten_god"],
              properties: {
                person: {
                  type: "string",
                  enum: ["self", "partner"],
                  description:
                    "이 근거가 누구의 명식인가. 궁합 상품(두 사람 명반이 모두 있는 리포트)에서만 쓴다 — 생략하면 내담자(self)로 본다. 상대방 근거를 낼 때는 반드시 'partner'를 쓸 것.",
                },
                pillar: {
                  type: "string",
                  enum: ["year", "month", "day", "hour"],
                  description: "saju_basis 가 가리키는 사주 기둥(연/월/일/시).",
                },
                ten_god: {
                  type: "string",
                  enum: [...SAJU_TEN_GODS],
                  description: "그 기둥의 십신. 이 사람의 사주에 실제로 있는 것만 — 지어내지 말 것.",
                },
              },
            },
            description: "saju_basis 가 실제로 가리키는 명식 칸. 사주를 쓰지 않는 모드면 빈 배열.",
          },
          ziwei_refs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["palace", "star"],
              properties: {
                person: {
                  type: "string",
                  enum: ["self", "partner"],
                  description:
                    "이 근거가 누구의 명식인가. 궁합 상품에서만 쓴다 — 생략하면 내담자(self)로 본다. 상대방 근거를 낼 때는 반드시 'partner'를 쓸 것.",
                },
                palace: {
                  type: "string",
                  enum: [...ZIWEI_PALACES],
                  description: "ziwei_basis 가 가리키는 궁.",
                },
                star: {
                  type: "string",
                  description: "그 궁에 실제로 있는 별 이름. 이 사람의 명반에 없는 별을 지어내지 말 것.",
                },
              },
            },
            description: "ziwei_basis 가 실제로 가리키는 명식 칸. 자미두수를 쓰지 않는 모드면 빈 배열.",
          },
        },
      },
    },
    thesis: {
      type: "string",
      description: "섹션들이 공유할 내부 기준 한두 문장. 사용자에게 보여주지 않는다.",
    },
    used_metaphors: { type: "array", items: { type: "string" } },
    image_brief: {
      type: ["string", "null"],
      description: "이미지 지원 상품일 때만 채운다. 아니면 null.",
    },
  },
} as const;

/** 상품 정의 + 명반 근거로 만드는 시스템 블록. 1·2·3단이 **같은 문자열**을 써야 캐시가 걸린다. */
export function buildSystemBlock(product: SajuProduct, chart: SajuChart, today: Date): string {
  const modeRule =
    chart.mode === "integrated"
      ? "사주와 자미두수 두 체계를 모두 쓴다. 섹션마다 두 근거를 각각 대고, 둘이 어긋나면 숨기지 말고 무엇이 다른지 쓴다."
      : chart.mode === "saju"
        ? "사주만 쓴다. 자미두수 용어(궁·주성·사화)를 쓰지 말 것."
        : "자미두수만 쓴다. 사주 용어(십신·합충·대운)를 쓰지 말 것.";

  /* `modeRule` 과 **같은 종류의 규칙**이다 — "이 리포트에 없는 것"을 이름 대고 금지한다.
     단일 모드에서 안 고른 체계를 금지하듯, 상대 명반이 없으면 상대 명반 인용을 금지한다.
     없는 것을 말해 주지 않으면 모델이 지어낸다.

     ⚠️ **"상대 얘기를 하지 마라"가 아니다.** 솔로 연애처럼 **명반이 없는 사람을 다루는 것이
     상품 자체인** 경우가 있다(`single-love` 의 "들어올 인연", 짝사랑의 상대). 그걸 막으면
     상품이 성립하지 않는다. 금지 대상은 **없는 명반을 인용하는 것**이다 — 사용자가 알아채는
     사고는 "모델이 상대의 부처궁을 봤다고 쓰는 것"이지 "상대를 언급하는 것"이 아니다. */
  const personRule = chart.partner
    ? "내담자와 상대방 두 사람의 명반이 모두 있다. 근거를 인용할 때 누구의 것인지 반드시 밝힌다."
    : "이 리포트에는 내담자 한 사람의 명반만 있다. 다른 사람(상대·연인·가족)을 이야기하더라도 그 사람의 명반을 인용하지 말 것 — 그 사람의 명반은 여기 없다. 상대에 대한 서술은 내담자의 명반에서 읽히는 관계 성향으로만 쓴다.";
  // ⚠️ 2026-09-26 바로잡음. **`personRule` 이 계산만 되고 실제로 프롬프트에 안 들어가고
  // 있었다** — 아래 return 배열에 줄이 없었다. `needsPartner: false` 상품 다수에서 "없는
  // 상대 명반을 인용하지 말라"는 안전 규칙이 한 번도 전달된 적이 없었다는 뜻이다. 짝사랑
  // 리포트가 "상대분의 명반을 보니" 같은 문장을 낼 수 있는 상태였다 — 사용자가 바로 알아채는
  // 사고다(상대 생년월일을 준 적이 없다). `lint` 의 "정의했는데 안 쓴다" 경고가 계속 알려주고
  // 있었는데 경고 22개에 묻혀서 아무도 못 봤다.

  // 2026-09-26 바로잡음. **단일 모드에서 자기모순이 있었다** — `modeRule` 이 "자미두수 용어를
  // 쓰지 말 것"이라 해 놓고 바로 아래 `## 자미두수 중점` 이 궁·주성 이름을 대며 그 체계를 쓰라고
  // 말했다. 모순된 지시를 받으면 모델이 어느 쪽을 따를지 복불복이라, 사주만 산 사용자가 궁
  // 이름이 나오는 리포트를 받을 수 있었다 — 그 사용자는 자미두수 값을 안 냈으니 환불 사유다.
  // 그래서 안 고른 체계의 중점 블록은 아예 안 넣는다(빈 줄로 남기지 않는다 — 있으나 마나 한
  // 문단이 아니라 "이 체계는 이 리포트에 없다"는 사실 자체를 프롬프트에서 지운다).
  const sajuFocusBlock = chart.mode !== "ziwei" ? `## 사주 중점\n${product.sajuFocus}` : null;
  const ziweiFocusBlock = chart.mode !== "saju" ? `## 자미두수 중점\n${product.ziweiFocus}` : null;
  // `crossPoints` 의 내용은 대부분 모드 중립적인 "무엇을 짚어야 하는가" 우선순위라 단일 모드
  // 에서도 쓸모가 있다 — 통째로 빼지 않고 **제목만** 모드에 맞춘다. "통합 교차 포인트"라는
  // 제목은 통합 모드에서만 맞는 말이다(단일 모드엔 교차할 두 번째 체계가 없다).
  const crossPointsBlock = `## ${chart.mode === "integrated" ? "통합 교차 포인트" : "이 리포트가 짚어야 할 것"}\n${product.crossPoints}`;

  // 2026-09-27. 목업에 실제 명식을 대조하다 드러난 인용 오류 2건(사주담 대조 작업, sub_4) —
  // 명식에 없는 궁(예: "교우궁" — 우리 12궁 이름은 "노복궁"이다)과 없는 십신(그 사람에게
  // 없는 "상관"·"인성")을 근거로 든 사례가 나왔다. `buildChartBlock` 이 명식을 이미 싣고
  // 있는데도 이런다 — 프롬프트 지시 하나만으로는 부족해서 **구조화된 참조**(설계 문서 §11의
  // 「명식 인용 검증」 논의)가 별도로 필요하지만, 그거와 무관하게 여기 한 줄은 지금 넣는다.
  //
  // 두 번째 줄(실제 연도로 짚기)은 전혀 다른 문제다 — `buildChartBlock` 이 세운·유년의
  // 시간축을 이미 싣고 있는데 본문이 "하반기쯤"처럼 흐려서 시기 상품의 유일한 우위(타로가
  // 못 하는 "언제")를 못 살리고 있었다(사주담 대조: "2030년은 편재가 들어와…" 식으로 연도를
  // 직접 짚는다). 없는 확신을 만들라는 게 아니라 **시간축에 실제로 있는 해만** 짚으라는 것.
  const citationRulesBlock = [
    "## 근거 인용 규칙",
    "- 아래 명식에 실제로 있는 궁·십신·별만 인용한다. 없는 것을 지어내지 않는다.",
    "- 시간축(세운·유년)에 실제로 있는 해가 근거일 때는 '하반기쯤'처럼 흐리지 말고 그 해를 직접 짚는다. 다만 시간축에 없는 해를 단정하지 않는다.",
  ].join("\n");

  return [
    `# 상품: ${product.title}`,
    `목적: ${product.purpose}`,
    "",
    // `modeRule` 과 `personRule` 은 붙어 있어야 읽힌다 — 둘 다 "이 리포트에 없는 것을 이름
    // 대고 금지한다"는 같은 종류의 규칙이다(위 personRule 주석 참고).
    `## 분석 모드\n${modeRule}`,
    `## 등장인물\n${personRule}`,
    "",
    ...[sajuFocusBlock, ziweiFocusBlock, crossPointsBlock].filter((b) => b !== null),
    // 상품별 해석 제약(기획의 `분석 방식`). 지금은 성향 궁합 하나뿐이지만 안전 제약이라
    // 문체 규칙보다 앞에 둔다 — 뒤쪽 지시가 앞쪽을 덮는 일이 없도록.
    product.constraints ? `## 이 상품의 해석 제약\n${product.constraints}` : "",
    "",
    citationRulesBlock,
    "",
    buildChartBlock(chart, today),
    "",
    "## 문체",
    // 첫 줄은 상품의 페르소나(personas.ts)가 정한다 — 상품마다 목소리가 다르다(2026-09-26
    // 사용자 결정). 나머지 두 줄은 페르소나와 무관한 품질 규칙이라 고정이다. 페르소나의
    // `styleDirective` 도 같은 이유로 금지 목록이 아니라 긍정문으로 쓰여 있다 — 어미를
    // 기계적으로 금지하면 모델이 그 문체를 통째로 버리고 도망간다(§5 주의 2, 해요체 0% 실측).
    `- ${SAJU_PERSONAS[product.persona].styleDirective}`,
    "- 전문 용어는 근거를 말할 때만 쓰고, 바로 쉬운 말로 풀어 준다.",
    "- 퍼센트나 점수로 일치도를 말하지 않는다. 근거 없는 수치다.",
  ].join("\n");
}

export async function generateOutline(args: {
  product: SajuProduct;
  chart: SajuChart;
  /** 사용자가 구매 시 적어 넣은 사연(상품의 userInputPrompt 에 대한 답). 없으면 빈 문자열. */
  userInput: string;
  today: Date;
}): Promise<SajuOutline> {
  const { product, chart, userInput, today } = args;

  const sectionList = product.sections.map((s) => `- ${s.id}: ${s.title}`).join("\n");

  const response = await anthropic.messages.parse({
    model: SAJU_TEXT_MODEL,
    max_tokens: 8000,
    // 기본값이 켜져 있다. 첫 실측에서 출력 3,000토큰 중 2,955가 thinking 이라 본문이 한 글자도
    // 안 나왔다(§5 주의 1). 모르고 켜 두면 원가가 3~4배.
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        text: buildSystemBlock(product, chart, today),
        // 섹션 10회 + 총평 1회가 이 블록을 공유한다. prefix 가 한 바이트라도 달라지면 전부 놓친다.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          "아래 섹션들의 골격을 잡아 주세요.",
          "",
          "## 섹션 목록 (id: 제목)",
          sectionList,
          "",
          // 배정이 이 단계의 존재 이유다. 명시하지 않으면 모든 섹션이 같은 궁 하나만 본다.
          "## 요구사항",
          "- 섹션마다 **서로 다른** 근거를 배정하세요. 같은 궁·같은 십신을 여러 섹션이 주력으로 쓰면 리포트가 같은 말을 열 번 하게 됩니다.",
          "- 각 섹션의 제목을 소제목으로 그대로 되풀이하지 마세요.",
          "- saju_refs/ziwei_refs 는 saju_basis/ziwei_basis 가 실제로 가리키는 명식 칸입니다. 이 사람의 실제 명식에 있는 것만 쓰세요 — 없는 궁·십신·별을 지어내지 마세요.",
          chart.partner
            ? "- 이 리포트는 두 사람의 명반이 모두 있습니다. saju_refs/ziwei_refs 의 person 을 반드시 채우세요 — 상대방 근거면 'partner', 생략하면 'self'로 봅니다. 내담자 얘기를 하면서 person 을 안 채우고 상대방 명식의 값을 대면 검증에서 걸립니다."
            : "",
          product.image
            ? `- image_brief 를 채우세요. 그릴 대상: ${product.image.subject}\n  담을 요소: ${product.image.elements.join(", ")}`
            : "- 이 상품은 이미지가 없습니다. image_brief 는 null 로 두세요.",
          userInput.trim() ? `\n## 사용자가 적은 사연\n${userInput.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    output_config: { format: jsonSchemaOutputFormat(OUTLINE_SCHEMA) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("OUTLINE_PARSE_FAILED");

  // 섹션 id 는 상품 정의가 단일 출처다. 모델이 새로 지어내거나 빠뜨리면 2단이 어느 섹션을 쓰는지
  // 알 수 없으므로, 받은 걸 그대로 믿지 않고 상품 정의 순서로 맞춰 재배열한다.
  const byId = new Map(parsed.sections.map((s) => [s.id, s]));
  const sections: OutlineSection[] = product.sections.map((defined) => {
    const got = byId.get(defined.id);
    if (!got) throw new Error(`OUTLINE_MISSING_SECTION:${defined.id}`);
    return {
      id: defined.id,
      gist: got.gist,
      sajuBasis: got.saju_basis,
      ziweiBasis: got.ziwei_basis,
      sajuRefs: got.saju_refs.map((r) => ({
        person: r.person as ChartPerson | undefined,
        pillar: r.pillar as SajuPillarKey,
        tenGod: r.ten_god as SajuTenGod,
      })),
      ziweiRefs: got.ziwei_refs.map((r) => ({
        person: r.person as ChartPerson | undefined,
        palace: r.palace as ZiweiPalace,
        star: r.star,
      })),
    };
  });

  logSajuRefMismatches(product, chart, sections);

  return {
    sections,
    thesis: parsed.thesis,
    usedMetaphors: parsed.used_metaphors,
    imageBrief: parsed.image_brief,
  };
}

/**
 * `sajuRefs`/`ziweiRefs`가 이 사람의 실제 명식에 있는지 대조한다. **검사만 하고 막지 않는다**
 * (2026-09-27 사용자 결정, B안) — 얼마나 자주 어긋나는지 모르는 채로 재시도를 걸면 편당
 * 비용이 예측 불가가 된다. 실호출 검증에서 빈도를 재고 그때 재시도가 필요한지 정한다.
 *
 * §9 의 `kind: "failed"` 자리표를 안 쓰는 이유: 그건 "모델 호출 자체가 실패"용이다. 이건
 * **읽을 수 있는 본문이 이미 있는** 상태라 전제가 다르다 — 멀쩡한 글을 "생성 실패" 화면으로
 * 바꾸면 사용자 경험이 더 나빠진다.
 *
 * `console.warn` 만 쓰고 `notifyOwner` 를 안 쓴 이유: 빈도를 모르는 채로 실시간 알림을 걸면
 * 그 자체가 알림 스팸이 될 수 있다. 나중에 셀 수 있게(상품·섹션·무엇이 어긋났는지) 구조화된
 * 한 줄만 남긴다 — 실호출 검증에서 로그를 모아 빈도를 재고, 그 결과로 알림·재시도 여부를 정한다.
 *
 * ⚠️ 2026-09-27 두 번째 바로잡음. 처음엔 `person` 이 없어서 "내담자 또는 상대 어느 쪽
 * 명식에라도 있으면" 통과시켰는데, 그러면 **검증 구멍**이었다 — 본문이 내담자 얘기를 하면서
 * 근거로는 상대방의 십신을 대도 통과했다(궁합 상품 8개에서 ①이 막으려던 사고를 못 막았다).
 * `ref.person`(생략하면 self)으로 **지정된 사람의 명식에서만** 찾도록 좁혔다.
 */
export function logSajuRefMismatches(product: SajuProduct, chart: SajuChart, sections: OutlineSection[]): void {
  for (const section of sections) {
    for (const ref of section.sajuRefs) {
      if (!sajuRefExists(chart, ref)) {
        console.warn(
          `[SAJU_REF_MISMATCH] product=${product.slug} section=${section.id} person=${ref.person ?? "self"} pillar=${ref.pillar} tenGod=${ref.tenGod}`
        );
      }
    }
    for (const ref of section.ziweiRefs) {
      if (!ziweiRefExists(chart, ref)) {
        console.warn(
          `[SAJU_REF_MISMATCH] product=${product.slug} section=${section.id} person=${ref.person ?? "self"} palace=${ref.palace} star=${ref.star}`
        );
      }
    }
  }
}

/** `ref.person`(생략하면 `"self"`)이 가리키는 사람의 명반을 고른다. 상대가 없는 리포트에서
 *  `person: "partner"` 를 대면(모순이라 정상 흐름에선 안 나야 한다) `chart.partner` 가
 *  `null` 이라 그대로 "없음"으로 처리되고, 그 ref 는 아래에서 불일치로 잡힌다 — 그것도
 *  맞는 동작이다(상대가 아예 없는 리포트에서 상대 근거를 대는 것 자체가 사고다). */
function personChart(chart: SajuChart, person: ChartPerson | undefined): SajuChart["self"] | null {
  return (person ?? "self") === "partner" ? chart.partner : chart.self;
}

export function sajuRefExists(chart: SajuChart, ref: SajuRef): boolean {
  const saju = personChart(chart, ref.person)?.saju;
  if (!saju) return false;
  const cell = saju.tenGods[ref.pillar];
  return cell != null && (cell.stem === ref.tenGod || cell.branch === ref.tenGod);
}

export function ziweiRefExists(chart: SajuChart, ref: ZiweiRef): boolean {
  const ziwei = personChart(chart, ref.person)?.ziwei;
  if (!ziwei) return false;
  return ziwei.palaces.some((p) => {
    const name = p.name.endsWith("궁") ? p.name : `${p.name}궁`;
    return name === ref.palace && (p.majorStars.includes(ref.star) || p.minorStars.includes(ref.star));
  });
}
