function getKakaoAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
    redirect_uri: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!,
    response_type: "code",
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

/** 피그마 "Screen / LoginModal" — 원래 디자인은 /tarot 뒤에 반투명 카드로 얹혀있지만, 로그인 전엔
 * /tarot 자체를 미리보기로 보여주는 게 이번 패스 범위 밖(인증 게이트 구조를 바꿔야 함)이라
 * 카드 부분만 독립된 /login 페이지로 옮겨서 그렸다. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg p-6">
      <span className="text-3xl font-bold">
        <span className="text-white">타</span>
        <span className="text-point">연</span>
      </span>

      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[32px] border border-border bg-topbar p-6">
        <span className="self-center text-2xl font-bold">
          <span className="text-white">타</span>
          <span className="text-point">연</span>
        </span>
        <p className="text-center text-base font-semibold text-[#dcdee3]">
          작은 고민도 넘기지 말고
          <br />
          타연에서 타로ㆍ사주ㆍ자미두수로
          <br />
          상담해보세요
        </p>

        {error && <p className="text-center text-sm text-urgent">로그인에 실패했어요. 다시 시도해주세요.</p>}

        <p className="rounded-full bg-bg py-2.5 text-center text-sm font-semibold text-icon-muted">
          최초 가입 시 <span className="text-gold">500코인</span> 지급
        </p>

        <a
          href={getKakaoAuthorizeUrl()}
          className="flex h-12 items-center justify-center rounded-2xl bg-[#fae100] text-base font-bold text-black"
        >
          로그인ㆍ회원가입
        </a>

        <p className="text-center text-xs text-icon-muted">
          로그인 시{" "}
          <a href="/terms" target="_blank" className="text-point underline">
            이용약관
          </a>
          에 동의하는 것으로 간주합니다.
        </p>
      </div>
    </main>
  );
}
