"use client";

import { useRouter } from "next/navigation";

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
 *  면에 쓰는 토큰은 `--point` 라는 기존 규칙이고, `.point-pill` 주석이 이미 같은 판단을 적어 뒀다. */

/** `button.bg-point` 가 거는 것과 같은 코랄 글로우 + 안쪽 테두리 글로우(globals.css 참고).
 *  여기는 `bg-point` 가 아니라 `.point-pill` 이라 그 규칙이 안 걸리므로 값을 직접 얹는다. */
const POINT_GLOW =
  "shadow-[0_0_20px_3px_var(--point-glow),inset_0_0_6px_0_var(--point-rim)]";

export function TarotFortuneToggle({ active }: { active: "tarot" | "fortune" }) {
  const router = useRouter();

  return (
    <div className="flex h-12 w-[216px] shrink-0 items-center rounded-full bg-chip-soft p-1">
      <Half label="타로" selected={active === "tarot"} onClick={() => router.push("/")} />
      <Half
        label="운세"
        selected={active === "fortune"}
        onClick={() => router.push("/fortune")}
      />
    </div>
  );
}

function Half({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
      className={`h-10 flex-1 rounded-full text-base ${
        selected ? `point-pill font-bold ${POINT_GLOW}` : "font-semibold text-placeholder"
      }`}
    >
      {label}
    </button>
  );
}
