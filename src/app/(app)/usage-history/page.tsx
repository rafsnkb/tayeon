"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";

type Entry = {
  roomTitle: string;
  spreadLabel: string;
  includeSaju: boolean;
  includeZiwei: boolean;
  includeCompatibility: boolean;
  cost: number;
  timePassApplied: boolean;
  createdAt: string;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function optionsLabel(e: Entry) {
  const parts = [e.spreadLabel];
  if (e.includeSaju) parts.push("사주");
  if (e.includeZiwei) parts.push("자미두수");
  if (e.includeCompatibility) parts.push("궁합");
  return parts.join("+");
}

export default function UsageHistoryPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u: User | null) => {
      if (!u) return;
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/usage-history", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="사용 내역" />
      <div className="flex-1 overflow-y-auto p-4">
        {entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="pt-8 text-center text-sm text-icon-muted">아직 사용 내역이 없어요.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {entries.map((e, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <p className="px-1 text-sm text-icon-muted">{formatDateTime(e.createdAt)}</p>
                <div className="flex items-center justify-between rounded-[28px] border border-border bg-topbar p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-icon-muted">
                      [채팅] {e.roomTitle}
                    </p>
                    <p className="truncate text-base font-semibold text-[#dcdee3]">
                      {optionsLabel(e)}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-white">
                    {e.timePassApplied ? "이용권 사용" : `-${e.cost.toLocaleString("ko-KR")} 코인`}
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
