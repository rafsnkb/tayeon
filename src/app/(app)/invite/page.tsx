"use client";

import { useEffect, useState } from "react";
import SubPageTopBar from "@/components/SubPageTopBar";
import { useRooms } from "@/lib/tarot/RoomsContext";
import {
  REFERRAL_MONTHLY_COMMISSION_RATE,
  REFERRAL_MONTHLY_MIN_WON,
  REFERRAL_SIGNUP_FRIEND_CAP,
  REFERRAL_SIGNUP_FREE_PASSES,
  REWARD_PAYOUT_DAY_OF_MONTH,
  rewardPassesForWon,
} from "@/lib/tarot/pricing";

// 안내 문구의 예시. 예전엔 "25회"가 문자열로 박혀 있었는데, 원카드 단가가 200 → 300으로
// 오르면서(2026-09-24) 실제 지급은 17회가 돼 광고와 어긋났다. 같은 함수로 계산해서 가격표가
// 또 바뀌어도 문구가 저절로 따라오게 한다.
const EXAMPLE_FRIEND_SPEND_WON = 200_000;
const EXAMPLE_PAYOUT_PASSES = rewardPassesForWon(EXAMPLE_FRIEND_SPEND_WON, REFERRAL_MONTHLY_COMMISSION_RATE);

/** 피그마 "Screen / FriendInvite" — asset/Screen/friendInvite.png. 카카오톡 친구 목록/메시지
 * API는 신청 심사(영업일 3~5일)+건당 발신 비용이 들어서, 심사 없이 즉시 쓸 수 있는 "링크 복사"
 * 방식으로 구현했다(2026-09-15 결정 기록, doc/작업현황.md "바이럴/그로스 기능" 참고). */
export default function InvitePage() {
  const { user } = useRooms();
  const [code, setCode] = useState<string | null>(null);
  /** 초대해서 가입한 친구 수. **0 이 아니라 null 로 시작한다**(2026-09-25) — 0 으로 두면
   *  조회가 끝나기 전 수백 ms 동안 "가입한 친구: 0명"이 사실처럼 보였다가 실제 숫자로
   *  바뀐다. 이 화면은 그 숫자 하나를 보러 오는 화면이라, 짧아도 0 을 보여주면 안 된다. */
  const [invitedFriends, setInvitedFriends] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  /** 실패를 따로 든다(2026-09-26). null 센티넬로 바꾸면서 생긴 자리다 — 예전엔 실패해도
   *  "0명"이 떴지만(틀린 값), 지금은 "-" 와 죽은 복사 버튼이 **이유 없이** 남는다.
   *  실패를 말하지 않으면 사용자는 앱이 멈춘 건지 친구가 없는 건지 구분할 수 없다. */
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // getIdToken·fetch·json 이 던지면 여기서 끝내야 한다 — 안 그러면 unhandled rejection 으로
      // 새어나가고 화면은 "-" 인 채로 남는다(RoomsContext 는 같은 자리를 이미 감싸고 있다).
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/referral/me", { headers: { Authorization: `Bearer ${idToken}` } });
        if (!res.ok) {
          setLoadFailed(true);
          return;
        }
        const data = await res.json();
        setCode(data.code);
        setInvitedFriends(data.invitedFriends);
      } catch {
        setLoadFailed(true);
      }
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

      <div className="flex-1 overflow-visible p-4 pt-20 xl:overflow-y-auto scroll-gutter-stable">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <section className="rounded-[32px] border border-border bg-topbar p-6 text-center">
            <h2 className="text-xl font-bold text-bold-text">친구 초대 리워드 - {REFERRAL_SIGNUP_FREE_PASSES}회</h2>
            <p className="mt-3 text-sm font-semibold text-icon-muted">
              친구를 초대하면 {REFERRAL_SIGNUP_FREE_PASSES}회 무료 이용권을 드려요!<br />
              나와 친구 모두 받을 수 있어요!
            </p>
            <p className="mt-1 text-sm font-semibold text-point-text">(최대 {REFERRAL_SIGNUP_FRIEND_CAP}명)</p>
            <p className="mt-4 text-base font-bold text-bold-text">
              {loadFailed
                ? "초대 현황을 불러오지 못했어요."
                : `내 링크로 가입한 친구: ${invitedFriends ?? "-"}/${REFERRAL_SIGNUP_FRIEND_CAP}명`}
            </p>
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
              친구들의 이번 달 총 결제액이 {(REFERRAL_MONTHLY_MIN_WON / 10_000).toLocaleString("ko-KR")}만 원 이상일 때 지급돼요.<br />
              (예: 친구들의 이번 달 총 결제액이 {(EXAMPLE_FRIEND_SPEND_WON / 10_000).toLocaleString("ko-KR")}만 원이면<br />
              다음 달 {REWARD_PAYOUT_DAY_OF_MONTH}일에 원카드 기준 {EXAMPLE_PAYOUT_PASSES}회 이용권 지급)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
