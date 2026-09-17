import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { findUidByReferralCode, grantSignupFreePass, grantSignupReferralReward } from "@/lib/referral/code";

const KAKAO_REST_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!;
const KAKAO_REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET!;

// req.url's origin isn't reliable behind Cloud Run/App Hosting's proxy (shows the
// container's internal bind address, not the public domain), so redirects are built
// from the known-good public origin instead.
const APP_ORIGIN = new URL(KAKAO_REDIRECT_URI).origin;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  // /login?ref=CODE로 들어온 경우 getKakaoAuthorizeUrl()이 이 값을 state에 실어 보냄(친구 초대).
  const referralCode = req.nextUrl.searchParams.get("state");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/login?error=${error ?? "missing_code"}`, APP_ORIGIN)
    );
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KAKAO_REST_API_KEY,
      client_secret: KAKAO_CLIENT_SECRET,
      redirect_uri: KAKAO_REDIRECT_URI,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Kakao token exchange failed:", tokenRes.status, await tokenRes.text());
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", APP_ORIGIN));
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/login?error=profile_fetch_failed", APP_ORIGIN));
  }

  const profile = (await profileRes.json()) as {
    id: number;
    properties?: { nickname?: string; profile_image?: string };
    kakao_account?: { email?: string; is_email_valid?: boolean; is_email_verified?: boolean };
  };

  const uid = `kakao:${profile.id}`;
  const nickname = profile.properties?.nickname ?? null;
  const profileImage = profile.properties?.profile_image ?? null;
  // 카카오 디벨로퍼스에서 이메일 동의항목을 활성화해야 오고, 동의를 안 했거나 이메일이 없는
  // 카카오 계정이면 이번 로그인 응답에 아예 안 실려온다(2026-09-15) — 그 경우 기존 값 유지.
  const email = profile.kakao_account?.email ?? null;

  const userRef = adminDb.collection("users").doc(uid);
  const existing = await userRef.get();
  const isNewUser = !existing.exists;

  // 이 로그인의 카카오 응답에 닉네임/프로필사진이 없을 수 있음(동의항목 미획득 등) — 그 경우
  // 기존에 저장된 값을 null로 덮어쓰지 않고 그대로 유지한다.
  let referredBy: string | null = null;
  if (isNewUser && referralCode) {
    referredBy = await findUidByReferralCode(referralCode);
  }

  await userRef.set(
    {
      provider: "kakao",
      kakaoId: profile.id,
      ...(nickname !== null ? { nickname } : {}),
      ...(profileImage !== null ? { profileImage } : {}),
      ...(email !== null ? { email } : {}),
      ...(referredBy ? { referredBy } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (isNewUser) {
    await grantSignupFreePass(uid);
  }

  // 친구 초대(리퍼럴) 가입 보상은 최초 가입 체험권과 별도로 추천인과 친구 모두에게 지급된다.
  if (referredBy) {
    await grantSignupReferralReward(referredBy, uid).catch((err) => {
      console.error("[referral] 가입 보상 지급 실패", { referredBy, uid, err });
    });
  }

  const customToken = await adminAuth.createCustomToken(uid);

  const params = new URLSearchParams({
    token: customToken,
    isNewUser: String(isNewUser),
  });

  return NextResponse.redirect(
    new URL(`/login/complete#${params.toString()}`, APP_ORIGIN)
  );
}
