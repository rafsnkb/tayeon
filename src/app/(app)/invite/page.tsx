"use client";

import { useEffect, useState } from "react";
import SubPageTopBar from "@/components/SubPageTopBar";
import { useRooms } from "@/lib/tarot/RoomsContext";
import {
  REFERRAL_MONTHLY_COMMISSION_RATE,
  REFERRAL_SIGNUP_REWARD_CAP,
  REFERRAL_SIGNUP_REWARD_COINS,
} from "@/lib/tarot/pricing";

/** 피그마 "Screen / FriendInvite" — asset/Screen/friendInvite.png. 카카오톡 친구 목록/메시지
 * API는 신청 심사(영업일 3~5일)+건당 발신 비용이 들어서, 심사 없이 즉시 쓸 수 있는 "링크 복사"
 * 방식으로 구현했다(2026-09-15 결정 기록, doc/작업현황.md "바이럴/그로스 기능" 참고). */
export default function InvitePage() {
  const { user } = useRooms();
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(REFERRAL_SIGNUP_REWARD_CAP);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/referral/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) return;
      const data = await res.json();
      setCode(data.code);
      setRemaining(data.remaining);
    })();
  }, [user]);

  async function handleCopy() {
    if (!code) return;
    const link = `${window.location.origin}/login?ref=${code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="친구 초대" />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-[32px] border border-border bg-topbar p-6">
          <div className="flex flex-col items-center gap-1 text-center text-sm font-semibold text-icon-muted">
            <p>
              내 초대 링크로 친구가 타연에 가입할 때마다
              <br />
              {REFERRAL_SIGNUP_REWARD_COINS}코인을 드려요
            </p>
            <p className="text-point">(최대 {REFERRAL_SIGNUP_REWARD_CAP}코인 획득 가능)</p>
          </div>

          <p className="text-center text-base font-bold text-bold-text">남은 획득 가능 코인: {remaining}코인</p>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!code}
            className="h-12 w-full rounded-2xl bg-point text-base font-semibold text-white disabled:opacity-60"
          >
            {copied ? "복사되었어요!" : "초대 링크 복사"}
          </button>

          <div className="flex flex-col items-center gap-4 border-t border-border pt-6 text-center">
            <p className="text-sm font-semibold text-icon-muted">
              내 초대 링크로 타연에 가입한 친구가
              <br />
              타연에서 결제를 할 때마다,
              <br />
              결제 비용의 {REFERRAL_MONTHLY_COMMISSION_RATE * 100}%에 해당하는 코인(VAT 제외)이
              <br />
              나에게 매월 n일에 보너스 리워드로 지급됩니다.
            </p>
            <p className="text-xs font-semibold text-icon-muted/70">
              예) 내 초대 링크로 타연에 가입한 친구들의
              <br />
              이번달 결제 비용이 총합 10만원이라면,
              <br />
              다음달 n일에 나에게 5,000코인 지급
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
