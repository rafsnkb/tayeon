import type { ReactNode } from "react";
import { CloseIcon } from "@/app/(app)/tarot/icons";

/**
 * 알림형 모달의 **단일 형태**(목업 New/ModalForm_Dark·ModalForm_Dark-1, 2026-09-25).
 *
 * 그 전에는 같은 모양의 마크업이 다섯 파일에 복사돼 있었다 — 한 곳을 고치면 나머지 넷이
 * 조용히 어긋났다. 껍데기를 여기 하나로 모으고, 각 모달은 제목·내용·버튼만 넘긴다.
 *
 * ## 실측 (sharp, 목업 1236px 폭 = 412pt 뷰포트 → scale 3)
 *
 * | | 목업 | 적용 |
 * |---|---|---|
 * | 모달 폭 | 380pt (좌우 여백 16) | `p-4` 오버레이 + `max-w-sm` — 412pt 화면에서 정확히 380 |
 * | 모서리 | 27pt | `rounded-[28px]` (기존 값이 이미 맞았다) |
 * | 면 색 | 라이트 #ffffff · 다크 #322b2b | `bg-topbar` — 아래 주석 참고 |
 * | 버튼 높이 | 40.3pt | `h-10` |
 * | 버튼 좌우 여백 | 16pt (모달 안쪽) | 패널 `p-5`(20) 안에서 버튼이 풀폭 |
 * | 버튼 모서리 | 12pt | `rounded-xl` |
 * | 버튼 아래 여백 | 19.7pt | `p-5` |
 * | 버튼 색 | 라이트 #fe748d→#e04e6e · 다크 #ff7d8d→#fc5f78 | `.point-pill` — 라이트 끝값이 `--point` 와 정확히 일치한다 |
 *
 * **다크 면 색은 목업(#322b2b)이 아니라 토큰(`--topbar`, #1a1616)을 따른다**(사용자 결정,
 * 2026-09-25). 목업 값은 `--chip-soft` 다크(#2f2a2a)에 가깝지만 라이트에서는 #e7e2e1 이라
 * 두 모드를 한 토큰으로 덮을 수 없고, 그 자리에 전용 토큰을 새로 파는 것보다 기존 토큰을
 * 지키는 쪽을 택했다. 목업↔토큰이 어긋나면 토큰이 이긴다.
 */
export default function ModalShell({
  title,
  onClose,
  children,
  footer,
  closeLabel = "닫기",
}: {
  /** 없으면 제목 줄 자체를 그리지 않는다 — 닫기(X)만 필요한 경우가 있다. */
  title?: string;
  onClose: () => void;
  children: ReactNode;
  /** 하단 버튼 줄. `ModalButton` / `ModalButtonRow` 를 쓴다. */
  footer: ReactNode;
  closeLabel?: string;
}) {
  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 제목은 가운데, X 는 오른쪽 끝. 왼쪽의 빈 칸은 제목을 **패널 기준 가운데**로 두기
            위한 것이다 — 없으면 X 폭만큼 왼쪽으로 밀린다. */}
        <div className="mb-6 flex items-center justify-between">
          <div className="w-5" />
          {title ? (
            <p className="flex-1 text-center text-lg font-bold text-bold-text">{title}</p>
          ) : (
            <div className="flex-1" />
          )}
          <button type="button" onClick={onClose} aria-label={closeLabel} className="text-icon-muted">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-7 text-center text-sm font-semibold text-icon-muted">{children}</div>

        {footer}
      </div>
    </div>
  );
}

/** 하단 풀폭 버튼. 기본은 목업의 핑크 그라데이션(`.point-pill`).
 *
 *  `tone="danger"` 는 되돌릴 수 없는 액션(탈퇴·로그아웃·대화방 영구삭제) 전용이다 —
 *  **경고의 뜻이라 기존 `--urgent` 를 그대로 쓴다**(사용자 결정, 2026-09-25). 그 자리에
 *  분홍 그라데이션을 쓰면 "지우기"가 화면에서 가장 탐스러운 버튼이 된다. */
export function ModalButton({
  children,
  onClick,
  tone = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "danger" | "neutral";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const skin =
    tone === "danger"
      ? "bg-urgent text-white"
      : tone === "neutral"
        ? "bg-chip-fill text-white"
        : "point-pill";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`h-10 w-full rounded-xl text-base font-semibold disabled:opacity-60 ${skin}`}
    >
      {children}
    </button>
  );
}

/** 버튼이 둘인 경우(취소 + 파괴적 확인). 모달 껍데기는 알림형과 똑같이 두고 **이 줄만**
 *  갈라진다 — 확인 모달을 X 하나로 취소하게 만들면 20px 아이콘이 유일한 탈출구가 되고, 큰
 *  버튼이 곧 파괴 액션이 되어 오조작이 쉬워진다(사용자 결정, 2026-09-25). */
export function ModalButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-3 [&>button]:flex-1">{children}</div>;
}
