"use client";

import { useState } from "react";
import Link from "next/link";
import PortOne, { PaymentPayMethod } from "@portone/browser-sdk/v2";
import { COIN_PACKAGES, TIME_PASS_PACKAGES } from "@/lib/tarot/pricing";
import { listCoinProductIds, listTimePassProductIds } from "@/lib/payment/products";
import { TIER_TEXTURE, TIME_PASS_TIER } from "@/lib/tarot/timePassTiers";
import SubPageTopBar from "@/components/SubPageTopBar";
import { CompanyFooter } from "@/components/CompanyFooter";
import { buildPortoneCustomer } from "@/lib/payment/customer";
import { useRooms } from "@/lib/tarot/RoomsContext";

// pricing.ts 배열과 같은 순서로 productId를 매핑한다(둘 다 COIN_PACKAGES/TIME_PASS_PACKAGES를
// 그대로 순회해서 만들어지므로 인덱스가 항상 일치한다 — src/lib/payment/products.ts 참고).
const COIN_PRODUCT_IDS = listCoinProductIds().map((p) => p.productId);
const TIME_PASS_PRODUCT_IDS = listTimePassProductIds().map((p) => p.productId);

type Tab = "coin" | "time";

function formatWon(won: number) {
  return `₩${won.toLocaleString("ko-KR")}`;
}

// 피그마 카드 테두리가 가격대별로 2개씩 짝지어 청록→파랑→보라→핑크로 올라간다
// (asset/Screen/Buy - Coin.png 픽셀 샘플링으로 확인, 2026-09-14) — 텍스처 등급 짝(COIN_TEXTURE)과
// 정확히 같은 경계라, 시간제 이용권 티어 색(TIME_PASS_TIER)을 그대로 재사용하고 청록만 추가한다.
const COIN_TEAL = "#2fe0c8";
const COIN_BORDER = [
  COIN_TEAL,
  COIN_TEAL,
  TIME_PASS_TIER[15].border,
  TIME_PASS_TIER[15].border,
  TIME_PASS_TIER[30].border,
  TIME_PASS_TIER[30].border,
  TIME_PASS_TIER[60].border,
];
// "N+보너스 M" 알약 배경 — 전부 같은 검정이 아니라 카드 테두리 색조를 따라 은은하게 짙어짐
// (asset/Screen/Buy - Coin.png 6곳 픽셀 샘플링으로 확인, 2026-09-15: 청록 rgb(35,54,78)/
// 파랑 rgb(25,50,73)/보라 rgb(41,36,67)/핑크 rgb(57,32,57) — 티어별 tagBg와 계열이 같아 재사용).
const COIN_TEAL_BONUS_BG = "#23364e";
const COIN_BONUS_BG = [
  COIN_TEAL_BONUS_BG,
  COIN_TEAL_BONUS_BG,
  TIME_PASS_TIER[15].tagBg,
  TIME_PASS_TIER[15].tagBg,
  TIME_PASS_TIER[30].tagBg,
  TIME_PASS_TIER[30].tagBg,
  TIME_PASS_TIER[60].tagBg,
];
// 코인 상품 7종이 성운 텍스처 4장을 가격대별로 나눠 쓴다(1,100/3,500→tier4, 6,000/14,000→tier3,
// 40,000/65,000→tier2, 135,000→tier1 — 사용자가 직접 지정한 매핑, 2026-09-14).
const COIN_TEXTURE = [
  TIER_TEXTURE[4],
  TIER_TEXTURE[4],
  TIER_TEXTURE[3],
  TIER_TEXTURE[3],
  TIER_TEXTURE[2],
  TIER_TEXTURE[2],
  TIER_TEXTURE[1],
];

/** 피그마 "Screen / Buy - Coin". 포트원 V2 결제창을 직접 호출해 코인/시간제 이용권을 구매한다. */
export default function ChargePage() {
  const [tab, setTab] = useState<Tab>("coin");
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { user, email, nickname, refreshMe } = useRooms();

  async function handlePurchase(productId: string) {
    if (!user || purchasingId) return;
    setPurchasingId(productId);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();

      // 1. 서버에 결제 준비를 요청 — 금액/주문명은 서버가 pricing.ts 기준으로 정해서 내려준다.
      const prepareRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ productId }),
      });
      if (!prepareRes.ok) {
        setNotice({ type: "error", message: "결제 준비에 실패했어요. 잠시 후 다시 시도해주세요." });
        return;
      }
      const prepared = await prepareRes.json();

      // 2. 포트원 V2 결제창 호출(KG이니시스). channelKey만으로 PG가 결정되므로 이 로직 자체는
      // PG사가 바뀌어도 그대로 유지된다 — .env.local의 채널 키만 교체하면 된다.
      const payment = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: prepared.paymentId,
        orderName: prepared.orderName,
        totalAmount: prepared.totalAmount,
        currency: prepared.currency,
        payMethod: PaymentPayMethod.CARD,
        customData: prepared.customData,
        customer: buildPortoneCustomer({ uid: user.uid, email, nickname }),
      });
      if (!payment) {
        // redirectUrl 지정 시에만 undefined가 반환된다(리디렉션 방식) — 이 페이지는 사용하지 않음.
        setNotice({ type: "error", message: "결제 응답을 받지 못했어요." });
        return;
      }
      if (payment.code !== undefined) {
        // 사용자가 결제창을 닫았거나 PG 단계에서 실패한 경우 — 아직 지급 전이라 서버 상태 변경 없음.
        setNotice({ type: "error", message: payment.message ?? "결제가 취소됐어요." });
        return;
      }

      // 3. 서버에 완료 처리 요청 — 실제 지급은 서버가 포트원에 재조회해서 검증한 뒤에만 이뤄진다.
      // (브라우저가 여기서 끊겨도 /api/payment/webhook이 같은 로직으로 지급을 보장한다.)
      const completeRes = await fetch("/api/payment/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ paymentId: payment.paymentId }),
      });
      const completed = await completeRes.json();
      if (completeRes.ok && completed.status === "PAID") {
        await refreshMe();
        setNotice({ type: "info", message: "결제가 완료됐어요!" });
      } else {
        setNotice({
          type: "error",
          message: completed.error ?? "결제 확인에 실패했어요. 고객센터로 문의해주세요.",
        });
      }
    } catch (error) {
      console.error("[charge] 결제 실패", error);
      setNotice({ type: "error", message: "결제 중 오류가 발생했어요." });
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg">
      <SubPageTopBar title="코인ㆍ이용권 구입" />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {notice && (
            <div
              className={`rounded-2xl border p-3 text-center text-sm ${
                notice.type === "error"
                  ? "border-urgent bg-urgent/10 text-urgent"
                  : "border-point bg-point-bg text-point"
              }`}
            >
              {notice.message}
            </div>
          )}

          {tab === "coin" && (
            <div className="flex flex-col gap-3">
              {COIN_PACKAGES.map((pkg, i) => {
                const bonus = pkg.coins - pkg.priceWon;
                const color = COIN_BORDER[i % COIN_BORDER.length];
                const bonusBg = COIN_BONUS_BG[i % COIN_BONUS_BG.length];
                const bg = COIN_TEXTURE[i % COIN_TEXTURE.length];
                const productId = COIN_PRODUCT_IDS[i];
                return (
                  <button
                    key={pkg.priceWon}
                    type="button"
                    onClick={() => handlePurchase(productId)}
                    disabled={purchasingId !== null}
                    className="relative flex h-20 items-center justify-between overflow-hidden rounded-[28px] border bg-cover bg-center p-4 text-left disabled:opacity-60"
                    style={{ borderColor: color, backgroundImage: `url(${bg})` }}
                  >
                    <div className="absolute inset-0 bg-[#19191d]/70" />
                    <div className="relative">
                      <p className="text-xl font-bold text-white">
                        {pkg.coins.toLocaleString("ko-KR")} 코인
                      </p>
                      {bonus > 0 && (
                        <p
                          className="mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold"
                          style={{ color, backgroundColor: bonusBg }}
                        >
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
              {TIME_PASS_PACKAGES.map((pkg, i) => {
                const tier = TIME_PASS_TIER[pkg.minutes] ?? TIME_PASS_TIER[15];
                const productId = TIME_PASS_PRODUCT_IDS[i];
                return (
                  <button
                    key={pkg.priceWon}
                    type="button"
                    onClick={() => handlePurchase(productId)}
                    disabled={purchasingId !== null}
                    className="relative flex items-center justify-between overflow-hidden rounded-[28px] border bg-cover bg-center p-4 text-left disabled:opacity-60"
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

          <ul className="list-disc space-y-1 rounded-[28px] border border-border bg-topbar p-4 pl-8 text-xs text-icon-muted">
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
              <Link href="/terms" className="font-bold text-point underline">
                이용약관
              </Link>
              을 확인해주세요.
            </li>
          </ul>
          {/* PG(KG이니시스) 입점심사 요건: 사업자정보가 메인 화면뿐 아니라 결제 페이지에도
              상시 노출돼야 함(help.portone.io/content/requirements) — 기존엔 /me에만 있었음. */}
          <CompanyFooter />
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        <div className="mx-auto flex w-full max-w-2xl overflow-hidden rounded-full bg-chip-fill">
          <button
            type="button"
            onClick={() => setTab("coin")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "coin" ? "bg-point text-white" : "text-white"
            }`}
          >
            코인
          </button>
          <button
            type="button"
            onClick={() => setTab("time")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "time" ? "bg-point text-white" : "text-white"
            }`}
          >
            이용권
          </button>
        </div>
      </div>
    </div>
  );
}
