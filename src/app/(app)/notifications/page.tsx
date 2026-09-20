"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import { ChevronRightIcon } from "@/app/(app)/tarot/icons";
import { useRooms } from "@/lib/tarot/RoomsContext";

type NotificationEntry = { id: string; source: string; label: string; createdAt: string };

function monthLabel(createdAt: string): string {
  return String(new Date(createdAt).getMonth() + 1);
}

/** 피그마 "Screen / Notification" 문구에 맞춘 제목 — "받은 이용권 내역"(/received-passes)의
 * label과 소스는 같지만, 알림 목록은 "OO 도착!" 형태로 다시 쓴다. */
function notificationTitle(entry: NotificationEntry): string {
  switch (entry.source) {
    case "admin-grant":
      return "운영자 지급 횟수제 이용권 도착!";
    case "bonus-reward":
      return `${monthLabel(entry.createdAt)}월 리워드 이용권 도착!`;
    case "referral-payout":
      return `${monthLabel(entry.createdAt)}월 친구 결제 리워드 이용권 도착!`;
    case "referral-signup":
      return "친구 초대 리워드 이용권 도착!";
    default:
      return `${entry.label} 도착!`;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 피그마 "Screen / Notification" — 운영자 지급/리워드 도착 알림 목록. 실제 데이터는 "받은 이용권
 * 내역"(/received-passes)과 같은 두 소스(admin-grant countPasses + pendingRewards)를 공유하며,
 * 이 화면은 그 위에 "도착!" 알림 문구와 읽음 처리만 얹는다. */
export default function NotificationsPage() {
  const router = useRouter();
  const { setHasUnreadNotifications } = useRooms();
  const [entries, setEntries] = useState<NotificationEntry[] | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user: User | null) => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const [listRes] = await Promise.all([
        fetch("/api/user/received-passes", { headers: { Authorization: `Bearer ${idToken}` } }),
        fetch("/api/user/notifications/mark-read", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } }),
      ]);
      setHasUnreadNotifications(false);
      if (listRes.ok) {
        const data = await listRes.json();
        setEntries(data.entries);
      }
    });
  }, [setHasUnreadNotifications]);

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="알림" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        {entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="pt-8 text-center text-sm text-icon-muted">아직 도착한 알림이 없어요.</p>
        ) : (
          <div className="mx-auto w-full max-w-2xl divide-y divide-border border-y border-border">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => router.push("/received-passes")}
                className="grid w-full grid-cols-[1fr_auto] text-left"
              >
                {/* 화살표 자리를 "행 높이와 같은 폭의 정사각형" 영역으로 두고 그 정중앙에
                    아이콘을 놓는다(사용자 요청, 2026-09-20) — flex+aspect-square+self-stretch는
                    flex-basis(너비) 계산이 stretch로 정해질 높이보다 먼저 일어나 아이콘 크기만큼만
                    좁게 잡히는 경우가 있어(실측으로 확인) grid로 바꿈: grid는 행 높이를 먼저
                    확정한 뒤 aspect-square 칸의 너비를 그 높이에서 유도해 항상 정사각형이 된다. */}
                <span className="min-w-0 py-4">
                  <span className="block truncate text-base font-semibold text-bold-text">{notificationTitle(entry)}</span>
                  <span className="mt-1 block text-sm text-icon-muted">{formatDate(entry.createdAt)}</span>
                </span>
                <span className="flex aspect-square items-center justify-center">
                  <ChevronRightIcon className="h-4 w-2 text-bold-text" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
