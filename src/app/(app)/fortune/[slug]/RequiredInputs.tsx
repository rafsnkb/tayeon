"use client";

import Link from "next/link";
import {
  BirthDateField,
  BirthTimeField,
  BirthTimeNotice,
  FieldLabel,
  ToggleGroup,
} from "@/components/FormControls";
import { CheckIcon } from "@/app/(app)/tarot/icons";
import type { CalendarMode } from "@/lib/tarot/birthInfo";
import type { Partner } from "@/lib/tarot/RoomsContext";
import type { SajuProduct } from "@/lib/saju/products";
import type { PartnerForm } from "./partnerForm";

/** 목업의 「필요 정보 입력」 구역.
 *
 *  내 정보는 **여기서 고치지 않는다** — 등록된 프로필을 그대로 쓴다고 한 줄로 알리고 끝이다
 *  (목업 원문: "내 정보는 등록된 프로필 정보를 기반으로 계산합니다."). 상대 정보 블록은
 *  `needsPartner: true` 상품(19개 중 10개)에만 나오고, 아니면 통째로 빠진다.
 *
 *  목업에 없지만 넣은 것이 하나 있다 — **내 프로필이 비어 있을 때의 안내**. 설계 §10 이 성별을
 *  필수로 못박았는데 이 화면에는 내 정보를 고치는 칸이 없어서, 안내가 없으면 결제 버튼이 왜
 *  안 눌리는지 알 방법이 없다.
 *
 *  실측(목업 3배): 카드 라운드 28 · 패딩 16 · 구분선은 패딩선까지 · 칸 묶음 사이 20 ·
 *  라벨 14 · 입력칸 h48 라운드 16 글자 18 · 안내문 14 · textarea h144 패딩 12 글자 16/19. */
export function RequiredInputs({
  product,
  profileIncomplete,
  partnerForm,
  onPartnerFormChange,
  savedPartner,
  useSavedPartner,
  onUseSavedPartnerChange,
  userInput,
  onUserInputChange,
}: {
  product: SajuProduct;
  /** 내 프로필에 §10 이 요구하는 값(생년월일·성별)이 없다. */
  profileIncomplete: boolean;
  partnerForm: PartnerForm;
  onPartnerFormChange: (next: PartnerForm) => void;
  savedPartner: Partner | null;
  useSavedPartner: boolean;
  onUseSavedPartnerChange: (next: boolean) => void;
  userInput: string;
  onUserInputChange: (next: string) => void;
}) {
  const patch = (next: Partial<PartnerForm>) => onPartnerFormChange({ ...partnerForm, ...next });

  return (
    <section className="px-4">
      <h2 className="mb-1.5 mt-10 text-center text-base font-bold text-bold-text">필요 정보 입력</h2>
      <div className="rounded-[28px] border border-border bg-surface p-4">
        <p className="text-center text-base font-semibold text-placeholder">
          내 정보는 등록된 프로필 정보를 기반으로 계산합니다.
        </p>
        {profileIncomplete && (
          <p className="pt-2 text-center text-sm font-semibold text-urgent">
            생년월일과 성별이 등록되어 있어야 구매할 수 있어요.{" "}
            <Link href="/me/profile" className="font-bold text-point-text underline underline-offset-2">
              내 정보 등록하기
            </Link>
          </p>
        )}

        {product.needsPartner && (
          <div className="mt-5 space-y-5 border-t border-border pt-5">
            {/* 저장된 상대가 없으면 이 줄 자체가 없다 — 불러올 것이 없는데 체크칸만 남으면
                눌리지 않는 칸이 된다. 목업은 상대가 저장돼 있는 상태만 그려 놓았다. */}
            {savedPartner && (
              <label className="flex cursor-pointer items-center gap-2 text-base font-semibold text-placeholder">
                <input
                  type="checkbox"
                  checked={useSavedPartner}
                  onChange={(e) => onUseSavedPartnerChange(e.target.checked)}
                  className="sr-only"
                />
                {/* 동의 체크(코랄)와 모양이 다르다 — 목업의 이 체크는 옅은 칩 면이다.
                    같은 화면 안에서 "필수 동의"와 "편의 기능"을 갈라 놓은 것이라 맞춘다. */}
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                    useSavedPartner ? "bg-chip-soft text-chip-soft-text" : "border border-border"
                  }`}
                >
                  <CheckIcon className={`h-3 w-3 ${useSavedPartner ? "" : "opacity-0"}`} />
                </span>
                내가 등록한 상대방 프로필 정보를 사용할게요
              </label>
            )}

            <label className="flex flex-col gap-1">
              <FieldLabel required>상대방 닉네임 (변경 가능)</FieldLabel>
              <input
                value={partnerForm.nickname}
                onChange={(e) => patch({ nickname: e.target.value })}
                placeholder="상대방을 뭐라고 부를까요?"
                className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none placeholder-placeholder"
              />
            </label>

            <div className="flex flex-col gap-1">
              <BirthDateField
                label="상대방 생년월일"
                required
                value={partnerForm.birthDate}
                onChange={(v) => patch({ birthDate: v })}
                calendarMode={partnerForm.calendarMode}
              />
              <ToggleGroup
                options={[
                  { value: "solar" as const, label: "양력" },
                  { value: "lunar" as const, label: "음력" },
                  { value: "lunarLeap" as const, label: "음력(윤달)" },
                ]}
                value={partnerForm.calendarMode}
                onChange={(v: CalendarMode) => patch({ calendarMode: v })}
              />
            </div>

            <div className="flex flex-col gap-1">
              {/* 목업에 「태어난 시간을 몰라요」 체크가 없다 — 빈 칸이 곧 "모름"이고, 그때
                  아래 경고문이 자미두수·통합을 못 판다고 알린다(설계 §10). */}
              <BirthTimeField
                value={partnerForm.birthTime}
                onChange={(v) => patch({ birthTime: v })}
              />
              <BirthTimeNotice />
            </div>

            <div className="flex flex-col gap-1">
              {/* 목업의 성별 라벨에는 `*` 가 없지만 설계 §10 이 **필수**로 못박았다(대운이 성별
                  없이는 계산되지 않고, 자미두수는 지금 미지정을 남성으로 때운다). 표시를 빼면
                  결제 버튼이 왜 안 눌리는지 알 수 없어서 붙였다. 「선택안함」 칸도 없다. */}
              <FieldLabel required>성별</FieldLabel>
              {/* 타입 인자를 직접 준다. options 를 두 칸만 두고 값이 `unspecified` 이면
                  **아무 칸도 선택되지 않는다** — 고르기 전에 한쪽이 골라진 것처럼 보이면
                  안 고르고 넘어간다. */}
              <ToggleGroup<Partner["gender"]>
                options={[
                  { value: "female", label: "여성" },
                  { value: "male", label: "남성" },
                ]}
                value={partnerForm.gender}
                onChange={(v) => patch({ gender: v })}
              />
              {partnerForm.gender === "unspecified" && (
                <p className="pt-1 text-sm font-semibold text-urgent">상대방의 성별을 골라주세요</p>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <FieldLabel>출생지 (선택)</FieldLabel>
              <input
                value={partnerForm.birthPlace}
                onChange={(e) => patch({ birthPlace: e.target.value })}
                placeholder="태어난 도시를 알려주세요"
                className="h-12 rounded-2xl border border-border bg-bg px-3 text-lg font-semibold text-bold-text outline-none placeholder-placeholder"
              />
              <span className="pt-1 text-sm font-semibold text-placeholder">
                출생지를 입력하면 사주 · 자미두수 분석 정확도가 올라가요
              </span>
            </label>
          </div>
        )}

        <label className="mt-5 flex flex-col gap-1 border-t border-border pt-5">
          {/* 목업은 "내용를" 인데 오타라 고쳤다(2026-09-26 확인). 목업 원문을 그대로 두라는
              규칙은 **환불·약관 문구**에 대한 것이고(법적 효력이 있다), 일반 안내문의 오타는
              그대로 둘 이유가 없다. 환불 문구는 `refundNotice.ts` 에 원문 그대로 있다. */}
          <FieldLabel required>적어주신 내용을 기반으로 해석이 생성됩니다.</FieldLabel>
          <textarea
            value={userInput}
            onChange={(e) => onUserInputChange(e.target.value)}
            placeholder={product.userInputPrompt}
            className="h-36 resize-none rounded-2xl border border-border bg-bg p-3 text-base font-semibold leading-[19px] text-bold-text outline-none placeholder-placeholder"
          />
        </label>
      </div>
    </section>
  );
}
