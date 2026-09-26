"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidingSegments } from "@/components/SlidingSegments";

/**
 * "내 보유 이용권" 화면의 하단 탭바(목업 MyPass_Held / MyPass_Send).
 *
 * 두 탭이 **경로 두 개**다. 한 화면에 상태로 묶을 수도 있었지만, 받은 이용권 내역 쪽은 수령
 * 흐름(조합 선택 → 받기)과 모달 두 개를 들고 있어서 옮기면 그 흐름을 다시 검증해야 한다.
 * 경로를 나누면 각자 자기 상태를 그대로 쓰고, 알림에서 "리워드 도착"을 눌렀을 때 수령 탭으로
 * 바로 보내는 것도 링크 하나로 끝난다.
 *
 * `replace` 로 옮긴다 — 탭을 오가는 것이 히스토리에 쌓이면 뒤로가기가 탭 사이를 왕복한다.
 *
 * **알약은 누른 순간 먼저 옮긴다**(2026-09-27). 두 탭이 경로 두 개라, 이동이 끝나면 새 페이지가
 * 이 탭바를 **새 DOM 노드로** 다시 그린다 — 트랜지션은 같은 노드의 값이 바뀔 때만 돌아서
 * 그대로 두면 아무것도 안 움직인다(`TarotFortuneToggle` 머리말과 같은 이유·같은 처방).
 */
const TABS = [
  { href: "/my-passes", label: "보유 이용권" },
  { href: "/received-passes", label: "받은 이용권 내역" },
] as const;

export default function MyPassTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const shown = pending ?? pathname;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-topbar p-4">
      {/* 활성 탭은 트랙에 꽉 찬 "반쪽"이 아니라 사방 8px 안쪽으로 들어간 알약이다(목업
          MyPass_Held/Send). 트랙을 꽉 채우면 알약의 안쪽 두 모서리가 각져서 목업과 다르다 —
          트랙에 패딩을 주고 알약 자신을 rounded-full 로 만들어야 네 모서리가 다 둥글다.
          `padding={8}` 은 트랙의 `p-2` 와 **같은 값이어야 한다**(SlidingSegments 주석). */}
      <SlidingSegments
        count={TABS.length}
        index={TABS.findIndex((tab) => tab.href === shown)}
        padding={8}
        className="mx-auto flex w-full max-w-2xl rounded-full bg-chip-soft p-2"
        indicatorClassName="rounded-full bg-point"
      >
        {TABS.map((tab) => (
          <button
            key={tab.href}
            type="button"
            onClick={() => {
              if (shown === tab.href) return;
              setPending(tab.href);
              router.replace(tab.href);
            }}
            className={`relative h-10 flex-1 rounded-full text-base font-semibold transition-colors motion-reduce:transition-none ${
              shown === tab.href ? "text-white" : "text-placeholder"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </SlidingSegments>
    </div>
  );
}
