// 사주·자미두수 유료 상품 레지스트리 — slug 로 상품 정의 하나를 찾는 것이 전부다.
//
// 기획의 19개 상품이 전부 같은 모양이라(doc/사주_구현설계.md §3 "상품은 코드가 아니라 데이터"),
// 두 번째 상품부터는 **파일 하나 추가 + 아래 배열에 한 줄**이 전부여야 한다. 조회 외의 로직을
// 여기 넣지 말 것 — 생성·과금·화면이 이 파일을 건드리기 시작하면 그 전제가 깨진다.
//
// 기획 19개 전부가 들어 있다(2026-09-26 이관 완료). 배열 순서는 기획 doc/사주구상.md 의 상품
// 번호 순서 그대로다 — 화면이 목록 정렬을 따로 정하기 전까지 이 순서가 기본 노출 순서가 된다.
//
// 첫 구현은 그중 솔로 연애 1개로 계산→생성→결제→화면→환불을 관통한다(같은 문서 §1) — 정의가
// 다 들어왔다는 것과 19개를 다 판다는 것은 다른 얘기다.
//
// 한동안 속궁합·성향 두 상품에 `adultOnly: true` 가 붙어 있었는데 **뺐다**(2026-09-26 사용자 결정).
// 근거가 없었다 — 청소년보호법의 「청소년유해매체물」은 심의기관이 결정·고시한 것만이고 해당이
// 없다. 실제 이유는 설계 §1 의 "카드사 심사 중 결제 상품 목록 변경 리스크"였고 그 전제가 없어졌다.
// 대신 성인 전용으로 읽히던 문구를 그 두 파일에서 함께 고쳤다.
import type { SajuPersonaKey } from "@/lib/saju/personas";
import { NEW_YEAR_FORTUNE } from "./new-year-fortune";
import { LIFE_OVERVIEW } from "./life-overview";
import { SINGLE_LOVE } from "./single-love";
import { CRUSH_READING } from "./crush-reading";
import { SITUATIONSHIP_READING } from "./situationship-reading";
import { COUPLE_COMPATIBILITY } from "./couple-compatibility";
import { REUNION_READING } from "./reunion-reading";
import { PERSONALITY_COMPATIBILITY } from "./personality-compatibility";
import { BUSINESS_PARTNERSHIP } from "./business-partnership";
import { INTIMACY_COMPATIBILITY } from "./intimacy-compatibility";
import { SKINSHIP_COMPATIBILITY } from "./skinship-compatibility";
import { MARRIAGE_TIMING } from "./marriage-timing";
import { MARRIAGE_COMPATIBILITY } from "./marriage-compatibility";
import { FAMILY_PLANNING } from "./family-planning";
import { WEALTH_FLOW } from "./wealth-flow";
import { CAREER_FIT } from "./career-fit";
import { EXAM_FORTUNE } from "./exam-fortune";
import { WELLNESS_RHYTHM } from "./wellness-rhythm";
import { RELATIONSHIP_DESTINY } from "./relationship-destiny";

/** 상품 정의의 모양. doc/사주_구현설계.md §3 의 타입을 그대로 옮긴 것이다 — 여기서 임의로
 *  늘리거나 줄이지 말고, 바꿀 일이 생기면 설계 문서를 먼저 고칠 것.
 *
 *  용어 주의: 기획 문서의 "카드"가 여기서는 **섹션(section)** 이다. 같은 코드베이스의 타로에
 *  `TarotCardInfo`·`CardImage` 가 실재해서 `card` 를 쓰면 반드시 충돌한다(같은 문서 §1). */
/** 기획 1.2 의 6개 카테고리. 첫 항목은 **"인생"** 이다 — 기획 1.2 표는 같은 카테고리를 "운세"로
 *  적고 정작 상품 목록 본문의 절 제목은 `A. 인생` 이라 문서 안에서 어긋나 있는데, 아이콘 파일도
 *  `fortune_category_life_*` 이고 목업 메뉴·필터도 "인생"이다(2026-09-26). 기획 1.2 표를 고칠 때
 *  같이 정리할 것.
 *
 *  화면의 「전체」·「신규」는 여기 없다 — 카테고리가 아니라 목록 필터다. */
export type SajuCategory = "인생" | "연애" | "궁합" | "결혼·가족" | "직업·재물" | "건강·인간관계";

export type SajuProduct = {
  slug: string;
  /** 이 상품이 걸릴 카테고리들. **하나가 아니라 여러 개다**(사용자 상품표, 2026-09-26) —
   *  "관련 있는 카테고리에서 다 뜨게" 하려는 의도라, 예를 들어 `결혼` 상품은 인생·결혼·가족·연애
   *  세 곳에 모두 걸린다. 목록 필터는 이 배열에 해당 카테고리가 들어 있는지로 거른다.
   *
   *  **배열 순서가 곧 화면 표기 순서다.** 상품 카드는 `카테고리들 · 태그` 로 찍는다
   *  (`연애 · 궁합 · 썸`). 맨 뒤 한 칸만 태그이고 앞은 전부 카테고리다. */
  categories: SajuCategory[];
  /** 상품 카드 표기의 마지막 칸. 카테고리가 아니라 이 상품을 가리키는 짧은 말이다(`솔로`, `재회`). */
  tag: string;
  /** 모드별 판매가. 서버가 결제 금액을 검증할 때 이 값과 대조하므로 **클라이언트가 보낸 금액을
   *  쓰면 안 된다**(src/lib/payment/products.ts 의 기존 규칙과 같다). */
  pricesWon: { saju: number; ziwei: number; integrated: number };
  title: string;
  subtitle: string;
  description: string;
  userInputPrompt: string;
  /** 기획 문서의 "목적·핵심 질문". */
  purpose: string;
  /** 텍스트 섹션만. 이미지는 아래 `image` 로 따로 간다 — single-love.ts 의 `sections` 주석 참고. */
  sections: { id: string; title: string }[];
  /** 기획 문서의 "사주 중점" 문단을 **그대로** 담는 문자열. 파싱하지 않고 프롬프트에 꽂는다 —
   *  문서에 쓰인 한국어가 이미 LLM 이 읽을 지시문이라 중간에 구조화하면 정보만 잃는다(§3). */
  sajuFocus: string;
  ziweiFocus: string;
  crossPoints: string;
  /** 이미지 지원 상품(솔로·결혼 시기·자녀)만 값을 갖는다. 나머지는 null(기획 4행 44). */
  image: null | { subject: string; elements: string[] };
  needsPartner: boolean;
  /** 이 상품의 목소리(`src/lib/saju/personas.ts`). 상품이 태어날 때부터 갖는 것이라 사용자가
   *  고르지 않는다 — 이 상품을 사면 이 목소리로만 나온다(2026-09-26 사용자 결정). */
  persona: SajuPersonaKey;
  /** 이 상품에만 붙는 해석 제약. 기획이 상품 블록에 `분석 방식` 으로 적어 둔 문장이 여기 온다.
   *  지금은 성향 궁합 하나뿐인데(별도 테스트를 제공하지 않고 성향을 추정해 해석하며, 실제
   *  선호·경계는 당사자 간 대화로 확인해야 한다), **모델에게 반드시 전달돼야 하는 안전 제약**이라
   *  주석으로만 두면 안 된다. generate/outline.ts 의 시스템 블록이 이 값을 그대로 꽂는다. */
  constraints?: string;
};

const PRODUCTS: SajuProduct[] = [
  NEW_YEAR_FORTUNE,
  LIFE_OVERVIEW,
  SINGLE_LOVE,
  CRUSH_READING,
  SITUATIONSHIP_READING,
  COUPLE_COMPATIBILITY,
  REUNION_READING,
  PERSONALITY_COMPATIBILITY,
  BUSINESS_PARTNERSHIP,
  INTIMACY_COMPATIBILITY,
  SKINSHIP_COMPATIBILITY,
  MARRIAGE_TIMING,
  MARRIAGE_COMPATIBILITY,
  FAMILY_PLANNING,
  WEALTH_FLOW,
  CAREER_FIT,
  EXAM_FORTUNE,
  WELLNESS_RHYTHM,
  RELATIONSHIP_DESTINY,
];

export const SAJU_PRODUCTS: readonly SajuProduct[] = PRODUCTS;

/** slug 에 해당하는 상품. 없으면 undefined — 라우트가 404 로 바꿔 쓴다. */
export function getSajuProduct(slug: string): SajuProduct | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

/** 목록 화면의 「신규」 칸에 걸 상품. **상품의 속성이 아니라 진열 결정**이라 상품 파일이 아니라
 *  여기 있다 — 상품마다 출시일 필드를 달면 "신규를 내린다"가 상품 정의를 고치는 일이 되고,
 *  19개 중 어느 셋이 걸려 있는지 한눈에 볼 수도 없다. 바꿀 일은 이 배열 하나를 고치는 것이다.
 *
 *  **배열 순서가 곧 화면 표시 순서다**(나머지 필터는 위 `PRODUCTS` 순서를 따른다).
 *  목업 `Fortune_Home_*` 의 세 장(썸·속궁합·재회)을 그대로 옮겼다. */
export const NEW_SLUGS: readonly string[] = [
  "situationship-reading",
  "intimacy-compatibility",
  "reunion-reading",
];
