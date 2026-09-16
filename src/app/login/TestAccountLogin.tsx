"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 카카오 로그인 버튼 아래 "테스트계정 로그인" — KG이니시스 전자계약 사전점검의 "회원가입
 * 필수" 항목에 심사자가 쓸 ID/PW를 제공하기 위한 것(src/app/api/auth/pg-review-login/route.ts).
 * 일반 회원가입 기능이 아니라 .env.local의 PG_REVIEW_TEST_ID/PASSWORD와 정확히 일치할 때만
 * 동작하는 좁은 통로 — 심사 끝나면 그 값을 지우거나 바꿔서 비활성화할 수 있다. */
export default function TestAccountLogin() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/pg-review-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "로그인에 실패했어요.");
        return;
      }
      router.push(`/login/complete#token=${data.token}`);
    } catch {
      setError("로그인 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border pt-4">
      <p className="text-center text-xs font-semibold text-icon-muted">테스트계정 로그인</p>
      {error && <p className="text-center text-xs text-urgent">{error}</p>}
      <input
        value={id}
        onChange={(e) => setId(e.target.value)}
        placeholder="아이디"
        className="h-11 rounded-2xl bg-bg px-4 text-sm text-bold-text outline-none"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="비밀번호"
        className="h-11 rounded-2xl bg-bg px-4 text-sm text-bold-text outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="h-11 rounded-2xl bg-chip-fill text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "로그인 중..." : "테스트계정으로 로그인"}
      </button>
    </form>
  );
}
