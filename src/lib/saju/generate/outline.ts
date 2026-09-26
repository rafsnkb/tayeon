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

/** 2단이 섹션 하나를 쓸 때 받는 배정표. */
export type OutlineSection = {
  id: string;
  /** 이 섹션이 무슨 말을 할 것인지 한 줄. 0페이지 목차에 그대로 나간다. */
  gist: string;
  /** 이 섹션에서 쓸 사주 근거(십신·궁·운). 단일 자미두수 모드에서는 빈 문자열. */
  sajuBasis: string;
  ziweiBasis: string;
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
        required: ["id", "gist", "saju_basis", "ziwei_basis"],
        properties: {
          id: { type: "string", description: "주어진 섹션 id 를 그대로 쓸 것. 새로 만들지 말 것." },
          gist: { type: "string", description: "이 섹션이 무슨 말을 할지 한 문장. 해요체." },
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
    };
  });

  return {
    sections,
    thesis: parsed.thesis,
    usedMetaphors: parsed.used_metaphors,
    imageBrief: parsed.image_brief,
  };
}
