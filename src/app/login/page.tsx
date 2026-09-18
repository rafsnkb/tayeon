import TestAccountLogin from "./TestAccountLogin";
import { BrandBi } from "@/components/BrandBi";

// 친구 초대 링크(/login?ref=CODE)로 들어온 경우, OAuth 왕복 동안 유일하게 그대로 되돌아오는
// state 파라미터에 초대 코드를 실어서 콜백(src/app/api/auth/kakao/callback/route.ts)까지
// 전달한다 — 이 프로젝트는 별도 CSRF nonce 검증을 안 쓰고 있어 state를 리퍼럴 코드 전달 용도로
// 그대로 재사용해도 안전하다(2026-09-16).
function getKakaoAuthorizeUrl(ref?: string) {
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
  if (ref) params.set("state", ref);
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

/** 피그마 "Screen / LoginModal" — 원래 디자인은 /tarot 뒤에 반투명 카드로 얹혀있지만, 로그인 전엔
 * /tarot 자체를 미리보기로 보여주는 게 이번 패스 범위 밖(인증 게이트 구조를 바꿔야 함)이라
 * 카드 부분만 독립된 /login 페이지로 옮겨서 그렸다. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0e0f10] p-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[32px] border border-[#e4d8ef] bg-[#fcfbff] p-6 shadow-[0_16px_42px_rgba(0,0,0,0.2)]">
        <span className="self-center"><BrandBi variant="light" /></span>
        <p className="text-center text-base font-semibold text-[#74628a]">
          작은 고민도 넘기지 말고
          <br />
          타연에서 타로ㆍ사주ㆍ자미두수로
          <br />
          상담해보세요
        </p>

        {error && <p className="text-center text-sm text-urgent">로그인에 실패했어요. 다시 시도해주세요.</p>}

        <p className="rounded-2xl bg-[#f5f1fa] px-4 py-2.5 text-center text-sm font-semibold leading-5 text-[#74628a]">
          최초 가입 시 무료 4회(모든 기능 무제한) 지급
        </p>

        <a
          href={getKakaoAuthorizeUrl(ref)}
          className="flex h-12 items-center justify-center rounded-2xl bg-[#fae100] text-base font-bold text-black"
        >
          로그인ㆍ회원가입
        </a>

        <p className="text-center text-xs text-[#74628a]">
          로그인 시{" "}
          <a href="/terms" target="_blank" className="text-point underline">
            이용약관
          </a>
          에 동의하는 것으로 간주합니다.
        </p>

        <TestAccountLogin />
      </div>
    </main>
  );
}
