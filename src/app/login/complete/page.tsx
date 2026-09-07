"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithCustomToken, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function LoginCompletePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);

    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) {
      setError("토큰이 없습니다.");
      return unsubscribe;
    }

    signInWithCustomToken(auth, token).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    return unsubscribe;
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-bold">로그인 결과</h1>
      {error && <p className="text-red-500">{error}</p>}
      {user ? (
        <pre className="max-w-md whitespace-pre-wrap rounded bg-black/5 p-4 text-sm">
          {JSON.stringify({ uid: user.uid, isAnonymous: user.isAnonymous }, null, 2)}
        </pre>
      ) : (
        !error && <p>로그인 처리 중...</p>
      )}
    </main>
  );
}
