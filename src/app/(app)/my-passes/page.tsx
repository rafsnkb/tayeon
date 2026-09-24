"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { formatDateTime } from "@/lib/util/formatDate";
import { COMBOS, SPREADS, SPREAD_ORDER, type ComboKey } from "@/lib/tarot/pricing";
import SubPageTopBar from "@/components/SubPageTopBar";
import { ComboAllowanceCard } from "@/components/ComboAllowanceCard";
import MyPassTabs from "@/components/MyPassTabs";
import InfoModal from "@/components/InfoModal";
import { BackIcon } from "../tarot/icons";

type HeldPass = {
  id: string;
  kind: "countPass" | "timePass";
  title: string;
  combo: ComboKey | "any" | null;
  acquiredLabel: "구입" | "수령";
  acquiredAt: string;
  expiresAt: string | null;
  refundPending: boolean;
  paymentId: string | null;
  allowances: Record<string, number> | null;
  minutes: number | null;
};

/** 목업(MyPass_Held)의 표 제목 — 구매분은 "구입 옵션", 무상 지급분은 고를 수 있었으니 "선택 옵션". */
const tableTitle = (label: "구입" | "수령") => (label === "구입" ? "구입한 옵션" : "선택한 옵션");

/** 조합이 확정된 이용권만 조합 카드로 그릴 수 있다. 운영자 지급분은 "모든 옵션"일 수 있다. */
function isComboKey(combo: ComboKey | "any" | null): combo is ComboKey {
  return combo !== null && combo !== "any";
}

function comboLabel(combo: ComboKey | "any" | null): string | null {
  if (!combo) return null;
  return combo === "any" ? "모든 옵션" : COMBOS[combo].label;
}

/** "원카드+사주+자미두수" 처럼 조합을 스프레드 이름 뒤에 붙인다. */
function spreadLabel(spread: (typeof SPREAD_ORDER)[number], combo: ComboKey | "any" | null): string {
  const options = combo && combo !== "any" ? COMBOS[combo] : null;
  if (!options) return SPREADS[spread].label;
  return `${SPREADS[spread].label}${options.saju ? "+사주" : ""}${options.ziwei ? "+자미두수" : ""}`;
}

/**
 * "내 보유 이용권" — 지금 들고 있는 이용권만 모아 보여준다(목업 MyPass_Held).
 *
 * 그동안 사용자가 볼 수 있는 건 "받은 이용권 내역"(어디서 왔는지)뿐이어서 **지금 내가 무엇을
 * 들고 있는지**를 보는 화면이 없었다. 특히 환불 신청 중인 이용권은 "쓸 수 있는 목록"에서
 * 빠지는 탓에 앱 어디에도 나타나지 않았다(2026-09-24).
 */
export default function MyPassesPage() {
  const [passes, setPasses] = useState<HeldPass[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const load = useCallback(async (user: User) => {
    const res = await fetch("/api/user/held-passes", {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    setPasses(res.ok ? (await res.json()).passes : []);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { if (u) void load(u); }), [load]);

  /** 환불 신청을 물린다. 결제 내역 화면과 같은 엔드포인트다 — 잠긴 이용권을 보고 있는 자리에서
   *  바로 풀 수 있어야 한다. */
  async function cancelRefund(pass: HeldPass) {
    const user = auth.currentUser;
    if (!user || !pass.paymentId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/user/refund-requests/${encodeURIComponent(pass.paymentId)}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice({ message: body.error ?? "환불 취소에 실패했어요.", tone: "error" });
        return;
      }
      await load(user);
      setNotice({ message: "환불 요청을 취소했어요.", tone: "info" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="내 보유 이용권" />
      <div className="flex-1 overflow-visible p-4 pb-28 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        {passes === null ? (
          <p className="pt-8 text-center text-sm text-icon-muted">불러오는 중...</p>
        ) : passes.length === 0 ? (
          <p className="pt-8 text-center text-sm leading-relaxed text-icon-muted">
            보유 중인 이용권이 없어요.
            <br />
            이용권을 구입하면 여기에 표시돼요.
          </p>
        ) : (
          <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-border bg-topbar p-4">
            <div className="divide-y divide-chip-soft">
              {passes.map((pass) => {
                const open = openId === pass.id;
                // 시간제는 스프레드별 횟수가 없으니(무제한) 펼칠 것도 없다.
                const expandable = Boolean(pass.allowances);
                return (
                  <section key={pass.id} className="py-4 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => expandable && setOpenId(open ? null : pass.id)}
                      aria-expanded={expandable ? open : undefined}
                      className={`grid w-full text-left ${expandable ? "grid-cols-[1fr_auto]" : "cursor-default"}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-2xl font-bold text-chip-soft-text">{pass.title}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          {pass.combo && (
                            <span className="rounded-full bg-chip-soft px-3 py-1 text-base font-semibold text-placeholder">
                              {comboLabel(pass.combo)}
                            </span>
                          )}
                          {/* 잠긴 이용권임을 여기서 말해 준다 — 목록에 있는데 쓸 수 없으면
                              사용자는 고장으로 읽는다. */}
                          {pass.refundPending && (
                            <span className="rounded-full bg-chip-soft px-3 py-1 text-base font-semibold text-urgent">
                              환불 대기중
                            </span>
                          )}
                        </span>
                        <span className="mt-1.5 block text-sm text-placeholder">
                          {pass.acquiredLabel} 날짜: {formatDateTime(pass.acquiredAt)}
                        </span>
                      </span>
                      {expandable && (
                        <span className="flex w-6 items-center justify-center">
                          <BackIcon
                            className={`h-4 w-2 text-placeholder transition-transform ${open ? "rotate-90" : "-rotate-90"}`}
                          />
                        </span>
                      )}
                    </button>

                    {pass.refundPending && pass.paymentId && (
                      <button
                        type="button"
                        onClick={() => cancelRefund(pass)}
                        disabled={busy}
                        className="mt-2 text-sm font-semibold text-point-text underline disabled:opacity-50"
                      >
                        환불 취소
                      </button>
                    )}

                    {open && pass.allowances && (
                      <div className="mt-3">
                        {/* 목업(MyPass_Held, 2026-09-25 개정)이 세로 표에서 **조합 카드 + 가로 4열**로
                            바뀌었다 — 구입 화면·리워드 모달과 같은 표다. 제목은 18px(실측). */}
                        <p className="mb-2 text-center text-lg font-bold text-placeholder">
                          {tableTitle(pass.acquiredLabel)}
                        </p>
                        {isComboKey(pass.combo) ? (
                          <ComboAllowanceCard
                            layout="columns"
                            combo={pass.combo}
                            allowanceFor={(_combo, spread) => pass.allowances?.[spread] ?? 0}
                          />
                        ) : (
                          /* 운영자가 조합 없이("모든 옵션") 지급한 옛 이용권은 조합 카드로 그릴 수
                             없다 — 스프레드 이름만 세로로 보여준다. */
                          <div className="rounded-2xl bg-chip-soft p-2">
                            {SPREAD_ORDER.map((spread) => (
                              <div key={spread} className="flex justify-between gap-2 px-3 py-1.5 text-sm">
                                <span className="text-placeholder">{spreadLabel(spread, pass.combo)}</span>
                                <span className="font-bold text-chip-soft-text">{pass.allowances?.[spread] ?? 0}회</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <MyPassTabs />
      {notice && <InfoModal title={notice.message} tone={notice.tone} onClose={() => setNotice(null)} />}
    </div>
  );
}
