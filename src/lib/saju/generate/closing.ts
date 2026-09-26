// 3단 — 총평. 마지막 섹션까지 끝난 뒤 한 번 부른다. **리포트의 마지막 페이지가 이것이다.**
//
// 기획 3.2 는 총평을 맨 앞에 뒀는데 뒤집었다(설계 §1 "총평은 마지막이다", 2026-09-26 사용자 결정).
// 두 가지가 달라진다:
//   1. 맨 앞의 총평은 아직 아무것도 읽지 않은 사람에게 결론을 먼저 던져 읽을 이유를 없앤다.
//   2. 뒤에 두면 총평이 **본문을 근거로** 쓸 수 있다. 골격 단계에서 예측으로 쓰는 것보다 정확하다.
//
// 그래서 입력이 `outline.thesis`(예측)가 아니라 **각 섹션이 실제로 쓴 `summary`** 다. 본문 전문은
// 넘기지 않는다 — 2단이 앞 섹션 전문 없이도 됐던 것과 같은 이유고, 10섹션 전문을 넘기면 이 한 번
// 호출이 리포트에서 제일 비싼 호출이 된다.
//
// 사용자가 이미지 페이지를 보는 동안 만들면 되므로 **지연이 보이지 않는다**(§6).
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic } from "@/lib/anthropic";
import type { SajuProduct } from "@/lib/saju/products";
import type { SajuAnswer } from "./answer";
import type { SajuChart } from "./chart";
import { SAJU_TEXT_MODEL, buildSystemBlock } from "./outline";
import type { SajuSection } from "./section";

export type SajuClosing = {
  title: string;
  /** 리포트 전체의 결론. 섹션들이 실제로 한 말을 받아 쓴다. */
  body: string;
  /** 지금부터 할 일 2~3개. 섹션마다 흩어져 있던 행동 가이드를 사용자가 실제로 움직일 수 있는
   *  크기로 추린 것이다 — 10개를 그대로 나열하면 아무것도 안 하게 된다. */
  nextSteps: string[];
};

const CLOSING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body", "next_steps"],
  properties: {
    title: { type: "string", description: "마지막 페이지의 제목. '총평' 이라는 말을 그대로 쓰지 말 것." },
    body: { type: "string", description: "리포트 전체의 결론. 새 근거를 만들지 말고 읽은 것만으로 맺을 것." },
    next_steps: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: { type: "string" },
      description: "지금부터 할 일. 각 한 문장.",
    },
  },
} as const;

export async function generateClosing(args: {
  product: SajuProduct;
  chart: SajuChart;
  sections: SajuSection[];
  /** 사연 답변 장이 **실제로 쓴 것**. 없으면(사연을 안 적었으면) null.
   *
   *  예측이 아니라 실제 본문을 받는다 — 이 파일이 `outline.thesis` 대신 섹션의 `summary` 를
   *  받기로 한 것과 같은 이유다. 총평과 답변은 재료가 겹쳐서(둘 다 섹션 결론을 받아쓴다),
   *  "겹치지 마라"를 프롬프트로만 말하면 걸러낼 장치가 없다. */
  answer: SajuAnswer | null;
  today: Date;
}): Promise<SajuClosing> {
  const { product, chart, sections, answer, today } = args;

  const response = await anthropic.messages.parse({
    model: SAJU_TEXT_MODEL,
    max_tokens: 3000,
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        // 1·2단과 같은 문자열이어야 캐시가 걸린다(§5). 재조립 금지.
        text: buildSystemBlock(product, chart, today),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          "이 리포트를 맺는 마지막 페이지를 써 주세요. 사용자는 아래 섹션들을 **이미 다 읽은 뒤** 이 페이지를 봅니다.",
          "",
          "## 각 섹션이 내린 결론",
          ...sections.map((s, i) => `${i + 1}. ${s.title} — ${s.summary}`),
          "",
          // 여기서 새 근거를 꺼내면 "안 읽은 이야기가 결론에 나오는" 꼴이 된다. 총평을 뒤로 옮긴
          // 이유가 본문을 근거로 쓰게 하려는 것이므로, 본문 밖으로 나가면 그 이유가 사라진다.
          // 답변 장이 있으면 그 본문을 보여주고 "여기 있는 답은 되풀이하지 마라"고 못 박는다.
          // 안 보여주고 금지만 하면 모델은 무엇을 피해야 하는지 모른다.
          ...(answer
            ? [
                "## 사연 답변 장이 이미 한 말 (되풀이하지 말 것)",
                answer.summary,
                answer.directAnswer,
                "",
              ]
            : []),
          "## 규칙",
          ...(answer
            ? [
                "- 사용자가 남긴 사연에 대한 **직접적인 답은 이미 앞 장에서 했습니다.** 여기서 다시 답하지 말고, 리포트 전체를 관통하는 결론에 집중하세요.",
              ]
            : []),
          "- 위 결론들에서 **반복해서 나타난 것**을 짚어 주세요. 섹션을 순서대로 요약하지 마세요.",
          "- 새로운 궁·십신·시기를 여기서 처음 꺼내지 마세요. 읽은 것만으로 맺습니다.",
          "- 잘 풀리는 이야기만 하지 말고, 조정이 필요한 지점도 한 번은 짚어 주세요.",
          "- 단정하지 말고 조건과 구간으로 말하세요.",
        ].join("\n"),
      },
    ],
    output_config: { format: jsonSchemaOutputFormat(CLOSING_SCHEMA) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("CLOSING_PARSE_FAILED");
  return { title: parsed.title, body: parsed.body, nextSteps: parsed.next_steps };
}
