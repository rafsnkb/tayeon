"use client";

import { useState } from "react";
import Link from "next/link";
import PortOne, { PaymentPayMethod } from "@portone/browser-sdk/v2";
import { COUNT_PACKAGES, TIME_PASS_PACKAGES, countAllowance, availableCount, type SpreadKey } from "@/lib/tarot/pricing";
import { listTimePassProductIds } from "@/lib/payment/products";
import { TIER_TEXTURE, TIME_PASS_TIER } from "@/lib/tarot/timePassTiers";
import SubPageTopBar from "@/components/SubPageTopBar";
import { CompanyFooter } from "@/components/CompanyFooter";
import { buildPortoneCustomer } from "@/lib/payment/customer";
import { useRooms } from "@/lib/tarot/RoomsContext";

const TIME_PASS_PRODUCT_IDS = listTimePassProductIds().map((p) => p.productId);

type Tab = "count" | "time";

function formatWon(won: number) {
  return `₩${won.toLocaleString("ko-KR")}`;
}

// 피그마 카드 테두리가 가격대별로 2개씩 짝지어 청록→파랑→보라→핑크로 올라간다
// (asset/Screen/Buy - Coin.png 픽셀 샘플링으로 확인, 2026-09-14) — 텍스처 등급 짝(COIN_TEXTURE)과
// 정확히 같은 경계라, 시간제 이용권 티어 색(TIME_PASS_TIER)을 그대로 재사용하고 청록만 추가한다.
const COUNT_TIERS = [
  { border: "#9de9ed", text: "#9de9ed", tagBg: "rgba(12, 68, 86, 0.86)", bg: TIER_TEXTURE[4] },
  { border: "#2f8bee", text: "#66b0ff", tagBg: "rgba(15, 52, 98, 0.86)", bg: TIER_TEXTURE[3] },
  { border: "#2f8bee", text: "#66b0ff", tagBg: "rgba(15, 52, 98, 0.86)", bg: TIER_TEXTURE[3] },
  { border: "#8335d6", text: "#a04ff8", tagBg: "rgba(56, 24, 82, 0.86)", bg: TIER_TEXTURE[2] },
  { border: "#8335d6", text: "#a04ff8", tagBg: "rgba(56, 24, 82, 0.86)", bg: TIER_TEXTURE[2] },
  { border: "#ff007f", text: "#ff007f", tagBg: "rgba(82, 17, 59, 0.86)", bg: TIER_TEXTURE[1] },
];

const SPREAD_KEYS: SpreadKey[] = ["one", "three", "dual", "celtic"];
const SPREAD_SHORT: Record<SpreadKey, string> = {
  one: "원 카드", three: "쓰리 카드", dual: "양자택일", celtic: "켈틱 크로스",
};

/** 피그마 "Screen / Buy - Coin". 포트원 V2 결제창을 직접 호출해 코인/시간제 이용권을 구매한다. */
export default function ChargePage() {
  const [tab, setTab] = useState<Tab>("count");
  const [selected, setSelected] = useState<(typeof COUNT_PACKAGES)[number] | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const { user, email, nickname, refreshMe, countPasses } = useRooms();
  const hasCountPass = countPasses.some(
    (pass) => pass.source === "purchase" && availableCount(pass, "one", false, false) > 0
  );

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
        const failed = await prepareRes.json().catch(() => ({}));
        setNotice({ type: "error", message: failed.error ?? "결제 준비에 실패했어요. 잠시 후 다시 시도해주세요." });
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
    <div className="flex h-full flex-col overflow-hidden bg-[#f8f5fc]">
      <SubPageTopBar title={selected ? "구입하기" : "횟수ㆍ시간제 이용권 구입"} onBack={selected ? () => setSelected(null) : undefined} />
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

          {selected && (
            <>
              <div
                className="relative flex h-20 items-center overflow-hidden rounded-[28px] border bg-cover bg-center p-4"
                style={{ borderColor: COUNT_TIERS[COUNT_PACKAGES.indexOf(selected)].border, backgroundImage: `url(${COUNT_TIERS[COUNT_PACKAGES.indexOf(selected)].bg})` }}
              >
                <div className="absolute inset-0 bg-[#19191d]/70" />
                <div className="relative">
                  <p className="text-xl font-bold text-white">{selected.name} 이용권</p>
                  <span
                    className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold"
                    style={{
                      color: COUNT_TIERS[COUNT_PACKAGES.indexOf(selected)].text,
                      backgroundColor: COUNT_TIERS[COUNT_PACKAGES.indexOf(selected)].tagBg,
                    }}
                  >
                    {selected.bonus}
                  </span>
                </div>
              </div>
              <div className="px-4 text-sm font-semibold text-[#3d2c58]">
                <p>결제금액</p>
                <div className="mt-2 flex justify-between text-[#75628b]"><span>상품금액 (VAT 포함)</span><span>{selected.priceWon.toLocaleString("ko-KR")}원</span></div>
                <div className="mt-2 flex justify-between border-t border-[#e2d8ef] pt-2"><span>총 결제금액</span><span>{selected.priceWon.toLocaleString("ko-KR")}원</span></div>
              </div>
              <p className="mt-2 text-center text-sm font-semibold text-[#75628b]">이용권 상세정보</p>
              <div className="rounded-[28px] border border-[#dfd2ee] bg-[#fdfcff] p-4">
                {[
                  { title: "타로만 사용 시", saju: false, ziwei: false },
                  { title: "타로+사주 사용 시", saju: true, ziwei: false },
                  { title: "타로+자미두수 사용 시", saju: false, ziwei: true },
                  { title: "타로+사주+자미두수 사용 시", saju: true, ziwei: true },
                ].map((group, index) => (
                  <div key={group.title} className={index ? "mt-3 border-t border-[#ded0ed] pt-3" : ""}>
                    <p className="mb-2 text-center text-sm font-semibold text-[#75628b]">{group.title}</p>
                    <div className="rounded-2xl bg-[#f6f1fb] p-3 text-xs">
                      <div className="flex justify-between rounded bg-[#79678f] px-2 py-1 font-semibold text-white"><span>옵션 이름</span><span>질문 가능 횟수</span></div>
                      {SPREAD_KEYS.map((spread) => (
                        <div key={spread} className="flex justify-between gap-2 px-2 py-1 text-[#75628b]">
                          <span>{SPREAD_SHORT[spread]}{group.saju ? "+사주" : ""}{group.ziwei ? "+자미두수" : ""}</span>
                          <strong className="shrink-0 text-[#75628b]">{countAllowance(selected.basis, spread, group.saju, group.ziwei)}회</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {hasCountPass && <p className="text-center text-sm text-urgent">보유 이용권을 소진한 후 새 이용권을 구매할 수 있어요.</p>}
            </>
          )}
          {!selected && tab === "count" && (
            <div className="flex flex-col gap-3">
              {COUNT_PACKAGES.map((pkg, i) => {
                const tier = COUNT_TIERS[i];
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelected(pkg)}
                    disabled={purchasingId !== null}
                    className="relative flex h-20 items-center justify-between overflow-hidden rounded-[28px] border bg-cover bg-center p-4 text-left disabled:opacity-60"
                    style={{ borderColor: tier.border, backgroundImage: `url(${tier.bg})` }}
                  >
                    <div className="absolute inset-0 bg-[#19191d]/70" />
                    <div className="relative">
                      <p className="text-xl font-bold text-white">
                        {pkg.name} 이용권
                      </p>
                      <span
                        className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold"
                        style={{ color: tier.text, backgroundColor: tier.tagBg }}
                      >
                        {pkg.bonus}
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

          {!selected && tab === "time" && (
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

          {!selected && <ul className="list-disc space-y-1 rounded-[28px] border border-border bg-topbar p-4 pl-8 text-xs text-icon-muted">
            {tab === "count" ? (
              <>
                <li>본 이용권은 &lsquo;횟수 차감형&rsquo; 이용권이며, 1회 결제 상품입니다.</li>
                <li>&ldquo;1회&rdquo;는, 사용자의 질문 1번과 AI의 답변 1번이 한 횟수로 차감되는 구조입니다.</li>
                <li>이용권은 1개만 보유 가능합니다. 추가 구매를 원하시면 현재 보유 이용권을 소진하셔야 합니다.</li>
                <li>친구 초대로 인해 받은 이용권이 있을 경우, 해당 이용권이 먼저 사용됩니다.</li>
                <li>구매 후 7일 이내 미사용 시 전액 환불 가능합니다. (부분 환불 불가)</li>
                <li>유효기간은 구입일로부터 6개월입니다.</li>
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
          </ul>}
          {/* PG(KG이니시스) 입점심사 요건: 사업자정보가 메인 화면뿐 아니라 결제 페이지에도
              상시 노출돼야 함(help.portone.io/content/requirements) — 기존엔 /me에만 있었음. */}
          <CompanyFooter />
        </div>
      </div>
      <div className="shrink-0 border-t border-border bg-topbar p-4">
        {selected ? (
          <button type="button" onClick={() => handlePurchase(selected.id)} disabled={purchasingId !== null || hasCountPass} className="mx-auto block h-12 w-full max-w-2xl rounded-2xl bg-point text-base font-bold text-white disabled:opacity-60">
            {formatWon(selected.priceWon)} 결제하기
          </button>
        ) : <div className="mx-auto flex w-full max-w-2xl overflow-hidden rounded-full bg-chip-fill">
          <button
            type="button"
            onClick={() => setTab("count")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "count" ? "bg-point text-white" : "text-white"
            }`}
          >
            횟수제
          </button>
          <button type="button" disabled title="준비 중" className="h-14 flex-1 text-base font-semibold text-icon-muted">자동충전</button>
          <button
            type="button"
            onClick={() => setTab("time")}
            className={`h-14 flex-1 text-base font-semibold ${
              tab === "time" ? "bg-point text-white" : "text-white"
            }`}
          >
            이용권
          </button>
        </div>}
      </div>
    </div>
  );
}
