"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

const POLICY_CONTENT: Record<"terms" | "privacy", { title: string; body: string }> = {
  terms: {
    title: "이용약관",
    body: "이용약관은 준비 중입니다. 서비스 정식 오픈 전까지 이 내용이 업데이트될 예정입니다.",
  },
  privacy: {
    title: "개인정보처리방침",
    body: "개인정보처리방침은 준비 중입니다. 서비스 정식 오픈 전까지 이 내용이 업데이트될 예정입니다.",
  },
};

function PolicyModal({
  policy,
  onClose,
}: {
  policy: "terms" | "privacy";
  onClose: () => void;
}) {
  const { title, body } = POLICY_CONTENT[policy];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-6">
        <h2 className="text-lg font-bold text-bold-text">{title}</h2>
        <p className="flex-1 overflow-y-auto text-sm text-text">{body}</p>
        <button
          onClick={onClose}
          className="self-end rounded-full bg-cta-fill px-5 py-2 text-sm text-cta-text"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [nickname, setNickname] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPolicy, setOpenPolicy] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.replace("/login");
        return;
      }

      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.nickname) setNickname(data.nickname);
      }
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !nickname.trim() || !agreedTerms || !agreedPrivacy || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "가입 처리에 실패했어요.");
        return;
      }

      router.replace("/tarot?welcome=1");
    } catch {
      setError("네트워크 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (user === undefined) return null;

  const canSubmit = nickname.trim() && agreedTerms && agreedPrivacy && !submitting;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      {openPolicy && <PolicyModal policy={openPolicy} onClose={() => setOpenPolicy(null)} />}

      <h1 className="text-xl font-bold text-bold-text">타연 가입</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-text">닉네임</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="사용할 닉네임을 입력하세요"
            className="rounded-lg border border-border bg-surface px-3 py-2 outline-none"
          />
        </label>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
            />
            <span>
              (필수){" "}
              <button
                type="button"
                onClick={() => setOpenPolicy("terms")}
                className="text-point underline"
              >
                이용약관
              </button>
              에 동의합니다
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={agreedPrivacy}
              onChange={(e) => setAgreedPrivacy(e.target.checked)}
            />
            <span>
              (필수){" "}
              <button
                type="button"
                onClick={() => setOpenPolicy("privacy")}
                className="text-point underline"
              >
                개인정보처리방침
              </button>
              에 동의합니다
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-urgent">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-cta-fill px-5 py-2 text-cta-text disabled:opacity-40"
        >
          가입 완료
        </button>
      </form>
    </main>
  );
}
