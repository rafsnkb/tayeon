"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { discountedAmount } from "@/lib/payment/discountCoupon";
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
  COMBO_ORDER,
} from "@/lib/tarot/pricing";
import { countPackageArt, timePassArt } from "@/lib/tarot/passTiers";
import { ComboAllowanceList } from "@/components/ComboAllowanceCard";
import PassArtCard, { PassArtHero } from "@/components/PassArtCard";
import { REFUND_WINDOW_DAYS } from "@/lib/payment/refundPolicy";
import SubPageTopBar from "@/components/SubPageTopBar";
import { SlidingSegments } from "@/components/SlidingSegments";
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

/** `/api/user/discount-coupons` 가 주는 쿠폰함 한 장 — 여기서 쓰는 필드만 뽑아 둔다. */
type WalletCoupon = { code: string; name: string; discountRate: number; endsAt: string; usable: boolean };

/** 「보유 쿠폰」 카드 한 줄이 쓰는 것. `WalletCoupon` 보다 좁게 잡는 이유는 첫 줄이 쿠폰함
 *  응답이 아니라 `useRooms().activeCoupon` 에서 올 수도 있어서다 — 그쪽에는 `endsAt`·`usable`
 *  이 없다. 두 출처를 한 배열에 담으려면 **공통분모**가 타입이어야 한다. */
type CouponRow = { code: string; name: string; discountRate: number };

/** 목록 카드의 제목·설명. 목업 문구를 그대로 따른다. */
const timePassName = (minutes: number) => `${minutes}분 무제한 이용권`;
const timePassCaption = (combo: ComboKey) =>
  combo === "tarot" ? "타로 전용" : `${COMBOS[combo].label} 무제한`;

/** 목록 카드는 원화 기호(목업 Buy_CountPass), 하단 결제 영역은 "원"(목업 Buy_*_Purchase)이다.
 *  같은 화면에서 표기가 갈리는 건 목업이 그렇기 때문이다 — 맞추려다 한쪽이 틀리지 않게 둘 다
 *  여기에 둔다. */
const formatWon = (won: number) => `₩${won.toLocaleString("ko-KR")}`;
const formatWonSuffix = (won: number) => `${won.toLocaleString("ko-KR")}원`;

const TIME_DURATIONS: TimeDuration[] = [15, 30, 60];

/** 하단 탭. 예전엔 JSX 안에 인라인 배열이었는데, 알약 위치를 인덱스로 잡게 되면서 **순서가
 *  의미를 갖는 값**이 됐다 — 렌더 중에 매번 새로 만들지 않고 밖으로 뺀다. */
const CHARGE_TABS = [
  ["count", "횟수제 이용권"],
  ["time", "시간제 이용권"],
] as const satisfies readonly (readonly [Tab, string])[];

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
  // 쿠폰은 1 회용이라 자동 적용이 늘 이득은 아니다 — 3,000 원짜리에 30% 를 태우면 900 원 깎고
  // 사라진다. 이번 결제에는 쓰지 않도록 끌 수 있게 한다(2026-09-25 사용자 결정).
  const [useCoupon, setUseCoupon] = useState(true);
  // 쿠폰은 **진입 시점에 이미** 알고 있어야 한다 — 마운트 후 따로 조회하면 첫 렌더가 정가였다가
  // 할인가로 바뀌면서 가격이 눈에 띄게 튄다(2026-09-25 사용자 리포트). /api/user/me 가 로그인
  // 시점에 실어다 주므로 여기서는 읽기만 한다. `coupon` 은 그중 가장 유리한 하나(서버 기본
  // 선택)이고, 보유가 1장 이하면 이 값만으로 충분하다 — 그래서 아래 보유 목록 조회 전에도
  // 가격이 튀지 않는다.
  const { user, email, nickname, refreshMe, countPasses, timePasses, activeTimePass, hasBirthInfo, myTimeUnknown, activeCoupon: coupon } = useRooms();
  // 2장 이상 보유했을 때만 "어느 걸 쓸지" 고르게 한다(2026-09-27 사용자 결정 — 1장뿐이면 고를
  // 게 없는데 단계만 늘어난다). 상세로 들어갈 때만 조회한다 — 목록에서는 필요 없다.
  const [usableCoupons, setUsableCoupons] = useState<WalletCoupon[] | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  useEffect(() => {
    // 상품을 아직 안 고른 화면(목록)에서는 조회하지 않는다 — 상세로 들어가고 나갈 때의 정리는
    // `selected` 를 null 로 되돌리는 두 자리(뒤로가기·구매 완료)에서 직접 한다(이벤트 핸들러
    // 쪽 setState 라 괜찮다 — 여기 effect 안에서 동기 setState 를 하면 렌더가 겹친다).
    if (!selected || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/user/discount-coupons", { headers: { Authorization: `Bearer ${idToken}` } });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { coupons?: WalletCoupon[] };
        if (cancelled) return;
        setUsableCoupons((data.coupons ?? []).filter((c) => c.usable));
      } catch (error) {
        // 실패해도 구매를 막지 않는다 — 선택 UI 없이 지금까지처럼 서버가 자동으로 고른다.
        console.error("[charge] 쿠폰함 조회 실패 — 선택 UI 없이 진행한다", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, user]);
  /** 카드에 그릴 줄들. 쿠폰함 조회가 **끝나기 전에도** 한 줄은 그려야 한다 — `coupon`(서버가
   *  미리 골라 실어 준 가장 유리한 하나)이 진입 시점부터 있어서, 여기서 빈 카드를 먼저 그리면
   *  화면이 「쿠폰 없음 → 한 장 나타남」으로 한 번 튄다. */
  const couponRows: CouponRow[] = usableCoupons ?? (coupon ? [coupon] : []);
  // 서버에 `couponCode` 를 실어 보낼지의 기준. 한 장뿐이면 보낼 게 없다 — 서버가 그 한 장을
  // 스스로 고르고, 화면이 고른 코드를 얹으면 "무엇을 쓸지"를 클라이언트가 정하는 셈이 된다.
  const showCouponPicker = couponRows.length >= 2;
  const selectedCouponCode = couponCode ?? coupon?.code ?? couponRows[0]?.code ?? null;
  const displayedCoupon =
    couponRows.find((c) => c.code === selectedCouponCode) ?? coupon;
  const hasBirthTime = hasBirthInfo && !myTimeUnknown;
  const heldCountPass = countPasses.find(
    (pass) => pass.source === "purchase" && HELD_PASS_STATUSES.includes(pass.status)
  );
  const hasCountPass = Boolean(heldCountPass);
  const hasTimePassHeld = timePasses.length > 0 || activeTimePass !== null;
  const listPrice = selected?.pkg.priceWon ?? 0;
  const appliedCoupon = useCoupon ? displayedCoupon : null;
  const { amountWon: price, discountWon } = appliedCoupon
    ? discountedAmount(listPrice, appliedCoupon.discountRate)
    : { amountWon: listPrice, discountWon: 0 };
  /** 목록 카드에 붙일 할인 정보. 상품마다 정가가 달라 금액은 카드에서 각자 계산한다.
   *
   *  **appliedCoupon 이 아니라 coupon 을 본다** — 끄기 토글은 "이번 결제"에 대한 결정이고,
   *  목록은 아직 무엇을 살지 고르는 자리다. 여기까지 토글이 물들면 상세에서 껐다가 뒤로
   *  나온 사람에게 목록이 통째로 정가로 보인다(2026-09-25 사용자 리포트). */
  const cardDiscount = (won: number) =>
    coupon
      ? {
          percent: Math.round(coupon.discountRate * 100),
          listPrice: formatWon(won),
          price: formatWon(discountedAmount(won, coupon.discountRate).amountWon),
        }
      : null;
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
        // 쓸지 말지, 그리고(2장 이상 보유해 직접 골랐을 때만) 어느 걸 쓸지만 보낸다 — 얼마를
        // 깎을지는 서버가 다시 계산한다. 1장 이하면 couponCode 를 아예 안 보내고, 그러면
        // 서버가 지금까지처럼 자동으로 고른다.
        body: JSON.stringify({
          productId,
          combo,
          useCoupon,
          ...(showCouponPicker && selectedCouponCode ? { couponCode: selectedCouponCode } : {}),
        }),
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
        // 고른 쿠폰이 그새 어긋났다(이미 쓰였거나 기간이 지났거나 못 찾음) — 조용히 다른
        // 쿠폰이나 정가로 넘기지 않고, 선택을 지워 다시 고르게 한다(2026-09-27 사용자 결정).
        if (failed.code === "COUPON_NOT_FOUND" || failed.code === "COUPON_ALREADY_USED" || failed.code === "COUPON_EXPIRED") {
          setCouponCode(null);
          setUsableCoupons((prev) => (prev ? prev.filter((c) => c.code !== selectedCouponCode) : prev));
          setNotice({ type: "error", message: failed.error ?? "쿠폰을 다시 골라주세요." });
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
        setUseCoupon(true);
        setUsableCoupons(null);
        setCouponCode(null);
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
        /* 상세를 벗어나면 쿠폰 토글도 기본값(켜짐)으로 되돌린다. 끄기는 "이번 결제"에 대한
           결정이라 다음 상품까지 따라가면 안 된다. */
        onBack={
          selected
            ? () => {
                setSelected(null);
                setSelectedCombo(null);
                setUseCoupon(true);
                setUsableCoupons(null);
                setCouponCode(null);
              }
            : undefined
        }
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
          {/* 보유 쿠폰 (목업 Buy_TimePass_Purchase_*, 2026-09-25 갱신분).
              쿠폰이 있을 때만 나온다 — 없으면 끌 것도 없다.

              끌 수 있어야 하는 이유: 쿠폰은 1 회용인데 자동 적용이라, 3,000 원 상품에 30% 를
              태우면 900 원 깎고 사라진다. 11 만원 상품에 쓸 기회가 없어지는 셈이다.

              **여러 장을 보유하면 한 카드에 줄로 쌓인다**(목업 2026-09-27 갱신분). 줄마다 토글이
              붙지만 **동시에 켜지는 것은 하나뿐**이다 — 중복 사용이 없으므로(2026-09-27 사용자
              결정) 토글은 "적용/해제"가 아니라 **"이걸로 고른다"**에 가깝다. 그래서 라디오처럼
              배타로 동작하되, 켜져 있는 줄을 다시 누르면 전부 꺼져 정가로 돌아간다.

              굳이 라디오가 아니라 토글로 그린 이유: 라디오는 "하나는 반드시 골라야 한다"고
              읽힌다. 여기서는 **아무것도 안 쓰는 선택**이 정당하다(위 3,000원 문단).

              실측(scale 3, Dark·Light 두 벌 동일): 카드 폭 380 · 모서리 24 · 테두리 --border,
              면 --topbar(정확 일치) · 줄 높이 80 · 줄 사이 구분선 --border,
              안쪽 여백 왼 24 / 오른 16 · 토글 72x32, 손잡이 24 에 안쪽 4,
              켜짐 트랙 --point(정확 일치) · 꺼짐 트랙 --chip-soft(라이트 #e7e2e1 정확 일치). */}
          {selected && couponRows.length > 0 && (
            <section>
              <p className="mb-2 text-base font-bold text-bold-text">보유 쿠폰</p>
              <div className="overflow-hidden rounded-3xl border border-border bg-topbar">
                {couponRows.map((c, i) => {
                  const on = useCoupon && c.code === selectedCouponCode;
                  return (
                    <div
                      key={c.code}
                      className={`flex h-20 items-center justify-between gap-3 pl-6 pr-4 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <span className="truncate text-base font-bold text-bold-text">
                        {c.name || c.code}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${c.name || c.code} 적용`}
                        onClick={() => {
                          // 켜진 줄을 다시 누르면 해제(정가), 아니면 그 줄로 갈아탄다.
                          if (on) return setUseCoupon(false);
                          setCouponCode(c.code);
                          setUseCoupon(true);
                        }}
                        className={`relative h-8 w-[72px] shrink-0 rounded-full transition-colors ${
                          on ? "bg-point" : "bg-chip-soft"
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-[left] ${
                            on ? "left-11" : "left-1"
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {selected?.kind === "count" && (
            <>
              {/* 조합을 고르기 전에는 결제 버튼이 잠겨 있다 — 왜 못 누르는지 알려면 이 줄이
                  필수임을 드러내야 한다. 표시색은 폼의 필수 표시(FormControls 의 * )와 같은
                  --urgent 를 쓴다. */}
              <p className="text-center text-sm font-semibold text-icon-muted">
                <span className="text-urgent">[필수]</span> 구입하실 이용권의 옵션을 선택하세요
              </p>
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
                  price={cardDiscount(pkg.priceWon)?.price ?? formatWon(pkg.priceWon)}
                  discount={cardDiscount(pkg.priceWon) ?? undefined}
                  disabled={purchasingId !== null}
                  onClick={() => setSelected({ kind: "count", pkg })}
                />
              ))}
            </div>
          )}

          {!selected && tab === "time" && (
            <div className="grid grid-cols-2 gap-2.5">
              {COMBO_ORDER.map((combo) => {
                const pkg = TIME_PASS_PACKAGES.find((p) => p.combo === combo && p.minutes === timeDuration);
                // 상품표에는 12종(3 시간 × 4 조합)이 다 있어야 한다. 없더라도 그 칸만 비우고
                // 나머지는 팔린다 — `!` 로 단정하면 상품 하나가 빠졌을 때 구입 화면 전체가
                // 흰 화면이 된다.
                if (!pkg) return null;
                return (
                  <PassArtCard
                    key={combo}
                    art={timePassArt(timeDuration, combo, "card")}
                    name={timePassName(timeDuration)}
                    caption={timePassCaption(combo)}
                    price={cardDiscount(pkg.priceWon)?.price ?? formatWon(pkg.priceWon)}
                    discount={cardDiscount(pkg.priceWon) ?? undefined}
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
          {/* `padding={6}` 은 트랙의 `p-1.5` 와 같은 값이다 — 어긋나면 알약이 글자에서 밀린다. */}
          <SlidingSegments
            count={TIME_DURATIONS.length}
            index={TIME_DURATIONS.indexOf(timeDuration)}
            padding={6}
            className="pointer-events-auto flex w-full max-w-2xl rounded-full bg-chip-soft p-1.5"
            indicatorClassName="rounded-full bg-point"
          >
            {TIME_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTimeDuration(d)}
                className={`relative h-9 flex-1 rounded-full text-sm font-bold transition-colors motion-reduce:transition-none ${
                  timeDuration === d ? "text-white" : "text-placeholder"
                }`}
              >
                {d}분
              </button>
            ))}
          </SlidingSegments>
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
              <span>{formatWonSuffix(listPrice)}</span>
            </div>
            {appliedCoupon && (
              <div className="mt-2 flex justify-between gap-3 text-sm text-icon-muted">
                {/* 쿠폰 이름을 그대로 쓴다 — "할인 -12,450원"만 있으면 어느 쿠폰이 붙었는지
                    알 수 없고, 쿠폰함과 대조도 안 된다. */}
                <span className="truncate">· {appliedCoupon.name || appliedCoupon.code}</span>
                <span className="shrink-0">-{formatWonSuffix(discountWon)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold text-bold-text">
              <span>총 결제금액</span>
              <span>{formatWonSuffix(price)}</span>
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
          <SlidingSegments
            count={CHARGE_TABS.length}
            index={CHARGE_TABS.findIndex(([key]) => key === tab)}
            padding={8}
            className="mx-auto flex w-full max-w-2xl rounded-full bg-chip-soft p-2"
            indicatorClassName="rounded-full bg-point"
          >
            {CHARGE_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`relative h-10 flex-1 rounded-full text-base font-bold transition-colors motion-reduce:transition-none ${
                  tab === key ? "text-white" : "text-placeholder"
                }`}
              >
                {label}
              </button>
            ))}
          </SlidingSegments>
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
