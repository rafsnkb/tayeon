"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PortOne, { PaymentPayMethod } from "@portone/browser-sdk/v2";
import {
  COUNT_PACKAGES,
  TIME_PASS_PACKAGES,
  COMBOS,
  countAllowanceForCombo,
  type ComboKey,
  COUNT_PASS_VALIDITY_MONTHS,
  TIME_PASS_VALIDITY_MONTHS,
  formatMonths,
  HELD_PASS_STATUSES,
  COMBO_ORDER} from "@/lib/tarot/pricing";
import { countPackageArt, timePassArt } from "@/lib/tarot/passTiers";
import { ComboAllowanceList } from "@/components/ComboAllowanceCard";
import PassArtCard, { PassArtHero } from "@/components/PassArtCard";
import { REFUND_WINDOW_DAYS } from "@/lib/payment/refundPolicy";
import SubPageTopBar from "@/components/SubPageTopBar";
import { CompanyFooter } from "@/components/CompanyFooter";
import { buildPortoneCustomer } from "@/lib/payment/customer";
import { useRooms } from "@/lib/tarot/RoomsContext";
import NoBirthTimePopup from "@/components/NoBirthTimePopup";
import SuspensionModal, { parseSuspensionError, type SuspensionInfo } from "@/components/SuspensionModal";
import InfoModal from "@/components/InfoModal";
import { safeReturnTo } from "@/lib/navigation";

type Tab = "count" | "time";
type TimeDuration = 15 | 30 | 60;

type CountPackage = (typeof COUNT_PACKAGES)[number];
type TimePackage = (typeof TIME_PASS_PACKAGES)[number];
type SelectedProduct = { kind: "count"; pkg: CountPackage } | { kind: "time"; pkg: TimePackage };

/** 목록 카드의 제목·설명. 목업 문구를 그대로 따른다. */
const timePassName = (minutes: number) => `${minutes}분 무제한 이용권`;
const timePassCaption = (combo: ComboKey) =>
  combo === "tarot" ? "타로 전용" : `${COMBOS[combo].label} 무제한`;

function formatWon(won: number) {
  return `₩${won.toLocaleString("ko-KR")}`;
}



const TIME_DURATIONS: TimeDuration[] = [15, 30, 60];

/** 피그마 "Screen / Buy - Coin"·"Buy - CountPurchase". 포트원 V2 결제창을 직접 호출해 횟수제·
 * 시간제 이용권을 구매한다. 횟수제는 2026-09-18부터 구매 시점에 조합(타로전용/+사주/+자미두수/
 * +사주자미두수) 하나를 반드시 골라야 하고, 그 조합으로 완전히 고정된 이용권이 발급된다. */
export default function ChargePage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "time" ? "time" : "count"));
  // 결제창이 히스토리를 어지럽히므로 뒤로가기는 history.back() 이 아니라 온 곳으로 직접
  // 보낸다(src/lib/navigation.ts). from 이 없는 옛 링크는 예전대로 history.back().
  const returnTo = safeReturnTo(searchParams.get("from"));
  // 시간제도 구입 상세를 거치게 바뀌어서(목업 Buy_TimePass_Purchase, 2026-09-25) 고른 상품이
  // 두 종류다. 예전엔 시간제 카드를 누르면 곧장 결제창이 떴다.
  const [selected, setSelected] = useState<SelectedProduct | null>(null);
  const [selectedCombo, setSelectedCombo] = useState<ComboKey | null>(null);
  const [timeDuration, setTimeDuration] = useState<TimeDuration>(15);
  const [notice, setNotice] = useState<{ type: "info" | "error"; message: string } | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [noBirthTimeOpen, setNoBirthTimeOpen] = useState(false);
  const [suspension, setSuspension] = useState<SuspensionInfo | null>(null);
  const { user, email, nickname, refreshMe, countPasses, timePasses, activeTimePass, hasBirthInfo, myTimeUnknown } = useRooms();
  const hasBirthTime = hasBirthInfo && !myTimeUnknown;
  const heldCountPass = countPasses.find(
    (pass) => pass.source === "purchase" && HELD_PASS_STATUSES.includes(pass.status)
  );
  const hasCountPass = Boolean(heldCountPass);
  const hasTimePassHeld = timePasses.length > 0 || activeTimePass !== null;
  const price = selected?.pkg.priceWon ?? 0;
  // 상세 화면에서 "구입할 수 없음"을 판정하는 쪽이 탭마다 다르다.
  const blocked = selected?.kind === "time" ? hasTimePassHeld : hasCountPass;

  function selectCombo(combo: ComboKey) {
    if (COMBOS[combo].ziwei && !hasBirthTime) {
      setNoBirthTimeOpen(true);
      return;
    }
    setSelectedCombo(combo);
  }

  async function handlePurchase(productId: string, combo?: ComboKey) {
    if (!user || purchasingId) return;
    setPurchasingId(productId);
    setNotice(null);
    try {
      const idToken = await user.getIdToken();

      // 1. 서버에 결제 준비를 요청 — 금액/주문명(+횟수제는 고른 조합)을 서버가 pricing.ts 기준으로
      // 정해서 내려준다.
      const prepareRes = await fetch("/api/payment/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ productId, combo }),
      });
      if (!prepareRes.ok) {
        const failed = await prepareRes.json().catch(() => ({}));
        const suspensionInfo = parseSuspensionError(failed);
        if (suspensionInfo) {
          setSuspension(suspensionInfo);
          return;
        }
        if (failed.code === "NO_BIRTH_TIME") {
          setNoBirthTimeOpen(true);
          return;
        }
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
        setSelected(null);
        setSelectedCombo(null);
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

  const countNotice = (
    <>
      <li>본 이용권은 &lsquo;횟수 차감형&rsquo; 이용권이며, 1회 결제 상품입니다.</li>
      <li>&ldquo;1회&rdquo;는, 사용자의 질문 1번과 AI의 답변 1번이 한 횟수로 차감되는 구조입니다.</li>
      <li>구매 시 타로 전용/+사주/+자미두수/+사주+자미두수 중 하나의 옵션을 선택해야 하며, 선택한 옵션으로만 이용할 수 있습니다.</li>
      <li>이용권은 1개만 보유 가능합니다. 추가 구매를 원하시면 현재 보유 이용권을 소진하셔야 합니다.</li>
      <li>결제 리워드ㆍ친구 초대로 받은 이용권이 있을 경우, 해당 이용권이 먼저 사용됩니다.</li>
      <li>구매 후 {REFUND_WINDOW_DAYS}일 이내 미사용 시 전액 환불 가능합니다. (부분 환불 불가)</li>
      <li>유효기간은 구입일로부터 {formatMonths(COUNT_PASS_VALIDITY_MONTHS)}입니다.</li>
    </>
  );
  const timeNotice = (
    <>
      <li>시간제 이용권은 채팅방에서 사용하기를 누른 순간부터 시간 차감이 시작되며, 브라우저를 닫아도 멈추지 않습니다.</li>
      <li>이용권은 1개만 보유 가능합니다. 추가 구매를 원하시면 현재 보유 이용권을 소진하셔야 합니다.</li>
      <li>사용중인 리워드 및 횟수제 이용권이 있는 상태에서 시간제 이용권을 사용하면, 시간제 이용권이 먼저 사용됩니다. 해당 시간동안은 리워드 및 횟수제 이용권은 차감되지 않습니다.</li>
      <li>구매 후 {REFUND_WINDOW_DAYS}일 이내 미사용 시 전액 환불 가능합니다. (부분 환불 불가)</li>
      <li>유효기간은 구입일로부터 {formatMonths(TIME_PASS_VALIDITY_MONTHS)}입니다.</li>
    </>
  );
  const notices = (
    <ul className="list-disc space-y-1 rounded-[28px] border border-border bg-topbar p-4 pl-8 text-xs text-icon-muted">
      {(selected ? selected.kind === "time" : tab === "time") ? timeNotice : countNotice}
      <li>
        자세한 내용은{" "}
        <Link href="/terms" className="font-bold text-point-text underline">
          이용약관
        </Link>
        을 확인해주세요.
      </li>
    </ul>
  );

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      {/* 제목은 목록·상세가 같다(목업). 예전엔 상세에서 "구입하기"로 바뀌었다. */}
      <SubPageTopBar
        title="이용권 구입"
        onBack={selected ? () => { setSelected(null); setSelectedCombo(null); } : undefined}
        backHref={returnTo}
      />
      <div
        className={`flex-1 overflow-visible pt-16 xl:overflow-y-auto scroll-gutter-stable ${
          selected ? "pb-52" : tab === "time" ? "pb-40" : "pb-28"
        }`}
      >
        {/* 히어로는 좌우 여백 밖에 놓는다 — 화면 폭을 꽉 채우는 그림이다. */}
        {selected && (
          <PassArtHero
            art={
              selected.kind === "count"
                ? countPackageArt(selected.pkg.id)
                : timePassArt(selected.pkg.minutes, selected.pkg.combo)
            }
            name={selected.kind === "count" ? `${selected.pkg.name} 이용권` : `${selected.pkg.minutes}분 무제한`}
            caption={
              selected.kind === "count"
                ? selected.pkg.bonus
                : `${selected.pkg.minutes}분 동안 ${COMBOS[selected.pkg.combo].label} 무제한 리딩`
            }
          />
        )}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
          {selected?.kind === "count" && (
            <>
              <p className="text-center text-sm font-semibold text-icon-muted">구입하실 이용권의 옵션을 선택하세요</p>
              <ComboAllowanceList
                layout="columns"
                allowanceFor={(combo, spread) => countAllowanceForCombo(selected.pkg.basis, spread, combo)}
                selected={selectedCombo}
                onSelect={selectCombo}
              />
            </>
          )}

          {!selected && tab === "count" && (
            <div className="grid grid-cols-2 gap-2.5">
              {COUNT_PACKAGES.map((pkg) => (
                <PassArtCard
                  key={pkg.id}
                  art={countPackageArt(pkg.id, "card")}
                  name={`${pkg.name} 이용권`}
                  caption={pkg.bonus}
                  price={formatWon(pkg.priceWon)}
                  disabled={purchasingId !== null}
                  onClick={() => setSelected({ kind: "count", pkg })}
                />
              ))}
            </div>
          )}

          {!selected && tab === "time" && (
            <div className="grid grid-cols-2 gap-2.5">
              {COMBO_ORDER.map((combo) => {
                const pkg = TIME_PASS_PACKAGES.find((p) => p.combo === combo && p.minutes === timeDuration)!;
                return (
                  <PassArtCard
                    key={combo}
                    art={timePassArt(timeDuration, combo, "card")}
                    name={timePassName(timeDuration)}
                    caption={timePassCaption(combo)}
                    price={formatWon(pkg.priceWon)}
                    disabled={purchasingId !== null || hasTimePassHeld}
                    onClick={() => {
                      if (COMBOS[combo].ziwei && !hasBirthTime) {
                        setNoBirthTimeOpen(true);
                        return;
                      }
                      setSelected({ kind: "time", pkg });
                    }}
                  />
                );
              })}
            </div>
          )}
          {!selected && tab === "time" && hasTimePassHeld && (
            <p className="text-center text-sm text-urgent">보유 시간제 이용권을 소진한 후 새 이용권을 구매할 수 있어요.</p>
          )}

          {notices}

          {selected && blocked && (
            <p className="text-center text-sm text-urgent">
              {/* 환불 신청 중인 건은 소진할 수 없다 — 서버(api/payment/prepare)가 돌려주는 안내와 같은 말을 쓴다. */}
              {selected.kind === "count" && heldCountPass?.status === "refund_pending"
                ? "환불 진행중인 이용권이 있어 구입할 수 없습니다."
                : "보유 이용권을 소진한 후 새 이용권을 구매할 수 있어요."}
            </p>
          )}
          {/* PG(KG이니시스) 입점심사 요건: 사업자정보가 메인 화면뿐 아니라 결제 페이지에도
              상시 노출돼야 함(help.portone.io/content/requirements) — 기존엔 /me에만 있었음. */}
          <CompanyFooter />
        </div>
      </div>
      {!selected && tab === "time" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-2xl rounded-full bg-chip-soft p-1.5">
            {TIME_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTimeDuration(d)}
                className={`h-9 flex-1 rounded-full text-sm font-bold ${
                  timeDuration === d ? "bg-point text-white" : "text-placeholder"
                }`}
              >
                {d}분
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-topbar p-4">
        {selected ? (
          <div className="mx-auto w-full max-w-2xl">
            {/* 결제금액은 목업에서 하단 고정 영역으로 내려왔다 — 스크롤과 상관없이 "얼마를 내는지"가
                결제 버튼 바로 위에 붙어 있어야 한다. */}
            <p className="text-base font-bold text-bold-text">결제금액</p>
            <div className="mt-2 flex justify-between text-sm text-icon-muted">
              <span>· 상품금액 (VAT 포함)</span>
              <span>{price.toLocaleString("ko-KR")}원</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-bold-text">
              <span>총 결제금액</span>
              <span>{price.toLocaleString("ko-KR")}원</span>
            </div>
            <button
              type="button"
              onClick={() =>
                selected.kind === "count"
                  ? selectedCombo && handlePurchase(selected.pkg.id, selectedCombo)
                  : handlePurchase(selected.pkg.id)
              }
              disabled={purchasingId !== null || blocked || (selected.kind === "count" && !selectedCombo)}
              className="mt-3 block h-12 w-full rounded-full bg-point text-base font-bold text-white disabled:bg-chip-fill disabled:text-chip-muted-text disabled:opacity-60"
            >
              결제하기
            </button>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl rounded-full bg-chip-soft p-2">
            {([["count", "횟수제 이용권"], ["time", "시간제 이용권"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-10 flex-1 rounded-full text-base font-bold ${
                  tab === key ? "bg-point text-white" : "text-placeholder"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      {noBirthTimeOpen && <NoBirthTimePopup onClose={() => setNoBirthTimeOpen(false)} />}
      {suspension && <SuspensionModal info={suspension} onClose={() => setSuspension(null)} />}
      {notice && (
        <InfoModal title={notice.message} tone={notice.type} onClose={() => setNotice(null)} />
      )}
    </div>
  );
}
