import { CompanyInfoLink } from "@/components/CompanyInfoLink";
import { LoginPanel } from "@/components/LoginPanel";

/** 카카오 OAuth 콜백이 실패를 되돌려 보낼 곳이자, 친구 초대 링크(/login?ref=CODE)가 가리키는
 * 주소. 평소의 로그인 유도는 대화 화면 위에 뜨는 LoginModal이 맡으므로(2026-09-22) 이 페이지로
 * 직접 오는 경로는 그 둘뿐이다. 카드는 모달과 같은 LoginPanel을 쓴다. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const { error, ref } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-bg p-6">
      <div className="flex w-full max-w-sm flex-col gap-5">
        {/* 테스트계정 로그인은 LoginPanel 안으로 들어갔다(2026-09-23) — 로그인 모달에도
            같이 필요해서 카드 자체가 들고 있는 편이 맞다. */}
        <LoginPanel referralCode={ref} error={error} />
      </div>

      {/* 초기 화면이 요구하는 사업자 정보 접근 경로. */}
      <CompanyInfoLink className="absolute bottom-6 text-xs text-icon-muted" />
    </main>
  );
}
