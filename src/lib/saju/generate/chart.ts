// 유료 사주 상품 한 편이 쓰는 "명반 근거"를 한 덩어리로 모은다.
//
// 새로 계산하는 건 없다. 타로가 쓰는 계산 함수 네 개(원국 둘 + 시간축 둘)를 모드에 맞게 골라
// 붙이는 일이다 — doc/사주_구현설계.md §4 "새로 구현할 알고리즘은 없다".
//
// 왜 별도 파일인가: 이 블록은 1단(골격)·2단(섹션)·3단(총평)이 **전부 같은 문자열로** 받아야 한다.
// 프롬프트 캐시가 시스템 블록 prefix 일치로 걸리기 때문에(§5 캐시), 단계마다 다시 만들면서 공백
// 하나라도 달라지면 섹션 10회 호출이 캐시를 통째로 놓친다.
//
// ── 두 사람 (2026-09-26) ────────────────────────────────────────────────────
// `needsPartner: true` 상품이 19개 중 10개다. 예전엔 이 계층이 **한 사람만** 받아서 그 10개는
// 계산부터 성립하지 않았다. 사람 한 명분을 `SajuPersonChart` 로 묶고 `SajuChart` 가 둘을 든다 —
// 필드를 여덟 개로 늘리지 않은 이유는, 그러면 모든 호출부가 필드마다 "이게 누구 것인지"를 매번
// 따져야 하기 때문이다.
import type { BirthInfo } from "@/lib/tarot/birthInfo";
import { calculateSaju, buildSajuPromptBlock, type SajuResult } from "@/lib/saju/calculate";
import {
  calculateSajuFortune,
  buildSajuFortunePromptBlock,
  type SajuFortune,
} from "@/lib/saju/fortune";
import { calculateZiwei, buildZiweiPromptBlock, type ZiweiResult } from "@/lib/ziwei/calculate";
import {
  calculateZiweiHoroscope,
  buildZiweiHoroscopePromptBlock,
  type ZiweiHoroscope,
} from "@/lib/ziwei/horoscope";
import { whyUnsellable, type SajuMode } from "@/lib/saju/sellability";

// 판매 제약은 의존성 없는 잎 모듈로 떼어 두었다 — 구매 화면이 이 판정을 쓰는데, 여기서 직접
// 가져가면 `manseryeok`·`iztro` 가 클라이언트 번들에 딸려 들어간다(그 파일 머리말). 기존 import
// 경로를 살려 두려고 여기서 다시 내보낸다. **규칙은 여전히 한 곳이다.**
export { whyUnsellable };
export type { SajuMode };

/** 사람 한 명분의 명반. 모드가 고르지 않은 체계는 null 이다. */
export type SajuPersonChart = {
  saju: SajuResult | null;
  sajuFortune: SajuFortune | null;
  ziwei: ZiweiResult | null;
  ziweiHoroscope: ZiweiHoroscope | null;
};

export type SajuChart = {
  mode: SajuMode;
  /** 구매자 본인. */
  self: SajuPersonChart;
  /** 궁합 상품(`needsPartner: true`)만 값이 있다. 나머지는 null. */
  partner: SajuPersonChart | null;
};

/** `calculateChart` 에 넘기는 상대방 정보. `required` 를 따로 받는 이유는, 이 계층이 상품 정의를
 *  모르기 때문이다 — "상대가 안 들어온 것"이 **상대가 필요 없는 상품이라서인지 빠뜨린 것인지**를
 *  가릴 수 있어야 §9("계산 실패 → 전액 환불")로 보낼지 정할 수 있다. */
export type PartnerChartInput = {
  /** `SajuProduct.needsPartner` 를 그대로 넘긴다. */
  required: boolean;
  birthInfo: BirthInfo | null;
};

function calculatePerson(birthInfo: BirthInfo, mode: SajuMode, today: Date): SajuPersonChart | null {
  const needsSaju = mode === "saju" || mode === "integrated";
  const needsZiwei = mode === "ziwei" || mode === "integrated";

  const saju = needsSaju ? calculateSaju(birthInfo) : null;
  const ziwei = needsZiwei ? calculateZiwei(birthInfo) : null;
  if (needsSaju && !saju) return null;
  if (needsZiwei && !ziwei) return null;

  // 시간축은 없어도 리포트가 성립한다(원국만으로도 해석이 된다). 그래서 실패를 치명으로 보지
  // 않고 null 로 두고 넘어간다 — 대신 아래 블록에서 그 사실이 프롬프트에 드러난다.
  return {
    saju,
    sajuFortune: needsSaju ? calculateSajuFortune(birthInfo, today) : null,
    ziwei,
    ziweiHoroscope: needsZiwei ? calculateZiweiHoroscope(birthInfo, today) : null,
  };
}

/** 모드에 필요한 계산만 돌린다. 팔 수 없는 조합이거나 계산이 실패하면 null —
 *  호출자는 생성을 시작하지 말고 전액 환불로 보내야 한다(§9 "계산 실패").
 *
 *  **상대방에게도 `whyUnsellable` 을 건다.** 궁합 상품에서 상대의 시진이 틀리면 상대의 명궁이
 *  통째로 다른 궁으로 가고, 그러면 리포트 절반이 다른 사람 얘기가 된다 — 내담자 쪽과 똑같은
 *  이유다. 구매 화면도 같은 검사를 하지만 API 를 직접 두드리면 그건 우회된다.
 *
 *  `partner` 를 생략하면 지금까지와 똑같이 한 사람분만 계산한다 — 상대가 필요 없는 상품 9개의
 *  호출은 한 글자도 바뀌지 않는다. */
export function calculateChart(
  birthInfo: BirthInfo,
  mode: SajuMode,
  today: Date,
  partner?: PartnerChartInput | null
): SajuChart | null {
  if (whyUnsellable(birthInfo, mode)) return null;

  const self = calculatePerson(birthInfo, mode, today);
  if (!self) return null;

  if (!partner?.required) return { mode, self, partner: null };

  // 상대가 필요한 상품인데 상대가 없다. 여기서 멈춘다 — 이 상태로 생성을 시작하면 두 사람
  // 얘기를 하기로 하고 판 리포트가 한 사람 얘기로 나온다.
  if (!partner.birthInfo) return null;
  if (whyUnsellable(partner.birthInfo, mode)) return null;

  const partnerChart = calculatePerson(partner.birthInfo, mode, today);
  if (!partnerChart) return null;

  return { mode, self, partner: partnerChart };
}

/** 사람 한 명분의 `##` 절들. 모드가 고르지 않은 체계는 아예 등장하지 않는다 — 단일 모드에서
 *  선택 안 한 체계를 넘기면 모델이 그걸 근거로 써 버린다(기획 3.1). */
function buildPersonBlock(person: SajuPersonChart, today: Date): string[] {
  const parts: string[] = [];

  if (person.saju) {
    parts.push(`## 사주 원국\n${buildSajuPromptBlock(person.saju)}`);
    if (person.sajuFortune) {
      parts.push(`## 사주 시간축\n${buildSajuFortunePromptBlock(person.sajuFortune, today)}`);
    }
  }

  if (person.ziwei) {
    parts.push(`## 자미두수 명반\n${buildZiweiPromptBlock(person.ziwei)}`);
    if (person.ziweiHoroscope) {
      parts.push(
        `## 자미두수 시간축\n${buildZiweiHoroscopePromptBlock(person.ziweiHoroscope, today)}`
      );
    }
  }

  return parts;
}

/** 프롬프트에 꽂을 명반 근거 블록.
 *
 *  ⚠️ **1·2·3단이 바이트 단위로 같은 문자열을 받아야 캐시가 걸린다**(§5). 상대가 없는 상품의
 *  출력은 두 사람 지원이 들어오기 전과 **한 글자도 다르지 않다** — 사람 머리말(`# 내담자`)은
 *  상대가 있을 때만 붙는다. 한 명뿐인데 "내담자"라고 이름표를 달면 가리킬 대상이 하나뿐이라
 *  의미도 없고, 9개 상품의 캐시만 깨진다. */
export function buildChartBlock(chart: SajuChart, today: Date): string {
  const parts: string[] = chart.partner
    ? [
        `# 내담자\n${buildPersonBlock(chart.self, today).join("\n\n")}`,
        `# 상대방\n${buildPersonBlock(chart.partner, today).join("\n\n")}`,
      ]
    : buildPersonBlock(chart.self, today);

  // 나이를 두 체계 나란히 적지 말라는 경고를 프롬프트에도 박는다(§4). 같은 사람이라도 사주 대운은
  // 3세, 자미두수 대한은 6세 시작으로 나오는데, 모델이 그 둘을 "3~6세"처럼 묶어 쓰면 사용자는
  // 버그로 읽는다. 화면 규칙만으로는 본문 문장을 막을 수 없어서 여기서도 말한다.
  if (chart.self.saju && chart.self.ziwei) {
    parts.push(
      "## 두 체계를 함께 쓸 때\n" +
        "- 사주의 대운과 자미두수의 대한은 시작 나이가 서로 다르다. 정상이다. 두 나이를 나란히 적거나 하나로 합치지 말 것.\n" +
        "- 시기를 말할 때는 단일 날짜로 단정하지 말고 구간과 조건으로 쓸 것."
    );
  }

  // 위 경고와 같은 자리에 두는 "누구 것인지" 규칙. 두 명반이 한 프롬프트에 들어가면 모델이
  // 섞는다 — 그러면 상대 얘기를 내담자 얘기로 쓰는 리포트가 나오고, 그건 사용자가 읽는 순간
  // 알아차리는 종류의 사고다.
  if (chart.partner) {
    parts.push(
      "## 두 사람을 함께 쓸 때\n" +
        "- 위 `# 내담자` 와 `# 상대방` 은 서로 다른 사람의 명반이다. 근거를 인용할 때 **누구의 것인지 반드시 밝힐 것.**\n" +
        "- 한쪽에만 있는 글자·별을 두 사람 공통의 것처럼 쓰지 말 것.\n" +
        "- 상대방의 명반은 **관계 안에서의 상대**를 읽는 데 쓴다. 상대 개인의 운·수명·건강을 단정하지 말 것.\n" +
        "- 읽는 사람은 내담자 한 명이다. 상대에게 말을 거는 문장을 쓰지 말 것."
    );
  }

  return parts.join("\n\n");
}
