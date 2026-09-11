import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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
  };

  const uid = `kakao:${profile.id}`;
  const nickname = profile.properties?.nickname ?? null;
  const profileImage = profile.properties?.profile_image ?? null;

  const userRef = adminDb.collection("users").doc(uid);
  const existing = await userRef.get();
  const isNewUser = !existing.exists;

  // 이 로그인의 카카오 응답에 닉네임/프로필사진이 없을 수 있음(동의항목 미획득 등) — 그 경우
  // 기존에 저장된 값을 null로 덮어쓰지 않고 그대로 유지한다.
  await userRef.set(
    {
      provider: "kakao",
      kakaoId: profile.id,
      ...(nickname !== null ? { nickname } : {}),
      ...(profileImage !== null ? { profileImage } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const customToken = await adminAuth.createCustomToken(uid);

  const params = new URLSearchParams({
    token: customToken,
    isNewUser: String(isNewUser),
  });

  return NextResponse.redirect(
    new URL(`/login/complete#${params.toString()}`, APP_ORIGIN)
  );
}
