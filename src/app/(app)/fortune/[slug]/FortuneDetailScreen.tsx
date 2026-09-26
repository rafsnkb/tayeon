"use client";

import { useMemo, useState } from "react";
import SubPageTopBar from "@/components/SubPageTopBar";
import { CompanyFooter } from "@/components/CompanyFooter";
import { useRooms } from "@/lib/tarot/RoomsContext";
import type { SajuProduct } from "@/lib/saju/products";
import { whyUnsellable, type SajuMode } from "@/lib/saju/generate/chart";
import { SAJU_MODES, whyNotPurchasable } from "@/lib/saju/purchase";
// 버전 상수는 잎 모듈에서 직접 가져온다. `purchase.ts` 도 이 값을 re-export 하지만, 그 파일이
// 굳이 상수를 떼어 둔 이유가 "화면이 결제 모듈을 타고 들어오지 않게"라서 그 뜻을 따른다.
import { REFUND_NOTICE_VERSION } from "@/lib/saju/noticeVersion";
import { TERMS_EFFECTIVE_DATE } from "@/lib/legal/content";
import { ProductHero } from "./ProductHero";
import { ProductReviews } from "./ProductReviews";
import { SectionOutline } from "./SectionOutline";
import { RequiredInputs } from "./RequiredInputs";
import { PurchaseNotice } from "./PurchaseNotice";
import { ModePanel } from "./ModePanel";
import {
  EMPTY_PARTNER_FORM,
  partnerFormToBirthInfo,
  partnerToForm,
  type PartnerForm,
} from "./partnerForm";
import type { ConsentKey, FortunePurchaseRequest } from "./purchaseRequest";

/** 운세 상품 상세·구매 화면(목업 New/`Fortune_Select_Dark`·`_Light`).
 *
 *  구역 순서는 목업 그대로다: 히어로 → 해석 내용 → 필요 정보 입력 → 안내·약관 → 모드 선택 +
 *  결제. 각 구역의 실측값은 해당 컴포넌트 머리말에 적어 뒀다.
 *
 *  ── 판매 제약(설계 §10)을 여기서 실제로 건다 ────────────────────────────────
 *  규칙을 이 화면에 다시 적지 않는다. 판정은 전부 `whyNotPurchasable`(성인 상품 · 성별 필수 ·
 *  시간 모름 → 자미두수·통합 불가 · 상대 정보 필요)과 그게 안에서 부르는 `whyUnsellable` 이
 *  내린다. 같은 규칙이 두 곳에 있으면 한쪽만 고쳐져서 "결제는 됐는데 계산이 안 되는" 건이 생긴다.
 *
 *  상대방 쪽에도 **같은 함수**를 한 번 더 건다. `whyNotPurchasable` 은 상대 정보가 "있는지"만
 *  보는데, 궁합 상품에서 상대의 시진이 틀리면 상대의 명궁이 통째로 다른 궁으로 가서 리포트가
 *  어긋나는 건 내 쪽과 똑같다 — 목업도 상대 시간칸 아래에 그 경고문을 달아 두었다.
 *
 *  ── 결제는 이 파일이 실행하지 않는다 ───────────────────────────────────────
 *  버튼은 `FortunePurchaseRequest` 를 만들어 `onPurchase` 로 넘길 뿐이다. 실제 네 걸음
 *  (prepare → 결제창 → complete → 리포트 열기)은 `useFortunePurchase.ts` 에 있고, 둘을 잇는
 *  것은 `FortuneDetail.tsx` 다(2026-09-27 연결됨).
 *
 *  **경계를 유지하려고 갈라 둔 것이다.** 이 화면은 판매 제약·동의·입력을 다루고, 돈이 움직이는
 *  코드는 한 파일에 모여 있다 — 목업이 바뀌어 이 화면을 다시 그려도 결제 경로는 안 건드린다. */
export function FortuneDetailScreen({
  product,
  onPurchase,
  busy = false,
}: {
  product: SajuProduct;
  onPurchase?: (request: FortunePurchaseRequest) => void;
  /** 결제가 진행 중인가. 버튼을 잠그는 데만 쓴다 — 두 번 눌러 결제창이 두 번 뜨는 걸 막는다.
   *  `useFortunePurchase` 도 자기 쪽에서 한 번 더 막지만(`if (phase) return`), 눌리는 버튼이
   *  아무 반응도 안 하는 것보다 **잠긴 버튼**이 낫다. */
  busy?: boolean;
}) {
  const { myBirthInfo, partner } = useRooms();

  const [mode, setMode] = useState<SajuMode>("saju");
  /* 상대 정보는 마운트 시점의 저장값에서 출발한다(`/compatibility` 와 같은 lazy 초기화 —
     10초 폴링이 컨텍스트를 갱신해도 입력 중인 폼이 발밑에서 바뀌면 안 된다). */
  const [useSavedPartner, setUseSavedPartner] = useState(() => Boolean(partner?.birthDate));
  const [partnerForm, setPartnerForm] = useState<PartnerForm>(() =>
    partner ? partnerToForm(partner) : EMPTY_PARTNER_FORM
  );
  const [userInput, setUserInput] = useState("");
  /* 불리언이 아니라 **체크한 시각**을 든다(`purchaseRequest.ts` 의 `consent` 주석). 끄면 null 로
     돌아간다 — 껐다 켠 사람의 시각은 마지막으로 켠 때가 맞다. */
  const [agreedAt, setAgreedAt] = useState<Record<ConsentKey, string | null>>({
    terms: null,
    refundLimit: null,
  });

  const partnerBirthInfo = product.needsPartner ? partnerFormToBirthInfo(partnerForm) : null;

  /** 내 프로필만으로 이미 못 파는 상태인가. 가장 느슨한 모드(사주)마저 막히면 상품이 아니라
   *  프로필 문제다 — 판정은 여기서도 `whyUnsellable` 이 한다. */
  const profileIncomplete = !myBirthInfo || whyUnsellable(myBirthInfo, "saju") !== null;

  const blockedReason = useMemo(() => {
    const out = {} as Record<SajuMode, string | null>;
    for (const m of SAJU_MODES) {
      if (!myBirthInfo) {
        out[m] = "내 프로필의 생년월일시 정보를 먼저 등록해주세요.";
        continue;
      }
      const mine = whyNotPurchasable({
        product,
        mode: m,
        birthInfo: myBirthInfo,
        hasPartnerBirthInfo: partnerBirthInfo !== null,
      });
      if (mine) {
        out[m] = mine;
        continue;
      }
      // 같은 사유라도 누구 쪽인지 붙여 준다. 문장 자체는 `whyUnsellable` 이 준 그대로다.
      const theirs = partnerBirthInfo ? whyUnsellable(partnerBirthInfo, m) : null;
      out[m] = theirs ? `상대방 — ${theirs}` : null;
    }
    return out;
  }, [product, myBirthInfo, partnerBirthInfo]);

  /* 고른 모드가 **나중에** 막힐 수 있다 — 통합을 고른 뒤 상대 시간칸을 비우면 그렇다. 막힌
     칸이 골라진 채로 남으면 총 결제금액과 버튼이 팔 수 없는 금액을 말한다.
     effect 로 state 를 되돌리지 않고 렌더 중에 **유도**한다: `mode` 는 "사용자가 고른 것"으로
     그대로 두고 화면은 지금 팔 수 있는 칸을 쓴다. 그래서 막힘이 풀리면(시간을 다시 채우면)
     고쳐 고를 필요 없이 원래 고른 칸으로 돌아온다. */
  const effectiveMode: SajuMode = blockedReason[mode]
    ? SAJU_MODES.find((m) => !blockedReason[m]) ?? mode
    : mode;

  /** 체크를 켜면 저장된 상대를 불러오고, 끄면 비운다. 여기서 고친 값은 **저장되지 않는다** —
   *  상대 프로필을 바꾸는 곳은 `/compatibility` 다. */
  function handleUseSavedPartner(next: boolean) {
    setUseSavedPartner(next);
    setPartnerForm(next && partner ? partnerToForm(partner) : EMPTY_PARTNER_FORM);
  }

  function handleConsentChange(key: ConsentKey, next: boolean) {
    setAgreedAt((prev) => ({ ...prev, [key]: next ? new Date().toISOString() : null }));
  }

  const canSubmit =
    !busy &&
    !blockedReason[effectiveMode] &&
    agreedAt.terms !== null &&
    agreedAt.refundLimit !== null &&
    userInput.trim().length > 0 &&
    (!product.needsPartner || partnerForm.nickname.trim().length > 0);

  function handleSubmit() {
    if (!canSubmit || !myBirthInfo) return;
    const request: FortunePurchaseRequest = {
      slug: product.slug,
      mode: effectiveMode,
      birthInfo: myBirthInfo,
      partner:
        product.needsPartner && partnerBirthInfo
          ? { nickname: partnerForm.nickname.trim(), birthInfo: partnerBirthInfo }
          : null,
      userInput: userInput.trim(),
      consent: {
        refund: { agreed: agreedAt.refundLimit !== null, noticeVersion: REFUND_NOTICE_VERSION },
        terms: { agreed: agreedAt.terms !== null, termsVersion: TERMS_EFFECTIVE_DATE },
        checkedAt: agreedAt,
      },
    };
    onPurchase?.(request);
  }

  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="선택 운세 정보" backHref="/fortune" />
      {/* 히어로가 상단바 바로 아래에서 시작하고 좌우로 꽉 찬다 — 다른 서브페이지처럼
          `p-4 pt-20` 을 걸면 사진에 여백이 생긴다. 좌우 여백은 각 구역이 스스로 건다. */}
      <div className="scroll-gutter-stable flex-1 overflow-visible pt-16 xl:overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl">
          <ProductHero product={product} />
          {/* 후기는 히어로 바로 아래다(목업 `Fortune_Select_*`) — 상품 설명·목차보다 먼저
              읽힌다. 후기가 없으면 이 구역은 스스로 사라진다. */}
          <ProductReviews slug={product.slug} />
          <SectionOutline product={product} />
          <RequiredInputs
            product={product}
            profileIncomplete={profileIncomplete}
            partnerForm={partnerForm}
            onPartnerFormChange={setPartnerForm}
            savedPartner={partner}
            useSavedPartner={useSavedPartner}
            onUseSavedPartnerChange={handleUseSavedPartner}
            userInput={userInput}
            onUserInputChange={setUserInput}
          />
          <PurchaseNotice />
          {/* 사업자정보. **이 화면이 제13조①의 대상이다** — 전자상거래법 제13조 제1항은
              "재화등의 거래에 관한 **청약을 받을 목적으로** 표시·광고를 할 때" 상호·대표자
              성명·주소·전화·이메일·통신판매업 신고번호를 넣으라고 한다. 가격을 걸고 결제
              버튼을 두는 이 화면이 정확히 그 자리인데 빠져 있었다(2026-09-27 발견).
              이용권 구입 화면(`/charge`)이 이미 같은 이유로 같은 컴포넌트를 쓴다. */}
          <div className="px-4 pt-4">
            <CompanyFooter />
          </div>
          <ModePanel
            product={product}
            mode={effectiveMode}
            onModeChange={setMode}
            blockedReason={blockedReason}
            consents={agreedAt}
            onConsentChange={handleConsentChange}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
