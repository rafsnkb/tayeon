import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const KAKAO_REST_API_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY!;
const KAKAO_REDIRECT_URI = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI!;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET!;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/login?error=${error ?? "missing_code"}`, req.url)
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
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", req.url));
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(new URL("/login?error=profile_fetch_failed", req.url));
  }

  const profile = (await profileRes.json()) as {
    id: number;
    properties?: { nickname?: string; profile_image?: string };
  };

  const uid = `kakao:${profile.id}`;
  const nickname = profile.properties?.nickname ?? null;
  const profileImage = profile.properties?.profile_image ?? null;

  await adminDb.collection("users").doc(uid).set(
    {
      provider: "kakao",
      kakaoId: profile.id,
      nickname,
      profileImage,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const customToken = await adminAuth.createCustomToken(uid);

  return NextResponse.redirect(
    new URL(`/login/complete#token=${customToken}`, req.url)
  );
}
