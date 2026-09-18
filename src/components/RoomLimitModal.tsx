"use client";

import { CloseIcon } from "@/app/(app)/tarot/icons";

/** 피그마 "Chatroom_Full" — 대화방 100개 상한 도달 시, 새 대화방 생성을 계속할지 확인.
 * 확인하면 가장 오래된 대화방(과 그 리딩)이 영구 삭제된 뒤 새 대화방이 만들어진다. */
export default function RoomLimitModal({
  onConfirm,
  onClose,
  busy,
}: {
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">새 대화방 생성 불가</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="whitespace-pre-line text-center text-sm font-semibold text-icon-muted">
          {"생성된 대화방이 한도에 도달하여\n새로운 대화방을 생성할 수 없습니다."}
        </p>
        <p className="mt-3 whitespace-pre-line text-center text-sm font-semibold text-urgent">
          {"신규 대화방을 생성할 경우\n가장 오래된 대화방이 삭제되며,\n대화 내용은 복구할 수 없습니다."}
        </p>
        <p className="mb-7 mt-3 text-center text-sm font-semibold text-icon-muted">진행하시겠습니까?</p>
        <div className="flex gap-3">
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
            생성하기
          </button>
        </div>
      </div>
    </div>
  );
}
