"use client";

import { BrandBi } from "./BrandBi";
import TestAccountLogin from "./TestAccountLogin";

// 친구 초대 링크(/login?ref=CODE)로 들어온 경우, OAuth 왕복 동안 유일하게 그대로 되돌아오는
// state 파라미터에 초대 코드를 실어서 콜백(src/app/api/auth/kakao/callback/route.ts)까지
// 전달한다 — 이 프로젝트는 별도 CSRF nonce 검증을 안 쓰고 있어 state를 리퍼럴 코드 전달 용도로
// 그대로 재사용해도 안전하다(2026-09-16).
export function kakaoAuthorizeUrl(referralCode?: string) {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
    redirect_uri: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!,
    response_type: "code",
    // 계정정보 모달/마이페이지에 실제 카카오 이메일을 보여주려면 명시적으로 요청해야 함
    // (카카오 디벨로퍼스 콘솔에서 이메일 동의항목이 "선택 동의"면 scope 없인 안 옴, 2026-09-15).
    // birthday/birthyear는 콘솔(카카오 로그인 > 동의항목)에서 아직 활성화 전이라 요청하면
    // KOE205(설정 안 된 항목 요청)로 로그인 자체가 막힌다 — 콘솔에서 활성화 완료 후 다시 추가할 것
    // (2026-09-19, 로컬 재현으로 확인).
    scope: "account_email",
  });
  if (referralCode) params.set("state", referralCode);
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

/** 피그마 "Screen / LoginModal"의 카드. `/login` 페이지와 대화 화면 위에 뜨는 모달이 같은 것을
 * 쓴다 — 목업상 둘은 같은 카드고, 놓이는 자리만 다르다.
 *
 * 색은 전부 토큰이다 — 카드는 --topbar, 칩은 --bg. 예전엔 라이트 값을 코드에 박아둬서 다크
 * 모드에서 흰 카드가 떠 있었다. 노란색만 카카오 브랜드 색이라 토큰화하지 않고 그대로 둔다. */
export function LoginPanel({
  referralCode,
  error,
}: {
  referralCode?: string;
  error?: string;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5 rounded-[32px] border border-border bg-topbar p-6 shadow-[0_16px_42px_rgba(0,0,0,0.2)]">
      <span className="self-center">
        <BrandBi />
      </span>
      <p className="text-center text-base font-semibold text-text">
        작은 고민도 넘기지 말고
        <br />
        타연에서 타로ㆍ사주ㆍ자미두수로
        <br />
        상담해보세요
      </p>

      {error && (
        <p className="text-center text-sm text-urgent">
          {/* QA 환경은 허용된 계정만 로그인된다(src/lib/auth/loginAllowlist.ts) — 그 경우
              "다시 시도"를 안내하면 계속 헛돌게 되므로 사유를 구분해서 보여준다. */}
          {error === "not_allowed"
            ? "이 계정은 접근이 허용되지 않았어요."
            : "로그인에 실패했어요. 다시 시도해주세요."}
        </p>
      )}

      <p className="rounded-2xl bg-bg px-4 py-2.5 text-center text-sm font-semibold leading-5 text-text">
        최초 가입 시 무료 4회(모든 기능 무제한) 지급
      </p>

      {/* 버튼은 받은 이미지 에셋 한 장이다(public/textures/btn_kakao.png, 448x92 2배수).
          메뉴 드로어와 같은 그림을 쓴다(2026-09-23 사용자 지시). 카드 폭(336)에 꽉 채우면
          높이가 69까지 커져 카드 비례가 깨지므로, 원래 버튼과 같은 높이 48로 두고 폭은
          비율대로(≈234) 따라오게 한 뒤 가운데 정렬한다 — 그림이라 가로로만 늘리면 모서리
          라운드가 찌그러진다. */}
      <a href={kakaoAuthorizeUrl(referralCode)} className="self-center">
        <img
          src="/textures/btn_kakao.png"
          alt="카카오로 시작하기"
          width={448}
          height={92}
          className="h-12 w-auto"
        />
      </a>

      {/* PG 심사용 ID/PW 로그인. 심사자가 카카오 계정 없이 가입·결제 흐름을 볼 수 있어야 한다. */}
      <TestAccountLogin />

      <p className="text-center text-xs text-text">
        로그인 시{" "}
        <a href="/terms" target="_blank" className="text-point-text underline">
          이용약관
        </a>
        에 동의하는 것으로 간주합니다.
      </p>
    </div>
  );
}
