import { CloseIcon } from "@/app/(app)/tarot/icons";

/** 피그마 "Screen / DeleteAccount"·"Screen / LogoutModal" 공용 패턴 — 제목+설명+취소/확인
 * 버튼(확인 쪽은 urgent 빨강)의 중앙 정렬 확인 모달. */
export default function ConfirmModal({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-[#2a2c31] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold text-white">{title}</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-white">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-5 whitespace-pre-line text-center text-sm font-semibold text-icon-muted">
          {description}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-2xl bg-chip-fill text-base font-semibold text-white"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-12 flex-1 rounded-2xl bg-urgent text-base font-semibold text-white disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
