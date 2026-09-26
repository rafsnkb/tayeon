// 저장된 리포트를 **화면에 내보낼 모양**으로 줄인다.
//
// 저장 문서를 그대로 `NextResponse.json` 에 넣지 않는 이유가 세 가지 있고, 전부 실제 문제다.
//
// 1. **`outline.thesis` 는 화면에 절대 노출하지 않는다**(§1 "총평은 마지막이다"). 이건 1단이
//    만드는 **내부 기준**이고 사용자가 읽는 총평은 3단의 `closing` 이다. 응답 JSON 에 그냥
//    실으면 화면에 안 그려도 **네트워크 탭에 그대로 보인다** — "노출 안 함"이 지켜지지 않는다.
//    돈 받고 파는 결론을 마지막 페이지에 두기로 한 결정이, 개발자 도구를 여는 순간 무너진다.
// 2. **`chart` 원본은 여전히 안 나간다** — 계산 결과 원본이라 크다(§7). ⚠️ **2026-09-26 사용자
//    결정으로 전제가 바뀌었다**: "명식(사주 기둥·자미두수)을 뷰어에 보여주자, 다른 운세
//    서비스들도 다 한다" — 그래서 **원본이 아니라 표시용 부분집합**(`SajuChartView`, 아래)을
//    내보낸다. 원본을 그대로 스프레드하면 화면이 보면 안 되는 값이 새므로(`SajuReadingPageView` 주석)
//    같은 사고가 난다. **2026-09-27 에 한 번 더 바뀌었다**: 처음엔 원국(사주 기둥·자미두수
//    명반)만 내보내고 `sajuFortune`·`ziweiHoroscope`(대운·세운·유년 등 시간축)는 "파생 계산
//    이라 크다"며 뺐는데, `buildChartBlock`(chart.ts)이 **모델에는 이미 그 시간축을 주고
//    있었다** — 화면만 못 받는 상태였다. 목업(life-overview 4~9장, 생애주기)이 전부 그
//    시간축 얘기인데 근거 칸이 비는 걸 보고서야 드러났다. 그래서 시간축도 `SajuFortuneView`·
//    `ZiweiHoroscopeView` 로 표시용 부분집합을 만들어 내보낸다(원본과 달리 여기 둘은 원본
//    전체가 이미 모델이 쓰는 값과 같아서 빠지는 필드가 없다 — 그래도 원본 타입을 그대로
//    export 하지 않는 이유는 위와 같다).
// 3. **`paymentId` 는 화면이 쓸 일이 없다.** 결제 식별자를 필요도 없는데 클라이언트로 내보내지
//    않는다.
//
// 그래서 "빼는 목록"이 아니라 **"내보낼 목록"** 으로 짰다. 빼는 목록은 §7 에 필드가 하나 늘 때
// 조용히 새지만, 내보낼 목록은 명시하지 않으면 안 나간다.
import type { SajuClosing } from "@/lib/saju/generate/closing";
import type { SajuChart, SajuMode, SajuPersonChart } from "@/lib/saju/generate/chart";
import type { SajuResult } from "@/lib/saju/calculate";
import type { SajuFortune } from "@/lib/saju/fortune";
import type { ZiweiResult } from "@/lib/ziwei/calculate";
import type { ZiweiHoroscope } from "@/lib/ziwei/horoscope";
import type { SajuProduct } from "@/lib/saju/products";
import type { SajuReading, SajuReadingImage, SajuReadingPage, SajuReadingStatus } from "@/lib/saju/storage";

/** 0페이지(목차)가 그리는 한 줄.
 *
 *  제목은 **상품**에서, 요지는 **골격**에서 온다. 골격의 `OutlineSection` 에는 제목이 없다 —
 *  2단도 `product.sections[i].title` 을 쓰므로 여기서 다른 데서 가져오면 목차와 본문의 제목이
 *  갈라진다.
 *
 *  골격의 `sajuBasis`·`ziweiBasis` 는 내보내지 않는다. 어느 궁·십신을 어느 섹션에 배정했는지는
 *  생성을 위한 내부 배정이고, 사용자는 본문에서 그 근거를 **문장으로** 읽는다. */
export type OutlineEntry = { title: string; gist: string };

/** `Omit` 을 유니온의 **각 갈래마다** 적용한다. `SajuReadingPage` 가 `kind` 로 갈리는 판별
 *  유니온인데, `Omit<A | B, K>` 를 그냥 쓰면 TypeScript 가 분배하지 않고 `A`·`B` 공통 키만
 *  남겨 `kind: "failed"` 전용 필드(`attempts`)와 `kind: "section"` 전용 필드(본문)가 통째로
 *  사라진다 — 판별 유니온이 평평한 객체 타입으로 무너진다. `extends unknown` 조건부 타입이
 *  분배를 강제한다. */

/** 화면에 내보내는 페이지 모양. 지금은 저장 문서(`SajuReadingPage`)와 같다 — 2026-09-27 에
 *  만료 필드가 없어지면서 뺄 것이 사라졌다. 타입을 남겨 두는 이유는 **경계를 남기려는 것**이다:
 *  저장 문서에 화면이 보면 안 되는 필드가 다시 생기면 여기서 빼면 되고, 화면 코드는 이 이름을
 *  계속 가리키므로 안 고쳐도 된다. */
export type SajuReadingPageView = SajuReadingPage;

/** 사주 명식 표시용 — `SajuResult` 원본에서 화면이 실제로 그리는 것만 남긴다. 원본 타입을
 *  그대로 `export` 해 버리면 `calculate.ts` 가 필드를 늘렸을 때 여기가 조용히 따라 늘어난다 —
 *  이 파일의 "안 늘어놓기" 원칙(위 머리말)을 명식에도 적용해 별도 타입으로 못박는다.
 *  `timeUnknown` 은 뺀다 — 화면은 `pillars.hour === null` 로 이미 같은 사실을 안다, 값 하나를
 *  두 가지 이름으로 들고 있을 이유가 없다.
 *
 *  `specialStars`·`elementCounts` 는 2026-09-27 추가다(사용자 승인 — "신살은 내용 해석에
 *  필요하면 해"). 모델이 받는 값(`buildSajuPromptBlock`)과 정확히 같은 모양이라 빠지는
 *  필드가 없다. */
export type SajuPillarView = {
  pillars: SajuResult["pillars"];
  tenGods: SajuResult["tenGods"];
  voidBranches: string[];
  specialStars: SajuResult["specialStars"];
  elementCounts: SajuResult["elementCounts"];
};

/** 자미두수 명반 표시용 — `ZiweiResult` 에서 실제로 해석에 쓰는 것만 남긴다. `sign`·`zodiac`
 *  은 뺐다 — 계산은 되지만 `buildZiweiPromptBlock`(모델이 실제로 받는 근거)이 쓰지 않는 값이라,
 *  화면에 내보내면 "이 정보로 해석했다"는 거짓 신뢰를 준다. */
export type ZiweiChartView = {
  soul: string;
  body: string;
  fiveElementsClass: string;
  palaces: ZiweiResult["palaces"];
};

/** 사주 시간축(대운·세운·월운) 표시용 — `SajuFortune` 원본에서 화면이 실제로 그리는 것만
 *  남긴다. **원본 전체가 이미 `buildSajuFortunePromptBlock` 이 쓰는 값과 같다**(파생 필드가
 *  없다) — 그래도 원본 타입을 그대로 `export` 하지 않는 이유는 `SajuPillarView` 와 같다:
 *  `fortune.ts` 가 나중에 표시용이 아닌 필드를 늘리면 여기가 조용히 따라 늘어나면 안 된다.
 *
 *  ⚠️ **2026-09-27 추가 — 전제가 바뀐 두 번째 필드다.** `SajuChartView` 를 처음 만들 때는
 *  "화면엔 원국만, 시간축은 프롬프트 전용"이었는데, life-overview 목업의 생애주기 6개 장이
 *  전부 대운·대한·유년 얘기인데 근거 칸이 빈 채로 나온 걸 보고 뒤집혔다 — 모델은 이미
 *  `buildChartBlock`(chart.ts)을 통해 이 값을 받고 있었으니, 화면만 못 받던 상태였다. */
export type SajuFortuneView = {
  luck: SajuFortune["luck"];
  annual: SajuFortune["annual"];
  monthly: SajuFortune["monthly"];
};

/** 자미두수 시간축(대한·유년·사화) 표시용 — 같은 이유로 `ZiweiHoroscope` 를 그대로 안 쓴다.
 *  이쪽도 원본 전체가 `buildZiweiHoroscopePromptBlock` 이 쓰는 값과 같다. */
export type ZiweiHoroscopeCycleView = { stem: string; branch: string; palaceNames: string[]; mutagen: string[] };
export type ZiweiHoroscopeView = {
  decadal: ZiweiHoroscopeCycleView;
  yearly: ZiweiHoroscopeCycleView;
};

/** 한 사람분의 명식(원국 + 시간축). 모드가 고르지 않은 체계는 `null` 이다 —
 *  `SajuPersonChart` 와 같은 규칙. `sajuFortune`/`ziweiHoroscope` 도 원국과 **같은 모드
 *  게이트**를 탄다 — 시간축은 원국 위에 얹는 것이라 원국이 없는 체계의 시간축도 없다. */
export type SajuPersonChartView = {
  saju: SajuPillarView | null;
  sajuFortune: SajuFortuneView | null;
  ziwei: ZiweiChartView | null;
  ziweiHoroscope: ZiweiHoroscopeView | null;
};

export type SajuChartView = {
  self: SajuPersonChartView;
  /** 궁합 상품(`needsPartner: true`)만 값이 있다. */
  partner: SajuPersonChartView | null;
};

function toSajuPillarView(saju: SajuResult): SajuPillarView {
  return {
    pillars: saju.pillars,
    tenGods: saju.tenGods,
    voidBranches: saju.voidBranches,
    specialStars: saju.specialStars,
    elementCounts: saju.elementCounts,
  };
}

function toZiweiChartView(ziwei: ZiweiResult): ZiweiChartView {
  return { soul: ziwei.soul, body: ziwei.body, fiveElementsClass: ziwei.fiveElementsClass, palaces: ziwei.palaces };
}

function toSajuFortuneView(fortune: SajuFortune): SajuFortuneView {
  return { luck: fortune.luck, annual: fortune.annual, monthly: fortune.monthly };
}

function toZiweiHoroscopeView(horoscope: ZiweiHoroscope): ZiweiHoroscopeView {
  return { decadal: horoscope.decadal, yearly: horoscope.yearly };
}

/**
 * 한 사람분의 명식을 표시용으로 줄인다. **`mode` 를 여기서 다시 본다** — `person.saju`·
 * `person.ziwei`·`person.sajuFortune`·`person.ziweiHoroscope` 는 `calculatePerson`(chart.ts)
 * 이 이미 모드에 맞지 않는 쪽을 `null` 로 두지만, 그건 계산 계층의 약속이지 이 계층의 방어가
 * 아니다. 사주 단일 상품에서 자미두수 명식(원국이든 시간축이든)이 보이면 안 낸 돈으로 산 값을
 * 보여주는 것과 같다(이용권 게이트 우회와 같은 급의 사고) — 그래서 계산 결과가 어떻든 **여기서도
 * 모드로 한 번 더 막는다**(2026-09-26, `buildSystemBlock` 이 같은 문제로 자기모순이던 걸
 * 프롬프트 쪽에서 고친 것과 짝이다).
 */
function toPersonChartView(person: SajuPersonChart, mode: SajuMode): SajuPersonChartView {
  const wantsSaju = mode === "saju" || mode === "integrated";
  const wantsZiwei = mode === "ziwei" || mode === "integrated";
  return {
    saju: wantsSaju && person.saju ? toSajuPillarView(person.saju) : null,
    sajuFortune: wantsSaju && person.sajuFortune ? toSajuFortuneView(person.sajuFortune) : null,
    ziwei: wantsZiwei && person.ziwei ? toZiweiChartView(person.ziwei) : null,
    ziweiHoroscope: wantsZiwei && person.ziweiHoroscope ? toZiweiHoroscopeView(person.ziweiHoroscope) : null,
  };
}

function toChartView(chart: SajuChart): SajuChartView {
  return {
    self: toPersonChartView(chart.self, chart.mode),
    partner: chart.partner ? toPersonChartView(chart.partner, chart.mode) : null,
  };
}

export type SajuReadingView = {
  id: string;
  productSlug: string;
  mode: SajuMode;
  status: SajuReadingStatus;
  createdAt: string;
  /** 목차. `thesis` 는 여기 포함되지 않는다 — 위 1 참고. */
  outline: OutlineEntry[];
  /** 섹션 총수. 화면이 `outline.length` 로 세지 않게 명시한다 — 목차와 페이지 수가 갈라지면
   *  "다음 페이지가 있는가" 판단이 틀린다. */
  sectionCount: number;
  pages: SajuReadingPageView[];
  closing: SajuClosing | null;
  image: SajuReadingImage | null;
  lastReadPage: number;
  userInput: string;
  /** 명식(사주 기둥·자미두수 + 대운·세운 등 시간축) — 본문이 대는 근거를 독자가 대조할 수
   *  있는 자리(2026-09-26 사용자 결정, "다른 운세 서비스들도 다 보여준다"). 원본이 아니라
   *  위 `SajuChartView` 다. */
  chart: SajuChartView;
  /** 궁합 상품(`needsPartner: true`)에서 상대방을 부르는 이름. 본문이 이미 이 이름으로 상대를
   *  부르므로(`storage.ts` 의 `SajuPartnerSnapshot` 주석) 명식 카드도 같은 이름을 써야 "나"와
   *  "상대방" 을 구분해서 보여줄 수 있다. 상대가 없는 상품은 `null`. */
  partnerNickname: string | null;
};

/**
 * `product` 가 `undefined` 일 수 있다 — 상품이 레지스트리에서 빠졌는데 그 상품으로 팔린
 * 리포트가 남은 경우다. 이미 돈을 받은 결과물이라 **읽기는 막지 않는다.** 상품에서 오는 건
 * 섹션 제목뿐이고 본문은 문서에 얼려 있으므로, 제목만 골격의 요지로 대신하면 읽힌다.
 */
export function toReadingView(
  reading: SajuReading,
  pages: SajuReadingPage[],
  product: SajuProduct | undefined
): SajuReadingView {
  return {
    id: reading.id,
    productSlug: reading.productSlug,
    mode: reading.mode,
    status: reading.status,
    createdAt: reading.createdAt,
    outline: reading.outline.sections.map((s, i) => ({
      // 제목은 골격이 아니라 상품에서 온다. 골격이 섹션을 하나 더/덜 들고 오는 일은
      // `generateOutline` 이 막고 있지만(`OUTLINE_MISSING_SECTION`), 저장된 옛 리포트를 다시
      // 열 때를 위해 없으면 요지를 제목 자리에 둔다 — 목차가 빈 줄로 보이는 것보다 낫다.
      title: product?.sections[i]?.title ?? s.gist,
      gist: s.gist,
    })),
    sectionCount: reading.outline.sections.length,
    pages: [...pages].sort((a, b) => a.pageNumber - b.pageNumber),
    closing: reading.closing,
    image: reading.image,
    lastReadPage: reading.lastReadPage,
    userInput: reading.userInput,
    chart: toChartView(reading.chart),
    partnerNickname: reading.partnerBirthSnapshot?.nickname ?? null,
  };
}

/**
 * 「운세 보관함」의 한 줄. 목록은 **리포트 문서 하나만 읽고 만든다** — 페이지 서브컬렉션을
 * 세지 않는다.
 *
 * 세고 싶은 유혹이 있다. "3/10장 생성됨" 이 정확하니까. 그런데 그러려면 리포트마다 서브컬렉션을
 * 한 번씩 더 읽어야 하고(N+1), 보관함은 리포트가 쌓일수록 느려지는 화면이 된다. 목록에 필요한
 * 것은 정확한 장수가 아니라 **"이어 볼 수 있는가, 어디부터인가"** 이고 그건 `lastReadPage` 와
 * `status` 로 충분하다.
 */
export type SajuReadingSummary = {
  id: string;
  productSlug: string;
  mode: SajuMode;
  status: SajuReadingStatus;
  createdAt: string;
  sectionCount: number;
  lastReadPage: number;
  /** 이미지 장이 있는가. 바이트가 아니라 **있다/없다** 만 준다. */
  hasImage: boolean;
};

export function toReadingSummary(reading: SajuReading): SajuReadingSummary {
  return {
    id: reading.id,
    productSlug: reading.productSlug,
    mode: reading.mode,
    status: reading.status,
    createdAt: reading.createdAt,
    sectionCount: reading.outline.sections.length,
    lastReadPage: reading.lastReadPage,
    hasImage: reading.image !== null,
  };
}
