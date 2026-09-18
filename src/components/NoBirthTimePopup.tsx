"use client";

import { useRouter } from "next/navigation";
import { CloseIcon } from "@/app/(app)/tarot/icons";

/** 피그마 "Buy - CountPurchase_NoBirthTimePopup" — 자미두수가 포함된 조합(구매/수령)을 골랐는데
 * 태어난 시간이 없거나 "모름"인 경우. `/charge`(횟수제·시간제 조합 선택)와
 * `/received-passes`(리워드 조합 선택) 양쪽에서 공용으로 쓴다. */
export default function NoBirthTimePopup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">상품 구매 불가</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-7 whitespace-pre-line text-center text-sm font-semibold text-icon-muted">
          {"[내 프로필 정보]에 태어난 시간이 없으면\n자미두수 기능을 사용할 수 없습니다."}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-chip-fill text-base font-semibold text-white"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => router.push("/me/profile")}
            className="h-12 flex-1 rounded-2xl bg-point text-base font-semibold text-white"
          >
            입력하러 이동
          </button>
        </div>
      </div>
    </div>
  );
}
