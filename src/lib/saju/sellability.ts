// 유료 사주 상품의 **판매 제약**(doc/사주_구현설계.md §10). 규칙은 이 파일 하나에만 있다.
//
// ── 왜 `generate/chart.ts` 에서 떼어냈나 (2026-09-26) ────────────────────────
// 이 판정은 화면(구매 화면)과 서버(결제·생성)가 **같은 함수**로 해야 한다 — 두 벌이 되면 한쪽만
// 고쳐져서 "결제는 됐는데 계산이 안 되는" 건이 생긴다. 그래서 화면도 이걸 import 하는데, 원래
// 있던 `chart.ts` 는 `manseryeok`·`iztro` 를 top-level 로 끌고 들어온다. 둘 다 CJS 라 번들러가
// 트리셰이킹으로 떨어내지 못하고, 이 함수 하나 때문에 **명리 계산 라이브러리 두 개가 클라이언트
// 번들에 실린다.**
//
// 함수 자체는 `BirthInfo` 의 필드 세 개만 본다. 그래서 **의존성 없는 잎 모듈**로 떼고 `chart.ts`
// 가 re-export 한다 — 기존 import 경로는 그대로 살아 있고, 규칙은 여전히 한 곳이다.
import type { BirthInfo } from "@/lib/tarot/birthInfo";

/** 판매 모드. 상품마다 셋 다 팔지만 가격이 다르다(기획 4.1).
 *
 *  타입도 여기 있다 — `SajuMode` 하나 때문에 `src/lib/payment/products.ts` 같은 곳이 명리
 *  라이브러리를 물고 들어오면 안 된다(그 파일도 "값을 가져오면 사주 쪽 import 그래프를 끌고
 *  들어온다"고 적어 두었다). */
export type SajuMode = "saju" | "ziwei" | "integrated";

/** 계산을 시도하기 전에 이 모드를 이 사람에게 팔 수 있는지 본다(§10 판매 제약).
 *
 *  결제 화면에서 먼저 막지만 계산 계층에서도 검사한다 — API 를 직접 두드리면 화면 검사는
 *  우회되고, 그렇게 만들어진 리포트는 "다른 사람 얘기"가 되어 환불 요구가 들어오면 지는 싸움이
 *  된다.
 *
 *  **한 사람분 판정이다.** 궁합 상품은 상대방에게도 따로 걸어야 한다 — 상대의 시진이 틀리면
 *  상대의 명궁이 통째로 다른 궁으로 가는 건 내담자 쪽과 똑같다(`calculateChart` 가 그렇게 한다). */
export function whyUnsellable(birthInfo: BirthInfo, mode: SajuMode): string | null {
  if (!birthInfo.birthDate) return "생년월일이 없습니다.";
  // 사주 대운은 성별 없이는 계산 자체가 안 나오고(manseryeok 이 gender 없으면 생략), 자미두수는
  // 지금 unspecified 를 남성으로 때우고 있다(src/lib/ziwei/calculate.ts). 타로에선 "선택안함"이
  // 허용이었지만 돈을 받는 상품에서는 통하지 않는다.
  if (birthInfo.gender === "unspecified") return "성별을 입력해야 합니다.";
  // 시진이 틀리면 명궁이 통째로 다른 궁으로 가서 리포트 전체가 어긋난다. 사주는 시주만 빼고
  // 해석하면 성립하므로 사주 모드만 판다.
  if (mode !== "saju" && birthInfo.timeUnknown) {
    return "태어난 시간을 모르면 자미두수·통합 모드는 판매하지 않습니다.";
  }
  return null;
}
