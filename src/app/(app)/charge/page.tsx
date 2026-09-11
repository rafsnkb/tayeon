"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase/client";
import { COIN_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";

type Tab = "coin" | "time";

function formatWon(won: number) {
  return `${won.toLocaleString("ko-KR")}원`;
}

export default function ChargePage() {
  const [, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("coin");
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      const idToken = await u.getIdToken();
      const res = await fetch("/api/user/me", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCoins(data.coins);
      }
    });
  }, []);

  function handlePurchaseClick() {
    setNotice(true);
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <h1 className="text-xl font-bold text-bold-text">코인 충전</h1>

      <div className="rounded-lg border border-border p-4">
        <span className="text-sm text-text">보유 코인</span>
        <p className="text-lg text-bold-text">{coins ?? "-"}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("coin")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            tab === "coin" ? "border-point bg-point-bg text-point" : "border-border text-text"
          }`}
        >
          코인 충전
        </button>
        <button
          type="button"
          onClick={() => setTab("time")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            tab === "time" ? "border-point bg-point-bg text-point" : "border-border text-text"
          }`}
        >
          시간제 무제한
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-point bg-point-bg p-3 text-sm text-point">
          곧 만나보실 수 있어요. 조금만 기다려주세요!
        </div>
      )}

      {tab === "coin" && (
        <div className="flex flex-col gap-3">
          {COIN_PACKAGES.map((pkg) => {
            const bonus = pkg.coins - pkg.priceWon;
            return (
              <div
                key={pkg.priceWon}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="text-lg text-bold-text">{pkg.coins.toLocaleString("ko-KR")} 코인</p>
                  <p className="text-sm text-text">{formatWon(pkg.priceWon)}</p>
                  {bonus > 0 && (
                    <span className="mt-1 inline-block rounded-full bg-point-bg px-2 py-0.5 text-xs text-point">
                      +{bonus.toLocaleString("ko-KR")} 보너스
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePurchaseClick}
                  className="rounded-full bg-cta-fill px-5 py-2 text-sm text-cta-text"
                >
                  구매하기
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "time" && (
        <div className="flex flex-col gap-3">
          {TIME_PASS_PACKAGES.map((pkg) => (
            <div
              key={pkg.priceWon}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div>
                <p className="text-lg text-bold-text">{pkg.minutes}분 무제한</p>
                <p className="text-sm text-text">{formatWon(pkg.priceWon)}</p>
                <p className="mt-1 text-xs text-text">
                  {pkg.includesOptions ? "타로+사주+자미두수+궁합 전부 무제한" : "타로만 무제한"}
                </p>
              </div>
              <button
                type="button"
                onClick={handlePurchaseClick}
                className="rounded-full bg-cta-fill px-5 py-2 text-sm text-cta-text"
              >
                구매하기
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-text">
        코인 유효기간은 무기한이며, 사용한 코인은 환불되지 않아요. 미사용 코인은 결제일로부터
        7일 이내 전액 환불 가능합니다. 자세한 내용은{" "}
        <Link href="/terms" className="text-point underline">
          이용약관
        </Link>
        을 확인해주세요.
      </p>
    </div>
  );
}
