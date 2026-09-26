// 저장된 리포트를 **화면에 내보낼 모양**으로 줄인다.
//
// 저장 문서를 그대로 `NextResponse.json` 에 넣지 않는 이유가 세 가지 있고, 전부 실제 문제다.
//
// 1. **`outline.thesis` 는 화면에 절대 노출하지 않는다**(§1 "총평은 마지막이다"). 이건 1단이
//    만드는 **내부 기준**이고 사용자가 읽는 총평은 3단의 `closing` 이다. 응답 JSON 에 그냥
//    실으면 화면에 안 그려도 **네트워크 탭에 그대로 보인다** — "노출 안 함"이 지켜지지 않는다.
//    돈 받고 파는 결론을 마지막 페이지에 두기로 한 결정이, 개발자 도구를 여는 순간 무너진다.
// 2. **`chart` 는 계산 결과 원본이라 크다.** 재현용으로 박아 두는 값이지(§7) 뷰어가 쓰는 값이
//    아니다. 매번 실어 보내면 응답이 수십 KB 씩 커진다.
// 3. **`paymentId` 는 화면이 쓸 일이 없다.** 결제 식별자를 필요도 없는데 클라이언트로 내보내지
//    않는다.
//
// 그래서 "빼는 목록"이 아니라 **"내보낼 목록"** 으로 짰다. 빼는 목록은 §7 에 필드가 하나 늘 때
// 조용히 새지만, 내보낼 목록은 명시하지 않으면 안 나간다.
import type { SajuClosing } from "@/lib/saju/generate/closing";
import type { SajuMode } from "@/lib/saju/generate/chart";
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
  pages: SajuReadingPage[];
  closing: SajuClosing | null;
  image: SajuReadingImage | null;
  lastReadPage: number;
  userInput: string;
  /** 보관 만료 시각(ISO).
   *
   *  **뷰어가 이 값을 봐야 한다.** 만료된 리포트의 `status` 는 여전히 `complete` 다 — 아무도
   *  안 건드린 문서의 상태는 저절로 바뀌지 않으므로 만료를 상태로 표현하지 않기로 했다
   *  (`storage.ts` 의 `isSajuReadingExpired` 머리말). 화면이 `status` 만 보면 만료된 리포트에
   *  목차를 그려 주고, 장을 넘길 때마다 409 `expired` 를 받아 **같은 사실을 열 번 말하게 된다.**
   *
   *  남은 시간을 서버가 계산해 보내지 않는 이유는 `SajuReadingSummary.expiresAt` 과 같다. */
  expiresAt: string;
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
    expiresAt: reading.expiresAt,
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
  /** 보관 만료 시각(ISO). 화면이 「보관만료 D-29」 배지를 그리는 근거다.
   *
   *  **남은 시간을 서버가 계산해서 보내지 않는다.** 보낸 순간부터 낡기 시작하고, 화면이 열려
   *  있는 동안 그 값은 계속 틀려진다. 시각을 주고 화면이 매번 계산하는 쪽이 맞다. */
  expiresAt: string;
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
    expiresAt: reading.expiresAt,
  };
}
