"use client";

import { useState } from "react";
import Link from "next/link";
import { COIN_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";
import { TIME_PASS_TIER } from "@/lib/tarot/timePassTiers";
import SubPageTopBar from "@/components/SubPageTopBar";

type Tab = "coin" | "time";

function formatWon(won: number) {
  return `₩${won.toLocaleString("ko-KR")}`;
}

// 피그마 카드 테두리가 상품 등급이 올라갈수록 청록→파랑→보라→마젠타로 옮겨가는 그라디언트 —
// 코인 카드는 전부 같은 성운 텍스처(asset/texture/prizebg_tier_4, public/coin-texture.jpg)를
// 공유하고 테두리 색으로만 등급을 구분한다(피그마 실제 카드들도 텍스처 패턴 자체는 동일해 보임).
const COIN_BORDER = ["#2f8bee", "#2f8bee", "#3f7de0", "#6a5fd6", "#8335d6", "#a52fc4", "#ff007f"];

/** 피그마 "Screen / Buy - Coin". 실제 구매 기능은 포트원 연동 전이라 여전히 안내만 뜸(기존 동작 유지). */
export default function ChargePage() {
  const [tab, setTab] = useState<Tab>("coin");
  const [notice, setNotice] = useState(false);

  function handlePurchaseClick() {
    setNotice(true);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="코인ㆍ이용권 구입" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {notice && (
            <div className="rounded-2xl border border-point bg-point-bg p-3 text-center text-sm text-point">
              곧 만나보실 수 있어요. 조금만 기다려주세요!
            </div>
          )}

          {tab === "coin" && (
            <div className="flex flex-col gap-3">
              {COIN_PACKAGES.map((pkg, i) => {
                const bonus = pkg.coins - pkg.priceWon;
                const color = COIN_BORDER[i % COIN_BORDER.length];
                return (
                  <button
                    key={pkg.priceWon}
                    type="button"
                    onClick={handlePurchaseClick}
                    className="relative flex items-center justify-between overflow-hidden rounded-[28px] border bg-cover bg-center p-4 text-left"
                    style={{ borderColor: color, backgroundImage: "url(/coin-texture.jpg)" }}
                  >
                    <div className="absolute inset-0 bg-[#19191d]/70" />
                    <div className="relative">
                      <p className="text-xl font-bold text-white">
                        {pkg.coins.toLocaleString("ko-KR")} 코인
                      </p>
                      {bonus > 0 && (
                        <p className="text-sm font-semibold text-icon-muted">
                          {pkg.priceWon.toLocaleString("ko-KR")}+보너스 {bonus.toLocaleString("ko-KR")}
                        </p>
                      )}
                    </div>
                    <span className="relative shrink-0 rounded-full bg-point px-4 py-2 text-sm font-semibold text-white">
                      {formatWon(pkg.priceWon)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "time" && (
            <div className="flex flex-col gap-3">
              {TIME_PASS_PACKAGES.map((pkg) => {
                const tier = TIME_PASS_TIER[pkg.minutes] ?? TIME_PASS_TIER[15];
                return (
                  <button
                    key={pkg.priceWon}
                    type="button"
                    onClick={handlePurchaseClick}
                    className="relative flex items-center justify-between overflow-hidden rounded-[28px] border bg-cover bg-center p-4 text-left"
                    style={{ borderColor: tier.border, backgroundImage: `url(${tier.bg})` }}
                  >
                    <div className="absolute inset-0 bg-[#19191d]/70" />
                    <div className="relative">
                      <p className="text-xl font-bold text-white">{pkg.minutes}분 무제한</p>
                      <span
                        className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold"
                        style={{ backgroundColor: tier.tagBg, color: tier.tagText }}
                      >
                        {pkg.includesOptions ? "타로+사주+자미두수+궁합 무제한" : "타로만 무제한"}
                      </span>
                    </div>
                    <span className="relative shrink-0 rounded-full bg-point px-4 py-2 text-sm font-semibold text-white">
                      {formatWon(pkg.priceWon)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <ul className="list-disc space-y-1 pl-4 text-xs text-icon-muted">
            {tab === "coin" ? (
              <>
                <li>구입한 코인의 유효기간은 무기한이며, 사용한 코인은 환불되지 않습니다.</li>
                <li>미사용 코인은 결제일로부터 7일 이내 전액 환불 가능합니다.</li>
                <li>구입한 코인은 오래된 코인부터 소진됩니다.</li>
              </>
            ) : (
              <>
                <li>시간제 이용권은 채팅방에서 사용하기를 누른 순간부터 시간 차감이 시작되며, 브라우저를 닫아도 멈추지 않습니다.</li>
                <li>시간제 이용권을 사용중일때는 다른 이용권을 중복으로 사용할 수 없습니다.</li>
              </>
            )}
            <li>
              자세한 내용은{" "}
              <Link href="/terms" className="text-point underline">
                이용약관
              </Link>
              을 확인해주세요.
            </li>
          </ul>
        </div>
      </div>
      <div className="shrink-0 p-4">
        <div className="flex overflow-hidden rounded-full bg-chip-fill">
          <button
            type="button"
            onClick={() => setTab("coin")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "coin" ? "bg-point text-white" : "text-icon-muted"
            }`}
          >
            코인
          </button>
          <button
            type="button"
            onClick={() => setTab("time")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "time" ? "bg-point text-white" : "text-icon-muted"
            }`}
          >
            이용권
          </button>
        </div>
      </div>
    </div>
  );
}
