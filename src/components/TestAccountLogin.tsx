"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** 카카오 로그인 버튼 아래 "테스트계정 로그인" — PG 심사자가 쓸 ID/PW를 제공하기 위한 것
 * (src/app/api/auth/pg-review-login/route.ts). 일반 회원가입 기능이 아니라 .env.local의
 * PG_REVIEW_TEST_ID/PASSWORD와 정확히 일치할 때만 동작하는 좁은 통로 — 심사 끝나면 그 값을
 * 지우거나 바꿔서 비활성화할 수 있다.
 *
 * 원래 /login 페이지에만 있었는데, 토스페이먼츠 심사도 받게 되면서 심사자가 실제로 마주치는
 * 로그인 지점 **전부**에 있어야 한다는 지시(2026-09-23) — 그래서 app/login 밑에서 공용
 * components 로 옮겼다. 지금 쓰는 곳: LoginPanel(= /login 페이지 + 대화 화면 위 로그인 모달),
 * 비로그인 메뉴 드로어. 드로어 폭(226)에서도 접히지 않게 전부 세로 한 줄짜리다. */
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
