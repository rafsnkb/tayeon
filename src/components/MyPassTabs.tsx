"use client";

import { usePathname, useRouter } from "next/navigation";

/**
 * "내 보유 이용권" 화면의 하단 탭바(목업 MyPass_Held / MyPass_Send).
 *
 * 두 탭이 **경로 두 개**다. 한 화면에 상태로 묶을 수도 있었지만, 받은 이용권 내역 쪽은 수령
 * 흐름(조합 선택 → 받기)과 모달 두 개를 들고 있어서 옮기면 그 흐름을 다시 검증해야 한다.
 * 경로를 나누면 각자 자기 상태를 그대로 쓰고, 알림에서 "리워드 도착"을 눌렀을 때 수령 탭으로
 * 바로 보내는 것도 링크 하나로 끝난다.
 *
 * `replace` 로 옮긴다 — 탭을 오가는 것이 히스토리에 쌓이면 뒤로가기가 탭 사이를 왕복한다.
 */
const TABS = [
  { href: "/my-passes", label: "보유 이용권" },
  { href: "/received-passes", label: "받은 이용권 내역" },
] as const;

export default function MyPassTabs() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-topbar p-4">
      <div className="mx-auto flex w-full max-w-2xl overflow-hidden rounded-full bg-chip-fill">
        {TABS.map((tab) => (
          <button
            key={tab.href}
            type="button"
            onClick={() => pathname !== tab.href && router.replace(tab.href)}
            className={`h-14 flex-1 text-base font-semibold ${
              pathname === tab.href ? "bg-point text-white" : "text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
