"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LoginCompletePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    const isNewUser = params.get("isNewUser") === "true";

    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }

    // 예전엔 onAuthStateChanged가 user를 주면 넘겼는데, 그 구독은 "이 토큰으로 로그인됨"이
    // 아니라 "아무나 로그인되어 있음"에 반응한다 — 브라우저에 남아 있던 세션에도 즉시 한 번
    // 울린다. 그래서 묵은 세션(예: 심사용 계정 pgreview:tayeon)이 있으면 카카오로 로그인해도
    // signInWithCustomToken이 끝나기 전에 옛 계정 그대로 /tarot으로 튕겨나갔다. 2026-09-23
    // 재현: 일부러 망가뜨린 토큰으로 이 페이지에 들어가도 오류 없이 /tarot으로 넘어간다.
    // 기다려야 하는 건 이 토큰의 로그인 완료뿐이고, 그게 resolve될 때 auth.currentUser는 이미
    // 새 사용자로 바뀌어 있다.
    // 묵은 세션을 먼저 확실히 끊는다. 위 구독 문제를 고친 뒤에도 "카카오로 로그인했는데
    // 심사용 계정으로 들어가진다"는 신고가 남아서(2026-09-23) 남은 경로를 막는 안전장치다 —
    // 이 페이지에 도달한 이상 이전 세션은 무조건 버려야 하는 것이고, 이렇게 두면 새 로그인이
    // 실패해도 옛 계정으로 앉아 있는 상태가 아니라 로그아웃 상태로 남는다(오해의 여지가 없다).
    void (async () => {
      try {
        await signOut(auth);
      } catch {
        // 이미 로그아웃이면 그냥 넘어간다.
      }
      try {
        await signInWithCustomToken(auth, token);
        router.replace(isNewUser ? "/signup" : "/");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-bold-text">로그인 처리 중</h1>
      {error ? <p className="text-urgent">{error}</p> : <p className="text-text">잠시만 기다려주세요...</p>}
    </main>
  );
}
