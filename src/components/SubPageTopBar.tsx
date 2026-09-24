"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/app/(app)/tarot/icons";
import { canReturnByHistory } from "@/lib/navigation";

/** 피그마의 서브페이지 공통 TopBar(뒤로가기+제목, 가운데 정렬) — MyProfile/Setting/PartnerProfile/
 * Buy-Coin/PurchaseHistory/UsingHistory 등 "메뉴 드로어가 아니라 뒤로가기로 돌아가는" 화면에서 공유. */
export default function SubPageTopBar({ title, onBack, backHref }: { title: string; onBack?: () => void; backHref?: string }) {
  const router = useRouter();

  /** `backHref` 는 "돌아갈 곳"이지 "엔트리를 하나 더 쌓아라"가 아니다. push 로 열면 히스토리가
   *  줄지 않고 늘어나서, 돌아간 화면의 뒤로가기(back)가 방금 떠난 화면으로 다시 들어가고 그
   *  화면이 또 push 하면서 두 화면이 영원히 왕복한다 — 마이페이지 ↔ 이용권 구입에서 실제로
   *  그랬다(2026-09-25). 온 곳이 히스토리 바로 뒤에 그대로 있으면 back(), 아니면(결제
   *  리다이렉트로 문서가 다시 뜬 경우 등) replace 로 그 자리를 갈아끼운다. */
  function goBack() {
    if (!backHref) return router.back();
    if (canReturnByHistory(backHref)) return router.back();
    router.replace(backHref);
  }
  return (
    <div className="app-topbar-glass fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center border-b border-border">
      <div className="relative mx-auto flex h-full w-full max-w-2xl items-center justify-center">
        <button
          type="button"
          onClick={onBack ?? goBack}
          aria-label="뒤로가기"
          className="absolute left-6 flex h-16 w-8 items-center justify-center text-bold-text"
        >
          <BackIcon className="h-5 w-2.5" />
        </button>
        <span className="text-xl font-semibold text-bold-text">{title}</span>
      </div>
    </div>
  );
}
