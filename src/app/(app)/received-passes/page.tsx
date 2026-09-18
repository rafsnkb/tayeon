"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import SubPageTopBar from "@/components/SubPageTopBar";
import { COMBOS, type ComboKey, type SpreadKey } from "@/lib/tarot/pricing";
import { useRooms } from "@/lib/tarot/RoomsContext";
import NoBirthTimePopup from "@/components/NoBirthTimePopup";
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

const SPREAD_KEYS: SpreadKey[] = ["one", "three", "dual", "celtic"];
const SPREAD_SHORT: Record<SpreadKey, string> = {
  one: "원 카드", three: "쓰리 카드", dual: "양자택일", celtic: "켈틱 크로스",
};
const COMBO_KEYS = Object.keys(COMBOS) as ComboKey[];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function statusBadge(status: ReceivedPass["status"]) {
  if (status === "pending") return { label: "미수령", className: "bg-cta-fill text-cta-text" };
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
    if (entry.status !== "pending") return;
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
      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        {entries === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : entries.length === 0 ? (
          <p className="pt-8 text-center text-sm text-icon-muted">아직 받은 이용권이 없어요.</p>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {entries.map((entry) => {
              const badge = statusBadge(entry.status);
              const open = openId === entry.id;
              return (
                <div key={entry.id} className="overflow-hidden rounded-[28px] border border-border bg-topbar">
                  <button
                    type="button"
                    onClick={() => toggleOpen(entry)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-base font-semibold text-bold-text">[{entry.label}]</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-icon-muted">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    {entry.status === "pending" && (
                      <span className="shrink-0 text-icon-muted">{open ? "▲" : "▼"}</span>
                    )}
                  </button>

                  {open && entry.status === "pending" && entry.comboAllowances && (
                    <div className="px-4 pb-4">
                      <p className="mb-2 text-center text-sm font-semibold text-icon-muted">
                        획득하실 {entry.label} 이용권의 옵션을 선택해주세요.
                      </p>
                      {error && <p className="mb-2 text-center text-sm text-urgent">{error}</p>}
                      <div className="flex flex-col gap-3">
                        {COMBO_KEYS.map((combo) => {
                          const isSelected = selectedCombo === combo;
                          return (
                            <button
                              key={combo}
                              type="button"
                              onClick={() => selectCombo(combo)}
                              className={`relative rounded-[28px] bg-topbar p-4 text-left ${
                                isSelected ? "border-2 border-point" : "border border-border"
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-center">
                                <p className="text-sm font-semibold text-bold-text">{COMBOS[combo].label}</p>
                                <span className={`absolute right-4 top-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-point" : "bg-[#34363c]"}`}>
                                  <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-white" : "bg-[#70747d]"}`} />
                                </span>
                              </div>
                              <div className="rounded-2xl bg-border p-3 text-xs">
                                <div className="flex justify-between rounded bg-topbar px-2 py-1 font-semibold text-icon-muted"><span>옵션 이름</span><span>질문 가능 횟수</span></div>
                                {SPREAD_KEYS.map((spread) => (
                                  <div key={spread} className="flex justify-between gap-2 px-2 py-1 text-icon-muted">
                                    <span>
                                      {SPREAD_SHORT[spread]}
                                      {COMBOS[combo].saju ? "+사주" : ""}
                                      {COMBOS[combo].ziwei ? "+자미두수" : ""}
                                    </span>
                                    <strong className="shrink-0 text-white">{entry.comboAllowances![combo][spread]}회</strong>
                                  </div>
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => claim(entry)}
                        disabled={!selectedCombo || claiming}
                        className="mt-4 h-12 w-full rounded-2xl bg-point text-base font-bold text-white disabled:bg-chip-fill disabled:text-icon-muted disabled:opacity-60"
                      >
                        {claiming ? "받는 중..." : `${entry.label} 이용권 받기`}
                      </button>
                    </div>
                  )}
                </div>
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
