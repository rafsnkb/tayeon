import { Suspense } from "react";
import { FortuneEntry } from "./FortuneEntry";

/** 운세(사주·자미두수)의 입구. **로그인 여부로 두 화면이 갈린다**(2026-09-26 사용자 결정):
 *
 *    · 비로그인 → 소개 화면 `Main_Fortune_*`("내 운세 보러가기" → 로그인)
 *    · 로그인   → 상품 목록 `Fortune_Home_*`
 *
 *  라우트를 둘로 쪼개지 않고 한 주소에서 가른 이유: 주소를 직접 친 비로그인 사용자를 어디로
 *  보낼지가 그냥 풀린다 — 튕겨내지 않고 소개 화면을 보여주면 되고, 로그인하는 순간 같은
 *  주소가 목록이 된다. 토글도 분기를 몰라도 된다.
 *
 *  목록이 `useSearchParams`(`?c=love`)를 읽으므로 Suspense 경계가 필요하다. */
export default function FortunePage() {
  return (
    <Suspense fallback={null}>
      <FortuneEntry />
    </Suspense>
  );
}
