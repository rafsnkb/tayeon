"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type FlaggedReading = { question: string; createdAt: string; spread: string | null };

type FlaggedReadingDetail = FlaggedReading & { interpretation: string; roomTitle: string | null };

type SearchedUser = {
  uid: string;
  nickname: string | null;
  coins: number;
  provider: string | null;
  kakaoId: number | null;
  termsAgreedAt: string | null;
  suspended: boolean;
  suspendedReason: string | null;
  moderation: {
    recentCount: number;
    noChargeCount: number;
    recentFlagged: FlaggedReading[];
  };
};

type Status = "loading" | "unauthenticated" | "forbidden" | "ok";

export default function AdminHome() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [grantAmount, setGrantAmount] = useState<Record<string, string>>({});
  const [grantReason, setGrantReason] = useState<Record<string, string>>({});
  const [grantBusy, setGrantBusy] = useState<string | null>(null);
  const [grantMessage, setGrantMessage] = useState<Record<string, string>>({});

  const [suspendReason, setSuspendReason] = useState<Record<string, string>>({});
  const [suspendBusy, setSuspendBusy] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState<Record<string, boolean>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<
    Record<
      string,
      { recentCount: number; noChargeCount: number; perRoomLimit: number; flagged: FlaggedReadingDetail[] }
    >
  >({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setStatus("unauthenticated");
        router.push("/login");
        return;
      }
      setUser(firebaseUser);

      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/me", {
        headers: { authorization: `Bearer ${token}` },
      });
      setStatus(res.ok ? "ok" : "forbidden");
    });
    return () => unsubscribe();
  }, [router]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!user || !query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSearchError(body.error ?? "검색에 실패했습니다.");
        setResults([]);
        return;
      }
      const body = (await res.json()) as { users: SearchedUser[] };
      setResults(body.users);
    } finally {
      setSearching(false);
    }
  }

  async function handleGrant(uid: string) {
    if (!user) return;
    const amount = Number(grantAmount[uid]);
    if (!Number.isInteger(amount) || amount === 0) {
      setGrantMessage((m) => ({ ...m, [uid]: "0이 아닌 정수를 입력해주세요." }));
      return;
    }
    setGrantBusy(uid);
    setGrantMessage((m) => ({ ...m, [uid]: "" }));
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${uid}/grant-coins`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ amount, reason: grantReason[uid] ?? "" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setGrantMessage((m) => ({ ...m, [uid]: body.error ?? "지급에 실패했습니다." }));
        return;
      }
      setResults((rs) => rs.map((r) => (r.uid === uid ? { ...r, coins: body.coins } : r)));
      setGrantMessage((m) => ({ ...m, [uid]: `완료. 현재 잔액 ${body.coins}코인` }));
      setGrantAmount((a) => ({ ...a, [uid]: "" }));
      setGrantReason((r) => ({ ...r, [uid]: "" }));
    } finally {
      setGrantBusy(null);
    }
  }

  async function handleSuspendToggle(uid: string, nextSuspended: boolean) {
    if (!user) return;
    setSuspendBusy(uid);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${uid}/suspend`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          suspended: nextSuspended,
          reason: suspendReason[uid] ?? "",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error ?? "처리에 실패했습니다.");
        return;
      }
      setResults((rs) =>
        rs.map((r) =>
          r.uid === uid
            ? {
                ...r,
                suspended: body.suspended,
                suspendedReason: nextSuspended ? suspendReason[uid] ?? null : null,
              }
            : r
        )
      );
      setSuspendReason((s) => ({ ...s, [uid]: "" }));
    } finally {
      setSuspendBusy(null);
    }
  }

  async function handleToggleDetail(uid: string) {
    const nextOpen = !detailOpen[uid];
    setDetailOpen((d) => ({ ...d, [uid]: nextOpen }));
    if (!nextOpen || !user || detailData[uid]) return;

    setDetailLoading(uid);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/users/${uid}/flagged-readings`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setDetailData((d) => ({ ...d, [uid]: body }));
    } finally {
      setDetailLoading(null);
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return <main className="p-6 text-sm text-zinc-500">확인 중...</main>;
  }

  if (status === "forbidden") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-600">
          이 계정({user?.email})은 관리자 권한이 없습니다.
        </p>
        <button
          onClick={() => signOut(auth)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          로그아웃
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">타연 관리자</h1>
        <button
          onClick={() => signOut(auth)}
          className="text-sm text-zinc-500 underline"
        >
          로그아웃 ({user?.email})
        </button>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-700">유저 검색 (UID 또는 닉네임)</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="kakao:1234567 또는 닉네임"
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            검색
          </button>
        </form>
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}
      </section>

      <section className="space-y-4">
        {results.map((r) => (
          <div key={r.uid} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm">
                <p className="font-medium">{r.nickname ?? "(닉네임 없음)"}</p>
                <p className="text-zinc-500">{r.uid}</p>
                <p className="text-zinc-500">
                  잔액 {r.coins}코인 · {r.provider ?? "-"}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-1 text-xs font-medium " +
                  (r.suspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")
                }
              >
                {r.suspended ? "정지" : "정상"}
              </span>
            </div>

            {r.suspended && r.suspendedReason && (
              <p className="rounded bg-red-50 px-2 py-1.5 text-sm text-red-700">
                정지 사유: {r.suspendedReason}
              </p>
            )}

            <div className="rounded border border-zinc-100 bg-zinc-50 p-2 text-sm text-zinc-600">
              <p>
                최근 리딩 {r.moderation.recentCount}건 중{" "}
                <span className="font-medium text-zinc-900">
                  무료처리(인젝션/무관요청 추정) {r.moderation.noChargeCount}건
                </span>
              </p>
              {r.moderation.recentFlagged.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {r.moderation.recentFlagged.map((f, i) => (
                    <li key={i} className="truncate text-xs text-zinc-500">
                      &quot;{f.question}&quot; ({f.spread ?? "-"}, {f.createdAt.slice(0, 10)})
                    </li>
                  ))}
                </ul>
              )}
              {r.moderation.noChargeCount > 0 && (
                <button
                  onClick={() => handleToggleDetail(r.uid)}
                  className="mt-1 text-xs font-medium text-zinc-900 underline"
                >
                  {detailOpen[r.uid] ? "상세 닫기" : "상세히 보기"}
                </button>
              )}
              {detailOpen[r.uid] && (
                <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded border border-zinc-200 bg-white p-2">
                  {detailLoading === r.uid && (
                    <p className="text-xs text-zinc-400">불러오는 중...</p>
                  )}
                  {detailData[r.uid] && (
                    <>
                      <p className="text-xs text-zinc-400">
                        방마다 최근 {detailData[r.uid].perRoomLimit}건 범위 내에서 무료처리{" "}
                        {detailData[r.uid].noChargeCount}건
                      </p>
                      {detailData[r.uid].flagged.map((f, i) => (
                        <div key={i} className="rounded bg-zinc-50 p-2 text-xs">
                          <p className="text-zinc-400">
                            {f.createdAt.slice(0, 19).replace("T", " ")} · {f.roomTitle ?? "-"} ·{" "}
                            {f.spread ?? "-"}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-zinc-800">
                            <span className="font-medium">Q.</span> {f.question}
                          </p>
                          {f.interpretation && (
                            <p className="mt-1 whitespace-pre-wrap text-zinc-500">
                              <span className="font-medium">A.</span> {f.interpretation}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                placeholder="지급/차감 코인 (예: 100, -50)"
                value={grantAmount[r.uid] ?? ""}
                onChange={(e) =>
                  setGrantAmount((a) => ({ ...a, [r.uid]: e.target.value }))
                }
                className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="사유 (선택)"
                value={grantReason[r.uid] ?? ""}
                onChange={(e) =>
                  setGrantReason((rs) => ({ ...rs, [r.uid]: e.target.value }))
                }
                className="flex-1 min-w-[120px] rounded border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <button
                onClick={() => handleGrant(r.uid)}
                disabled={grantBusy === r.uid}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                코인 적용
              </button>
            </div>
            {grantMessage[r.uid] && (
              <p className="text-sm text-zinc-600">{grantMessage[r.uid]}</p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
              {!r.suspended ? (
                <>
                  <input
                    type="text"
                    placeholder="정지 사유"
                    value={suspendReason[r.uid] ?? ""}
                    onChange={(e) =>
                      setSuspendReason((s) => ({ ...s, [r.uid]: e.target.value }))
                    }
                    className="flex-1 min-w-[120px] rounded border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => handleSuspendToggle(r.uid, true)}
                    disabled={suspendBusy === r.uid}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    정지
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleSuspendToggle(r.uid, false)}
                  disabled={suspendBusy === r.uid}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  정지 해제
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
