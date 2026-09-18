"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "@/app/(app)/tarot/icons";

/** 피그마의 서브페이지 공통 TopBar(뒤로가기+제목, 가운데 정렬) — MyProfile/Setting/PartnerProfile/
 * Buy-Coin/PurchaseHistory/UsingHistory 등 "메뉴 드로어가 아니라 뒤로가기로 돌아가는" 화면에서 공유. */
export default function SubPageTopBar({ title, onBack, backHref }: { title: string; onBack?: () => void; backHref?: string }) {
  const router = useRouter();
  return (
    <div className="app-topbar-glass fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-center border-b border-border">
      <div className="relative mx-auto flex h-full w-full max-w-2xl items-center justify-center">
        <button
          type="button"
          onClick={onBack ?? (() => backHref ? router.push(backHref) : router.back())}
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
