"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/app/(app)/tarot/icons";

/** 피그마의 서브페이지 공통 TopBar(뒤로가기+제목, 가운데 정렬) — MyProfile/Setting/PartnerProfile/
 * Buy-Coin/PurchaseHistory/UsingHistory 등 "메뉴 드로어가 아니라 뒤로가기로 돌아가는" 화면에서 공유. */
export default function SubPageTopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex h-16 shrink-0 items-center justify-center border-b border-border bg-topbar">
      <div className="relative mx-auto flex h-full w-full max-w-2xl items-center justify-center">
        <button
          type="button"
          onClick={onBack ?? (() => router.back())}
          aria-label="뒤로가기"
          className="absolute left-0 flex h-16 items-center text-bold-text"
        >
          <BackIcon className="h-5 w-2.5" />
        </button>
        <span className="text-xl font-semibold text-bold-text">{title}</span>
      </div>
    </div>
  );
}
