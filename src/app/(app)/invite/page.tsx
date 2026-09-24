"use client";

import { useEffect, useState } from "react";
import SubPageTopBar from "@/components/SubPageTopBar";
import { useRooms } from "@/lib/tarot/RoomsContext";
import {
  REFERRAL_MONTHLY_COMMISSION_RATE,
  REFERRAL_SIGNUP_FRIEND_CAP,
  REFERRAL_SIGNUP_FREE_PASSES,
  REWARD_PAYOUT_DAY_OF_MONTH,
  rewardPassesForWon,
} from "@/lib/tarot/pricing";

// 안내 문구의 예시. 예전엔 "25회"가 문자열로 박혀 있었는데, 원카드 단가가 200 → 300으로
// 오르면서(2026-09-24) 실제 지급은 17회가 돼 광고와 어긋났다. 같은 함수로 계산해서 가격표가
// 또 바뀌어도 문구가 저절로 따라오게 한다.
const EXAMPLE_FRIEND_SPEND_WON = 100_000;
const EXAMPLE_PAYOUT_PASSES = rewardPassesForWon(EXAMPLE_FRIEND_SPEND_WON, REFERRAL_MONTHLY_COMMISSION_RATE);

/** 피그마 "Screen / FriendInvite" — asset/Screen/friendInvite.png. 카카오톡 친구 목록/메시지
 * API는 신청 심사(영업일 3~5일)+건당 발신 비용이 들어서, 심사 없이 즉시 쓸 수 있는 "링크 복사"
 * 방식으로 구현했다(2026-09-15 결정 기록, doc/작업현황.md "바이럴/그로스 기능" 참고). */
export default function InvitePage() {
  const { user } = useRooms();
  const [code, setCode] = useState<string | null>(null);
  const [invitedFriends, setInvitedFriends] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/referral/me", { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) return;
      const data = await res.json();
      setCode(data.code);
      setInvitedFriends(data.invitedFriends);
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
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="친구 초대" />

      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <section className="rounded-[32px] border border-border bg-topbar p-6 text-center">
            <h2 className="text-xl font-bold text-bold-text">친구 초대 리워드 - {REFERRAL_SIGNUP_FREE_PASSES}회</h2>
            <p className="mt-3 text-sm font-semibold text-icon-muted">
              친구를 초대하면 {REFERRAL_SIGNUP_FREE_PASSES}회 무료 이용권을 드려요!<br />
              나와 친구 모두 받을 수 있어요!
            </p>
            <p className="mt-1 text-sm font-semibold text-point-text">(최대 {REFERRAL_SIGNUP_FRIEND_CAP}명)</p>
            <p className="mt-4 text-base font-bold text-bold-text">내 링크로 가입한 친구: {invitedFriends}/{REFERRAL_SIGNUP_FRIEND_CAP}명</p>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!code}
            className="mt-8 h-12 w-full rounded-2xl bg-point text-base font-semibold text-white disabled:opacity-60"
          >
            {copied ? "복사되었어요!" : "초대 링크 복사"}
          </button>
          </section>
          <section className="rounded-[32px] border border-border bg-topbar p-6 text-center">
            <h2 className="text-xl font-bold text-bold-text">친구 결제 리워드 - 무제한</h2>
            <p className="mt-3 text-sm font-semibold text-bold-text">친구 결제 금액의 {REFERRAL_MONTHLY_COMMISSION_RATE * 100}%를 보너스로!</p>
            <p className="mt-6 text-sm font-semibold text-bold-text">
              내 초대로 가입한 친구가 결제하면,<br />
              결제 비용의 {REFERRAL_MONTHLY_COMMISSION_RATE * 100}%를 이용권으로 환산해<br />
              매월 {REWARD_PAYOUT_DAY_OF_MONTH}일에 보내드려요.
            </p>
            <p className="mt-5 text-xs font-semibold text-icon-muted">
              (예: 친구들의 이번 달 총 결제액이 {(EXAMPLE_FRIEND_SPEND_WON / 10_000).toLocaleString("ko-KR")}만 원이면<br />
              다음 달 {REWARD_PAYOUT_DAY_OF_MONTH}일에 원카드 기준 {EXAMPLE_PAYOUT_PASSES}회 이용권 지급)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
