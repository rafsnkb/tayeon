"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/util/formatDate";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import { BackIcon } from "@/app/(app)/tarot/icons";
import {
  COMBOS,
  COUNT_PASS_VALIDITY_MONTHS,
  PENDING_REWARD_CLAIM_WINDOW_MONTHS,
  formatMonths,
  type ComboKey,
} from "@/lib/tarot/pricing";
import { useRooms } from "@/lib/tarot/RoomsContext";
import NoBirthTimePopup from "@/components/NoBirthTimePopup";
import { ComboAllowanceCard, ComboAllowanceList } from "@/components/ComboAllowanceCard";
import SuspensionModal, { parseSuspensionError, type SuspensionInfo } from "@/components/SuspensionModal";

type ReceivedPass = {
  id: string;
  label: string;
  status: "pending" | "claimed" | "expired";
  freePasses: number;
  basis: number;
  createdAt: string;
  claimWindowExpiresAt: string | null;
  claimedAt: string | null;
  claimedCombo?: ComboKey;
  comboAllowances?: Record<ComboKey, Record<string, number>>;
};



function statusBadge(status: ReceivedPass["status"]) {
  if (status === "pending") return { label: "미수령", className: "bg-success text-success-text" };
  if (status === "expired") return { label: "만료", className: "bg-chip-fill text-white" };
  return { label: "수령완료", className: "bg-chip-fill text-white" };
}

/** 피그마 "Screen / SendTicketHistory"("받은 이용권 내역") — 결제 리워드/친구초대 리워드는
 * 사용자가 조합을 골라 "받기"를 눌러야 실제 이용권이 되고(미수령 → 수령완료), 운영자 지급
 * 이용권은 이미 조합까지 확정된 채로 지급돼 항상 수령완료로만 보인다. */
export default function ReceivedPassesPage() {
  const { refreshMe, hasBirthInfo, myTimeUnknown } = useRooms();
  const hasBirthTime = hasBirthInfo && !myTimeUnknown;
  const [entries, setEntries] = useState<ReceivedPass[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<ComboKey | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [noBirthTimeOpen, setNoBirthTimeOpen] = useState(false);
  const [suspension, setSuspension] = useState<SuspensionInfo | null>(null);

  function selectCombo(combo: ComboKey) {
    if (COMBOS[combo].ziwei && !hasBirthTime) {
      setNoBirthTimeOpen(true);
      return;
    }
    setSelectedCombo(combo);
  }

  async function load(u: User) {
    const idToken = await u.getIdToken();
    const res = await fetch("/api/user/received-passes", { headers: { Authorization: `Bearer ${idToken}` } });
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries);
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await load(u);
    });
  }, []);

  function toggleOpen(entry: ReceivedPass) {
    setError(null);
    if (openId === entry.id) {
      setOpenId(null);
      setSelectedCombo(null);
    } else {
      setOpenId(entry.id);
      setSelectedCombo(null);
    }
  }

  async function claim(entry: ReceivedPass) {
    if (!user || !selectedCombo || claiming) return;
    setClaiming(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/user/pending-rewards/${entry.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ combo: selectedCombo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const suspensionInfo = parseSuspensionError(data);
        if (suspensionInfo) {
          setSuspension(suspensionInfo);
          return;
        }
        if (data.code === "NO_BIRTH_TIME") {
          setNoBirthTimeOpen(true);
          return;
        }
        setError(data.error ?? "이용권을 받지 못했어요.");
        return;
      }
      setOpenId(null);
      setSelectedCombo(null);
      await Promise.all([load(user), refreshMe()]);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="받은 이용권 내역" />
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        {entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="pt-8 text-center text-sm text-icon-muted">아직 받은 이용권이 없어요.</p>
        ) : (
          <div className="mx-auto w-full max-w-2xl divide-y divide-border border-y border-border">
            {entries.map((entry) => {
              const badge = statusBadge(entry.status);
              const open = openId === entry.id;
              const canExpand =
                entry.status === "expired" ||
                (entry.status === "pending" && Boolean(entry.comboAllowances)) ||
                (entry.status === "claimed" && Boolean(entry.claimedCombo) && Boolean(entry.comboAllowances));
              return (
                <section key={entry.id}>
                  <button
                    type="button"
                    onClick={() => canExpand && toggleOpen(entry)}
                    aria-expanded={canExpand ? open : undefined}
                    className={`grid w-full text-left ${canExpand ? "grid-cols-[1fr_auto]" : ""} ${canExpand ? "" : "cursor-default"}`}
                  >
                    {/* 화살표 자리를 "행 높이와 같은 폭의 정사각형" 영역으로 두고 그 정중앙에
                        아이콘을 놓는다(사용자 요청, 2026-09-20) — flex+aspect-square+self-stretch는
                        flex-basis(너비) 계산이 stretch로 정해질 높이보다 먼저 일어나 아이콘 크기만큼만
                        좁게 잡히는 경우가 있어(실측으로 확인) grid로 바꿈: grid는 행 높이를 먼저
                        확정한 뒤 aspect-square 칸의 너비를 그 높이에서 유도해 항상 정사각형이 된다. */}
                    <span className="min-w-0 py-4">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-base font-semibold text-bold-text">[{entry.label}]</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-icon-muted">{formatDateTime(entry.createdAt)}</span>
                    </span>
                    {canExpand && (
                      <span className="flex aspect-square items-center justify-center">
                        <BackIcon className={`h-4 w-2 text-bold-text transition-transform ${open ? "rotate-90" : "-rotate-90"}`} />
                      </span>
                    )}
                  </button>

                  {open && canExpand && (
                    <div className="mt-4 rounded-[28px] border border-border bg-surface p-4">
                      {entry.status === "pending" && entry.comboAllowances && (
                        <>
                          <p className="mb-2 text-center text-sm font-semibold text-icon-muted">
                            획득하실 {entry.label} 이용권의 옵션을 선택해주세요.
                          </p>
                          <p className="mb-3 text-center text-xs font-semibold text-urgent">
                            이 이용권의 수령 가능 기간은 지급일로부터 {formatMonths(PENDING_REWARD_CLAIM_WINDOW_MONTHS)}이며, 미수령 시 소멸됩니다.
                            <br />
                            수령 후 유효기간은 수령일로부터 {formatMonths(COUNT_PASS_VALIDITY_MONTHS)}입니다.
                          </p>
                          {error && <p className="mb-2 text-center text-sm text-urgent">{error}</p>}
                          <ComboAllowanceList
                            allowanceFor={(combo, spread) => entry.comboAllowances![combo][spread]}
                            selected={selectedCombo}
                            onSelect={selectCombo}
                          />
                          <button
                            type="button"
                            onClick={() => claim(entry)}
                            disabled={!selectedCombo || claiming}
                            className="mt-4 h-12 w-full rounded-2xl bg-point text-base font-bold text-white disabled:bg-chip-fill disabled:text-chip-muted-text disabled:opacity-60"
                          >
                            {claiming ? "받는 중..." : `${entry.label} 이용권 받기`}
                          </button>
                        </>
                      )}

                      {entry.status === "claimed" && entry.claimedCombo && entry.comboAllowances && (
                        <>
                          <p className="mb-3 text-center text-sm font-semibold text-icon-muted">
                            {entry.claimedAt && `${formatDateTime(entry.claimedAt)}에 `}
                            {COMBOS[entry.claimedCombo].label} 옵션으로 수령했어요.
                          </p>
                          <ComboAllowanceCard
                            combo={entry.claimedCombo}
                            allowanceFor={(combo, spread) => entry.comboAllowances![combo][spread]}
                          />
                        </>
                      )}

                      {entry.status === "expired" && (
                        <p className="text-center text-sm font-semibold text-icon-muted">
                          수령 가능 기간이 지나 소멸된 이용권이에요.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {noBirthTimeOpen && <NoBirthTimePopup onClose={() => setNoBirthTimeOpen(false)} />}
      {suspension && <SuspensionModal info={suspension} onClose={() => setSuspension(null)} />}
    </div>
  );
}
