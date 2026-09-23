"use client";

import type { CountPass, TimePass, ActiveTimePass } from "@/lib/tarot/RoomsContext";
import { COMBOS, countPassDisplayName, type ComboKey } from "@/lib/tarot/pricing";
import { TIME_COMBO_TIER } from "@/lib/tarot/passTiers";
import { CloseIcon, SearchIcon } from "./icons";

/* 이용권(횟수제·시간제)을 보여주는 조각들 — 컴포저 위의 이용권 바, 그 바가 여는 사용량
 * 모달과 링, 보유 시간제 카드, 그리고 이용권이 없을 때 뜨는 구입 유도 모달.
 *
 * 원래 TarotScreen.tsx 한 파일에 화면 전체가 들어 있었다(1783줄). 대화 화면 본체와 이
 * 조각들은 이용권 상태 말고는 얽힌 데가 없어서 따로 뗀다(2026-09-24). */

// 활성 이용권 이름 + 조합 표기 — "스탠다드 이용권(타로+사주+자미두수 전용)" 형식(combo:"any"인
// 가입 무료체험은 특정 조합에 묶이지 않으므로 괄호 생략).
export function countPassFullName(pass: { productId?: string; source?: string; combo: ComboKey | "any" }): string {
  const base = countPassDisplayName(pass);
  return pass.combo === "any" ? base : `${base}(${COMBOS[pass.combo].label} 전용)`;
}

/**
 * 남은 비율을 링(도넛)으로 그린다. 12시에서 시작해 시계방향으로 "쓴 만큼" 비워진다
 * — 피그마 Redesign 시간제 바의 링과 같은 방향이다(빈 구간이 12시 바로 오른쪽).
 *
 * dashoffset 을 음수로 줘서 코랄 호가 "이미 쓴 만큼" 뒤에서 시작하게 한다.
 * 끝은 각지게 둔다(시안도 butt). 시안의 빈 구간은 #000000 인데 라이트에서 검은
 * 노치로 튀어 피그마 기본값으로 보고 --chip-soft 를 트랙으로 쓴다.
 */
export function ProgressRing({
  percent,
  size,
  stroke,
  children,
}: {
  percent: number;
  size: number;
  stroke: number;
  children?: React.ReactNode;
}) {
  const v = Math.max(0, Math.min(100, percent)) / 100;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chip-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--point)"
          strokeWidth={stroke}
          strokeDasharray={`${circ * v} ${circ}`}
          strokeDashoffset={-circ * (1 - v)}
        />
      </svg>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>}
    </span>
  );
}

/**
 * 이용권 바(돋보기)로 여는 모달. 위쪽은 보유한 시간제 이용권, 아래쪽은 지금 쓰고 있는
 * 이용권의 남은 사용량이다. 시간제가 켜져 있으면 남은 시간 비율을, 아니면 횟수제의
 * 잔량 비율을 링으로 보여준다.
 */
export function PassUsageModal({
  timePasses,
  activeTimePass,
  timePassActive,
  countPass,
  now,
  onUse,
  onGoCharge,
  onClose,
}: {
  timePasses: TimePass[];
  activeTimePass: ActiveTimePass | null;
  timePassActive: boolean;
  countPass: CountPass | undefined;
  now: number;
  /** 시간제 이용권 켜기. 이미 켜져 있으면 버튼을 내보내지 않는다. */
  onUse: (pass: TimePass) => void;
  onGoCharge: () => void;
  onClose: () => void;
}) {
  const timeRemaining =
    timePassActive && activeTimePass
      ? (new Date(activeTimePass.expiresAt).getTime() - now) / (activeTimePass.minutes * 60_000)
      : null;
  const percent =
    timeRemaining !== null ? timeRemaining * 100 : countPass ? countPass.remaining * 100 : 0;
  const caption =
    timeRemaining !== null && activeTimePass
      ? `${activeTimePass.minutes}분 무제한 이용권`
      : countPass
        ? countPassFullName(countPass)
        : "사용 중인 이용권 없음";

  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col rounded-[32px] border border-border bg-topbar p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">이용권</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text"><CloseIcon className="h-5 w-5" /></button>
        </div>

        <p className="mb-2 text-center text-sm font-semibold text-icon-muted">보유 시간제 이용권</p>
        {/* 예전엔 스크롤 영역 위에 떠 있던 이용권 배지가 이 목록(HeldTimepassListModal)과
            "없음" 안내(NoHeldTimepassModal)를 열었다. 시안 상단바엔 더보기뿐이라 배지를
            걷어내면서, 켜기와 구입 유도를 여기로 옮겼다(2026-09-23). */}
        {timePasses.length > 0 ? (
          <div className="flex max-h-[38vh] flex-col gap-2 overflow-y-auto">
            {timePasses.map((pass) => (
              <TimePassCard
                key={pass.id}
                pass={pass}
                actionLabel={timePassActive ? undefined : "사용하기"}
                onAction={timePassActive ? undefined : () => onUse(pass)}
              />
            ))}
          </div>
        ) : (
          <>
            <p className="rounded-2xl bg-chip-soft px-4 py-3 text-center text-sm font-semibold text-chip-soft-text">
              보유중인 시간제 이용권이 없어요
            </p>
            <button
              type="button"
              onClick={onGoCharge}
              className="mt-2 h-12 w-full rounded-2xl bg-point text-base font-semibold text-white"
            >
              구입하러 가기
            </button>
          </>
        )}

        <p className="mb-2 mt-6 text-center text-sm font-semibold text-icon-muted">남은 사용량</p>
        <span className="mx-auto">
          <ProgressRing percent={percent} size={136} stroke={12}>
            <span className="text-2xl font-bold text-bold-text">{Math.round(percent)}%</span>
            <span className="text-xs font-semibold text-icon-muted">남음</span>
          </ProgressRing>
        </span>
        <p className="mt-2 text-center text-sm font-semibold text-icon-muted">{caption}</p>
      </div>
    </div>
  );
}

/**
 * 컴포저 위에 붙는 이용권 바(피그마 Redesign 실측: 382x32, 돋보기 원 24 에 안쪽 여백 4).
 * 시간제가 켜져 있으면 시간제를, 아니면 횟수제를 보여준다 — 둘 다 같은 바를 쓴다.
 */
export function PassBar({
  label,
  value,
  ringPercent,
  onOpen,
}: {
  label: string;
  value: string;
  /** 시간제일 때만 준다 — 남은 시간 비율. 횟수제 바에는 링이 없다. */
  ringPercent?: number;
  onOpen: () => void;
}) {
  return (
    <div className="mb-2 flex h-8 items-center gap-2 rounded-full border border-border bg-surface p-1">
      <button
        type="button"
        onClick={onOpen}
        aria-label="이용권 사용량 보기"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-chip-soft text-chip-soft-text"
      >
        <SearchIcon className="h-3 w-3" />
      </button>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-placeholder">{label}</span>
      {ringPercent !== undefined && <ProgressRing percent={ringPercent} size={12} stroke={2} />}
      <span className="shrink-0 pr-2 text-xs font-semibold text-placeholder">{value}</span>
    </div>
  );
}
export function TimePassCard({ pass, actionLabel, onAction, busy }: {
  pass: TimePass;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}) {
  const tier = TIME_COMBO_TIER[pass.combo] ?? TIME_COMBO_TIER.tarot;
  return (
    <div
      className="relative flex h-20 items-center gap-2 overflow-hidden rounded-[32px] border bg-cover bg-center px-4"
      style={{ borderColor: tier.border, backgroundImage: `url(${tier.bg})` }}
    >
      <div className="absolute inset-0 bg-topbar/70" />
      <div className="relative flex flex-1 flex-col gap-1">
        <span className="text-2xl font-bold text-white">{pass.minutes}분 무제한</span>
        <span
          className="w-fit rounded-full px-2 py-0.5 text-sm font-semibold"
          style={{ backgroundColor: tier.tagBg, color: tier.tagText }}
        >
          {COMBOS[pass.combo].label} 무제한
        </span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          className="relative shrink-0 rounded-2xl bg-point px-5 py-3 text-base font-bold text-white disabled:opacity-60"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** 피그마 "Screen / HeldTimepassUseModal" — 실제로 활성화되면 즉시 시간 차감이 시작된다는 걸
 * 한 번 더 확인시키는 모달. */
export function HeldTimepassUseModal({
  pass,
  busy,
  onConfirm,
  onClose,
}: {
  pass: TimePass;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-[28px] border border-border bg-topbar p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-1">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">시간제 이용권 사용하기</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-center text-sm font-semibold text-icon-muted">선택한 시간제 이용권</p>
        <TimePassCard pass={pass} />
        <p className="text-center text-base font-semibold text-bold-text">
          선택한 시간제 이용권을 사용하시겠어요?
        </p>
        <p className="text-center text-sm font-semibold text-urgent">
          시간제 이용권은 사용하기를 누른 순간부터 시간 차감이 시작되며, 브라우저를 닫아도 멈추지 않습니다.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="h-12 w-full rounded-2xl bg-point text-base font-semibold text-white disabled:opacity-60"
        >
          사용하기
        </button>
      </div>
    </div>
  );
}

export function PurchaseTicketModal({
  onClose,
  onInvite,
  onPurchase,
}: {
  onClose: () => void;
  onInvite: () => void;
  onPurchase: () => void;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">인연의 끈을 이어갈까요?</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-5 text-center text-sm font-semibold leading-5 text-icon-muted">
          당신의 앞길을 비춰줄 조언을 더 주고싶지만,<br />
          아쉽게도 가진 이용권을 모두 사용하셨어요.
        </p>
        <p className="mt-4 text-center text-sm font-semibold leading-5 text-icon-muted">
          새로운 나침반이 필요하다면<br />
          언제든 이용권을 채워주세요.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onInvite} className="h-12 flex-1 rounded-full bg-cta-fill text-base font-bold text-cta-text">
            친구 초대하기
          </button>
          <button type="button" onClick={onPurchase} className="h-12 flex-1 rounded-full bg-point text-base font-bold text-white">
            이용권 구입하기
          </button>
        </div>
        <p className="mt-5 text-center text-xs font-semibold text-icon-muted">기존 대화는 안전하게 보관됩니다.</p>
      </div>
    </div>
  );
}
