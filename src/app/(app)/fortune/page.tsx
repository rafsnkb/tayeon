import { Suspense } from "react";
import { FortuneScreen } from "./FortuneScreen";

/** 운세(사주·자미두수)의 입구. **로그인 여부와 상관없이 한 화면이다**(2026-09-27 사용자 결정).
 *
 *  예전에는 비로그인에게 소개 화면(`Main_Fortune_*`)을, 로그인에게 목록(`Fortune_Home_*`)을
 *  주느라 컴포넌트가 셋이었다(`FortuneEntry`가 갈랐다). 없앴다 — **타로 쪽이 이미 화면 하나로
 *  둘 다 받고 있었고**(`TarotScreen`), 비로그인에게 실제 상품과 가격을 보여주는 편이 카피만
 *  읽히는 화면보다 설득력이 있다. 로그인은 살 때 필요하고 그 문은 상세 화면이 들고 있다.
 *
 *  소개 화면이 하던 일 둘은 `FortuneScreen` 안으로 옮겼다 — 여섯 줄 카피는 `FortunePitch`
 *  (목록 위, 비로그인 전용), 사업자정보는 맨 아래 `MainCompanyInfo`(로그인 무관).
 *
 *  목록이 `useSearchParams`(`?c=love`)를 읽으므로 Suspense 경계가 필요하다. */
export default function FortunePage() {
  return (
    <Suspense fallback={null}>
      <FortuneScreen />
    </Suspense>
  );
}
