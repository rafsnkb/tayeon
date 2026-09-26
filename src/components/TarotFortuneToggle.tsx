"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidingSegments } from "@/components/SlidingSegments";

/** 상단바 한가운데의 「타로 / 운세」 전환. 두 서비스의 초기 화면이 같은 자리에서 갈린다
 *  (목업 New/`Main_Dark`·`Main_Fortune_Dark`·`Fortune_Home_*`·`MenuOpen_Fortune_*`).
 *
 *  실측(2026-09-26, `Fortune_Home_Dark`, 목업 1236px = 뷰포트 412px 이므로 3배):
 *    · 트랙 x 294~941(216), y 24~167(48) — 화면 가로 중앙, 상단바(h-16) 세로 중앙
 *    · 안쪽 여백 4, 선택 알약 104x40 → 트랙 p-1 + 각 칸 flex-1 로 그대로 떨어진다
 *    · 선택 알약은 **가로** 그라데이션(왼 `--point-light` → 오른 `--point`)이라 `.point-pill`
 *      이 정확히 같은 값이다. 대각선인 `button.bg-point` 가 아니다
 *    · 코랄 글로우가 알약 밖 ~13px 까지 번진다 — `button.bg-point` 의 그림자 값을 그대로 쓴다
 *    · 라벨 16px, 선택 Bold/흰색 · 비선택 SemiBold/`--placeholder`(실측 #8b8786 / #6b6666)
 *
 *  **다크 목업의 그라데이션 오른쪽 끝은 #fc5f78(`--point-text`)이지만 `--point` 를 쓴다** —
 *  면에 쓰는 토큰은 `--point` 라는 기존 규칙이고, `.point-pill` 주석이 이미 같은 판단을 적어 뒀다.
 *
 *  ── 알약이 미끄러진다 (2026-09-27) ──────────────────────────────────────────
 *  **이건 화면을 바꾸는 토글이라 그냥 CSS 트랜지션으로는 안 움직인다.** 누르면 라우터가
 *  이동하고, 새 화면이 자기 토글을 **새 DOM 노드로** 그린다 — 트랜지션은 같은 노드의 값이
 *  바뀔 때만 도는 것이라, 새로 태어난 알약은 이미 목적지에 서 있다.
 *
 *  그래서 **누른 순간 여기서 먼저 옮긴다**(`pending`). 알약은 아직 살아 있는 이전 화면 위에서
 *  미끄러지기 시작하고, 이동이 끝나면 새 화면의 알약이 같은 자리에 서 있어 이어 붙는다.
 *  낙관적으로 움직이는 것이라 이동이 실패하면 알약만 옮겨간 꼴이 되는데, 같은 앱 안의 라우터
 *  이동이라 실패할 경로가 사실상 없다. */

/** `button.bg-point` 가 거는 것과 같은 코랄 글로우 + 안쪽 테두리 글로우(globals.css 참고).
 *  여기는 `bg-point` 가 아니라 `.point-pill` 이라 그 규칙이 안 걸리므로 값을 직접 얹는다. */
const POINT_GLOW =
  "shadow-[0_0_20px_3px_var(--point-glow),inset_0_0_6px_0_var(--point-rim)]";

const HALVES = [
  { key: "tarot", label: "타로", href: "/" },
  { key: "fortune", label: "운세", href: "/fortune" },
] as const;

export function TarotFortuneToggle({ active }: { active: "tarot" | "fortune" }) {
  const router = useRouter();
  // 누른 칸. 라우터가 옮겨 주기 전에 알약을 먼저 보낸다(위 머리말). `null` 이면 실제 화면
  // 기준(`active`)이다 — 그래서 이동이 끝나 새 토글이 그려질 때 값이 어긋나지 않는다.
  const [pending, setPending] = useState<"tarot" | "fortune" | null>(null);
  const shown = pending ?? active;

  return (
    <SlidingSegments
      count={HALVES.length}
      index={HALVES.findIndex((h) => h.key === shown)}
      padding={4}
      className="flex h-12 w-[216px] shrink-0 items-center rounded-full bg-chip-soft p-1"
      indicatorClassName={`rounded-full point-pill ${POINT_GLOW}`}
    >
      {HALVES.map((half) => (
        <button
          key={half.key}
          type="button"
          onClick={() => {
            if (half.key === shown) return;
            setPending(half.key);
            router.push(half.href);
          }}
          aria-current={shown === half.key ? "page" : undefined}
          // 배경·그라데이션은 알약이 들고 있다. 여기 남는 건 글자뿐이다.
          className={`relative h-10 flex-1 rounded-full text-base transition-colors motion-reduce:transition-none ${
            shown === half.key ? "font-bold text-white" : "font-semibold text-placeholder"
          }`}
        >
          {half.label}
        </button>
      ))}
    </SlidingSegments>
  );
}
