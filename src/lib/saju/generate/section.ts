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
import type { SajuEndingRegister } from "@/lib/saju/personas";
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
  /** 이 상품의 페르소나가 어떤 문체로 끝맺는가(`personas.ts`). 호출자(`produce.ts`)가
   *  `SAJU_PERSONAS[product.persona].endingRegister` 를 조회해 넘긴다. 기본값(해요체)은
   *  이 인자를 안 넘기는 다른 호출자(테스트 등)를 위한 것이지, 실제 배선을 위한 값이 아니다. */
  endingRegister?: SajuEndingRegister;
}): Promise<SajuSection> {
  const { product, chart, outline, index, written, userInput, today, endingRegister = "formal-yo" } = args;
  const plan = outline.sections[index];
  const defined = product.sections[index];
  if (!plan || !defined) throw new Error(`SECTION_OUT_OF_RANGE:${index}`);

  const integrated = chart.mode === "integrated";

  const alreadyWritten = written.length
    ? [
        "## 앞에서 이미 쓴 것 (되풀이하지 말 것)",
        ...written.map((w, i) => {
          // 이 섹션에서 어미가 하나도 안 잡혔으면 안전망 문구로 대신한다 — "(쓴 어미: )"처럼
          // 빈 목록을 그대로 보여주면 모델이 "이 섹션은 어미가 없었다"로 읽어 아무 도움도
          // 안 된다.
          const endingNote = w.endings.length ? `쓴 어미: ${w.endings.join(", ")}` : GENERIC_VARIETY_HINT;
          return `${i + 1}. ${w.title} — "${w.firstSentence}" (${endingNote})`;
        }),
        "",
        VARY_WITHIN_REGISTER[endingRegister],
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
          // 2026-09-27. 목업을 경쟁 서비스(사주담)와 대조해 보니 우리 한 장(936자, life-overview
          // 통합 기준)이 사주담 한 장(574자)과 비슷한 글자 수인데도 더 얇게 느껴졌다 — 사주담은
          // 그 글자를 체계 하나에 다 쓰고 우리는 5개 필드(요지·사주근거·자미근거·교차·행동가이드)
          // 로 쪼개기 때문이다. **글자 수를 못 박지 않는다**(모델이 수를 채우려고 내용을 억지로
          // 늘리는 부작용을 실측한 적이 없다) — 대신 "한 문장으로 끝내지 말라"는 행동 지시로 간다.
          // 문장을 짧게 쓰는 페르소나(어린아이 말투·격식체 간결)와도 안 부딪힌다 — 그 페르소나들은
          // 이미 "짧은 문장을 여러 개 이어 쓰라"고 정리돼 있다(personas.ts, 2026-09-27).
          "사주 근거·자미두수 근거·행동 가이드를 쓸 때 한 문장으로 끝내지 마세요. 왜 그렇게 읽히는지, 어떤 맥락에서 그런지까지 풀어서 쓰세요. 문장을 짧게 쓰는 문체라도 다르지 않습니다 — 짧은 문장을 여러 개 이어서 같은 만큼 풀어내세요.",
          // 2026-09-27. `outline.thesis` 가 이제껏 여기 안 들어가고 있었다 — 1단이 섹션마다
          // 다른 근거를 배정하게 하는 내부 기준으로만 쓰이고, 정작 섹션 본문을 쓰는 이 프롬프트는
          // 그걸 몰랐다. 사주담 대조에서 배운 것: 어미 반복은 막되(echoOf) 결론은 관통시켜야
          // 한다(핵심 문구를 편마다 일부러 반복하는 패턴). 그래서 이 둘을 **분명히 구분**해서
          // 지시한다 — 반복해도 되는 건 결론의 방향, 반복하면 안 되는 건 표현·어미다.
          outline.thesis.trim()
            ? `\n## 이 리포트가 관통해야 할 결론\n${outline.thesis}\n이 결론을 이 섹션에서도 다른 각도로 뒷받침하세요 — 섹션마다 근거는 다르지만 결국 같은 결론을 향해야 합니다. 앞에서 이미 나온 내용을 "앞서 짚었듯" 정도로 자연스럽게 가리켜도 좋습니다. 다만 이건 문장·어미를 반복하라는 뜻이 아닙니다 — 반복해도 되는 것은 결론의 방향이고, 반복하면 안 되는 것은 표현입니다(어미 반복 방지는 위 "앞에서 이미 쓴 것"이 따로 관리합니다).`
            : "",
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

/**
 * 레지스터별 종결어미 정규식. 페르소나(`personas.ts`, 10종)마다 만들지 않고
 * **레지스터 셋 3개**로 묶었다 — 페르소나가 늘어도 정규식은 늘지 않는다.
 *
 * 전부 "좁게 잡는다"는 같은 원칙이다. 놓친 어미는 `echoOf` 호출자 쪽의 일반 안내
 * ("표현을 다양하게 굴려 주세요" 식)가 안전망으로 받고(§5 처방 ④), 잘못 넓혀서 명사를 어미로
 * 잡는 것보다 그쪽이 낫다 — 없는 어미를 "피하라"고 모델에게 거짓 정보를 주는 게 더 나쁘다.
 *
 * - `formal-yo`(해요체): 기존 그대로 — `[가-힣]{2}요`. 실측으로 이미 검증됨(§5, 46%→70%).
 * - `formal-hamnida`(격식체): 앵커가 `다` 한 글자가 아니라 **`니다` 두 글자**다. `다` 한 글자만
 *   쓰면 "필요하다"·"좋다"처럼 문어체·평서문(격식체가 아니다)까지 격식체 어미로 잘못 잡는다.
 *   `니다`는 합쇼체 종결(`합니다`·`습니다`·`됩니다`)에서만 나와서 안전하다. 앞자리는 `{0,2}`로
 *   느슨하게 뒀다 — `{2}`로 고정하면 "합니다."·"됩니다." 처럼 앞 글자가 하나뿐인 흔한 짧은
 *   어미까지 놓친다(앵커 `니다` 자체가 판별 근거라 앞자리를 늘려도 새 오탐이 생기지 않는다).
 * - `banmal`(반말): 가장 좁게 잡았다. `거든`·`잖아`·`더라` **세 개만** 앵커로 쓴다. 한 글자짜리
 *   어미(`야`·`지`·`네`)는 그 글자로 끝나는 일반 명사와 구분이 안 된다 — "편지."가 `지`로 끝나는
 *   반말 어미로 잘못 잡히는 식이다(§5 "형태소 분석까지 갈 일이 아니다"의 반대 극단). `~야.`·
 *   `~어.` 같은 흔한 반말 어미를 놓치는 대가를 감수한다 — 19개 중 8개가 반말 페르소나다
 *   (`witty-bestie`·`warm-romantic-friend`·`honest-confidante`·`fair-mediator`). 실호출
 *   데이터가 쌓이면 이 표가 충분히 넓은지 다시 볼 것.
 */
const ENDING_PATTERNS: Record<SajuEndingRegister, RegExp> = {
  "formal-yo": /[가-힣]{2}요[.!?]/g,
  "formal-hamnida": /[가-힣]{0,2}니다[.!?]/g,
  banmal: /[가-힣]{0,2}(?:거든|잖아|더라)[.!?]/g,
};

/** "어미를 유지하되 그 안에서 굴려라" 지시문, 레지스터별. 금지 목록이 아니라 유지+변주로
 *  쓴다 — 안 그러면 모델이 그 레지스터를 통째로 버리고 도망간다(§5 주의 2, 해요체 0% 실측). */
const VARY_WITHIN_REGISTER: Record<SajuEndingRegister, string> = {
  "formal-yo": "위에 쓴 종결어미가 또 나오지 않게 **해요체 안에서** 다르게 굴려 주세요. 해요체를 벗어나지는 마세요.",
  "formal-hamnida":
    "위에 쓴 종결어미가 또 나오지 않게 **격식체(~합니다) 안에서** 다르게 굴려 주세요. 격식체를 벗어나지는 마세요.",
  banmal: "위에 쓴 종결어미가 또 나오지 않게 **반말 안에서** 다르게 굴려 주세요. 반말을 벗어나지는 마세요.",
};

/** 앞 섹션에서 어미가 하나도 안 잡혔을 때 쓰는 안전망. `ENDING_PATTERNS` 가 좁아서 못 잡은
 *  것일 수도, 실제로 그 섹션이 아무 종결어미도 안 썼을 수도 있다 — 어느 쪽이든 "다양하게
 *  쓰라"는 일반 지시는 안전하다. 구체적 어미 목록을 보여준 것만큼 효과가 있다는 근거는 없다
 *  (§5 가 측정한 건 구체적 어미를 보여준 효과이지 일반 지시의 효과가 아니다) — 그래도 아무
 *  지시가 없는 것보다는 낫다. */
const GENERIC_VARIETY_HINT = "표현이 단조롭지 않게 문장 끝을 다양하게 써 주세요.";

/** 다음 섹션에게 넘길 요약을 만든다. 전문이 아니라 제목·첫 문장·종결어미만 간다.
 *
 *  `register` 는 이 상품의 페르소나가 어떤 문체로 끝맺는지다(`personas.ts` 의
 *  `SajuPersona.endingRegister`). **`produce.ts` 가 실제로 넘긴다** — 기본값 `formal-yo` 는
 *  이제 테스트 편의용일 뿐이고, 생성 경로는 이 인자를 빼놓지 않는다. 기본값에 기대는 새
 *  호출부를 만들지 말 것: 반말·격식체 상품 10개에서 조용히 해요체 정규식이 돌게 된다. */
export function echoOf(section: SajuSection, register: SajuEndingRegister = "formal-yo"): SectionEcho {
  const body = `${section.summary} ${section.sajuBasis} ${section.ziweiBasis} ${section.actionGuide}`;
  const firstSentence = section.summary.split(/(?<=[.!?])\s/)[0] ?? section.summary;
  const endings = [...new Set((body.match(ENDING_PATTERNS[register]) ?? []).map((m) => m.slice(0, -1)))];
  return { title: section.title, firstSentence, endings: endings.slice(0, 6) };
}
