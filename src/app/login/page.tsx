function getKakaoAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!,
    redirect_uri: process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!,
    response_type: "code",
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-bold-text">타연 로그인 테스트</h1>
      {error && <p className="text-urgent">로그인 실패: {error}</p>}
      <a
        href={getKakaoAuthorizeUrl()}
        className="rounded bg-yellow-400 px-6 py-3 font-medium text-black"
      >
        카카오로 로그인
      </a>
    </main>
  );
}
