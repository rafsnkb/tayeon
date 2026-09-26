// 2단 — 섹션 본문. 섹션 수만큼 부르고, **순차로** 부른다.
//
// 순차인 이유는 doc/사주_구현설계.md §5 의 실측이다. 병렬로 돌리면 섹션끼리 서로 뭘 썼는지 몰라
// 해요체 유지가 46% 까지 떨어졌는데, 앞 섹션이 쓴 것을 넘겨주니 70% 가 됐다. 원가는 194 → 197원으로
// 3원 올랐을 뿐이고 **첫 페이지까지 걸리는 시간은 오히려 줄었다**(46초 → 42초) — 사용자는 전체가
// 아니라 1페이지를 기다리기 때문이다.
//
// 앞 섹션의 **전문을 넘기지 않는다.** 제목·첫 문장·쓴 종결어미만 넘긴다(그래서 입력 증가가 미미하다).
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { anthropic } from "@/lib/anthropic";
import type { SajuProduct } from "@/lib/saju/products";
import type { SajuChart } from "./chart";
import { SAJU_TEXT_MODEL, buildSystemBlock, type SajuOutline } from "./outline";

/** 통합 분석의 일치 상태. 기획 2.2 가 정한 **다섯 개뿐**이고 새로 만들지 않는다.
 *  `87% 일치` 같은 수치 표현을 쓰지 않기로 한 자리라, 여기서 문구가 늘어나면 그 결정이 깨진다. */
export const CROSS_STATUSES = [
  "두 분석 모두 강하게 나타남",
  "두 분석에서 비슷한 흐름",
  "시기는 다르지만 방향은 일치",
  "한 분석이 보완함",
  "서로 다른 관점",
] as const;
export type CrossStatus = (typeof CROSS_STATUSES)[number];

/** 한 페이지의 본문. 통합 모드는 5단을 모두 쓰고, 단일 모드는 선택 안 한 체계의 근거와
 *  교차 분석을 비운다(기획 3.1). */
export type SajuSection = {
  id: string;
  title: string;
  /** 5단 중 1 — 가장 먼저 읽는 한두 문장의 직접 답변. 3단(총평)이 이것들만 받아서 쓴다. */
  summary: string;
  sajuBasis: string;
  ziweiBasis: string;
  crossStatus: CrossStatus | null;
  crossSummary: string;
  actionGuide: string;
};

/** 다음 섹션에게 넘길 "앞에서 이미 쓴 것". 전문 대신 이것만 넘긴다. */
export type SectionEcho = {
  title: string;
  firstSentence: string;
  /** 이 섹션이 쓴 종결어미들(`~해요`, `~거든요` …). 같은 어미가 반복되는 걸 막는 근거다. */
  endings: string[];
};

const SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "saju_basis", "ziwei_basis", "cross_status", "cross_summary", "action_guide"],
  properties: {
    title: {
      type: "string",
      description:
        "이 페이지의 소제목. 주어진 섹션 제목을 그대로 되풀이하지 말 것 — 그러면 '관계 발전의 흐름: 천천히 쌓여…' 같은 꼴이 된다.",
    },
    summary: { type: "string", description: "종합 결론. 한두 문장으로 질문에 바로 답한다." },
    saju_basis: { type: "string", description: "사주 근거. 사주를 쓰지 않는 모드면 빈 문자열." },
    ziwei_basis: { type: "string", description: "자미두수 근거. 자미두수를 쓰지 않는 모드면 빈 문자열." },
    cross_status: {
      type: ["string", "null"],
      enum: [...CROSS_STATUSES, null],
      description: "통합 모드에서만 채운다. 주어진 다섯 개 중 하나를 그대로 쓸 것. 단일 모드면 null.",
    },
    cross_summary: { type: "string", description: "교차 분석의 짧은 근거. 단일 모드면 빈 문자열." },
    action_guide: { type: "string", description: "지금 할 수 있는 준비·대화·점검 제안." },
  },
} as const;

export async function generateSection(args: {
  product: SajuProduct;
  chart: SajuChart;
  outline: SajuOutline;
  /** 이번에 쓸 섹션의 인덱스(0부터). */
  index: number;
  /** 0..index-1 섹션이 실제로 쓴 것. 첫 섹션이면 빈 배열. */
  written: SectionEcho[];
  userInput: string;
  today: Date;
}): Promise<SajuSection> {
  const { product, chart, outline, index, written, userInput, today } = args;
  const plan = outline.sections[index];
  const defined = product.sections[index];
  if (!plan || !defined) throw new Error(`SECTION_OUT_OF_RANGE:${index}`);

  const integrated = chart.mode === "integrated";

  const alreadyWritten = written.length
    ? [
        "## 앞에서 이미 쓴 것 (되풀이하지 말 것)",
        ...written.map(
          (w, i) => `${i + 1}. ${w.title} — "${w.firstSentence}" (쓴 어미: ${w.endings.join(", ")})`
        ),
        "",
        // 어미를 **금지 목록**으로 주면 모델이 목록을 피하려고 해요체를 통째로 버리고 문어체로
        // 도망간다(§5 주의 2, 실측에서 해요체 0% 가 나왔다). 그래서 "피하라"가 아니라 "굴려라"다.
        "위에 쓴 종결어미가 또 나오지 않게 **해요체 안에서** 다르게 굴려 주세요. 해요체를 벗어나지는 마세요.",
      ].join("\n")
    : "";

  const response = await anthropic.messages.parse({
    model: SAJU_TEXT_MODEL,
    max_tokens: 4000,
    thinking: { type: "disabled" },
    system: [
      {
        type: "text",
        // 1단과 **똑같은 문자열**이어야 캐시가 걸린다. 여기서 다시 조립하지 말고 같은 함수를 쓴다.
        text: buildSystemBlock(product, chart, today),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          `## 이번에 쓸 섹션\n${defined.title}`,
          `요지: ${plan.gist}`,
          plan.sajuBasis ? `배정된 사주 근거: ${plan.sajuBasis}` : "",
          plan.ziweiBasis ? `배정된 자미두수 근거: ${plan.ziweiBasis}` : "",
          "",
          // 배정을 "참고"로 주면 모델이 무시하고 편한 궁 하나로 돌아간다(1단 실측과 같은 이유).
          "배정된 근거를 쓰세요. 다른 궁·십신으로 갈아타지 마세요 — 다른 섹션이 쓸 것입니다.",
          integrated
            ? `\ncross_status 는 다음 다섯 중 하나를 **그대로** 쓰세요: ${CROSS_STATUSES.join(" / ")}`
            : "\n이 리포트는 단일 모드입니다. cross_status 는 null, cross_summary 는 빈 문자열로 두세요.",
          outline.usedMetaphors.length
            ? `\n이미 쓴 비유(다시 쓰지 말 것): ${outline.usedMetaphors.join(", ")}`
            : "",
          alreadyWritten ? `\n${alreadyWritten}` : "",
          userInput.trim() ? `\n## 사용자가 적은 사연\n${userInput.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    output_config: { format: jsonSchemaOutputFormat(SECTION_SCHEMA) },
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`SECTION_PARSE_FAILED:${defined.id}`);

  // 단일 모드에서 모델이 교차 분석을 채워 보내면 버린다. 프롬프트로 막고 있지만, 화면이
  // "통합 모드에서만 보이는 블록"을 데이터 유무로 판단하므로 여기서 한 번 더 자른다.
  return {
    id: defined.id,
    title: parsed.title,
    summary: parsed.summary,
    sajuBasis: chart.self.saju ? parsed.saju_basis : "",
    ziweiBasis: chart.self.ziwei ? parsed.ziwei_basis : "",
    crossStatus: integrated ? (parsed.cross_status as CrossStatus | null) : null,
    crossSummary: integrated ? parsed.cross_summary : "",
    actionGuide: parsed.action_guide,
  };
}

/** 다음 섹션에게 넘길 요약을 만든다. 전문이 아니라 제목·첫 문장·종결어미만 간다. */
export function echoOf(section: SajuSection): SectionEcho {
  const body = `${section.summary} ${section.sajuBasis} ${section.ziweiBasis} ${section.actionGuide}`;
  const firstSentence = section.summary.split(/(?<=[.!?])\s/)[0] ?? section.summary;
  // 해요체 종결어미만 센다. 문장 끝의 `…요.` 앞 두 글자를 어미로 본다 — 형태소 분석까지 갈 일이
  // 아니고, 목적이 "같은 어미가 반복되는가"를 모델에게 보여주는 것뿐이다.
  const endings = [...new Set((body.match(/[가-힣]{2}요[.!?]/g) ?? []).map((m) => m.slice(0, -1)))];
  return { title: section.title, firstSentence, endings: endings.slice(0, 6) };
}
