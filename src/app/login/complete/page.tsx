"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
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

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(isNewUser ? "/signup" : "/tarot");
      }
    });

    signInWithCustomToken(auth, token).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    return unsubscribe;
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold text-bold-text">로그인 처리 중</h1>
      {error ? <p className="text-urgent">{error}</p> : <p className="text-text">잠시만 기다려주세요...</p>}
    </main>
  );
}
