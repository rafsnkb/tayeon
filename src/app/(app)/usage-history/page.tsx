"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/util/formatDate";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";

type UsageEntry = {
  kind: "usage";
  roomTitle: string;
  spreadLabel: string;
  includeSaju: boolean;
  includeZiwei: boolean;
  includeCompatibility: boolean;
  cost: number;
  timePassApplied: boolean;
  countPassApplied: boolean;
  createdAt: string;
};

function optionsLabel(e: UsageEntry) {
  const parts = [e.spreadLabel];
  if (e.includeSaju) parts.push("사주");
  if (e.includeZiwei) parts.push("자미두수");
  if (e.includeCompatibility) parts.push("궁합");
  return parts.join("+");
}

export default function UsageHistoryPage() {
  const [entries, setEntries] = useState<UsageEntry[] | null>(null);
  /** 조회가 끝나긴 했는데 값을 못 받은 상태. `entries` 를 `[]` 로 떨어뜨려 겸하면 안 된다 —
   *  그러면 "아직 이용 내역이 없어요"가 뜬다. 실패를 "없음"이라고 말하는 셈이다(2026-09-26). */
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) return;
      // 실패해도 반드시 로딩을 끝낸다. 예전엔 `if (res.ok)` 에 else 가 없어서 401(이 저장소에선
      // 로컬 ADC 만료로 흔하다)이면 "불러오는 중..."에서 영영 멈췄다 — 사용자에겐 느린 화면과
      // 구분이 안 된다. getIdToken·fetch·json 이 던지는 경우도 같은 결과라 통째로 감싼다.
      try {
        const idToken = await u.getIdToken();
        const res = await fetch("/api/user/usage-history", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        const data = await res.json();
        setEntries(data.entries);
      } catch {
        setLoadFailed(true);
      }
    });
  }, []);

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="이용 내역" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        {loadFailed ? (
          <p className="pt-8 text-center text-sm text-icon-muted">이용 내역을 불러오지 못했어요.</p>
        ) : entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="pt-8 text-center text-sm text-icon-muted">아직 이용 내역이 없어요.</p>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {entries.map((e, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <p className="px-1 text-sm text-icon-muted">{formatDateTime(e.createdAt)}</p>
                <div className="flex items-center justify-between rounded-[28px] border border-border bg-topbar p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-icon-muted">
                      [채팅] {e.roomTitle}
                    </p>
                    <p className="truncate text-base font-semibold text-bold-text">
                      {optionsLabel(e)}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-bold-text">
                    {e.timePassApplied ? "시간제 이용권 사용" : e.countPassApplied ? "횟수제 이용권 1회" : `-${e.cost.toLocaleString("ko-KR")}원`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
