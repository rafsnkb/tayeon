"use client";

import ModalShell, { ModalButton, ModalButtonRow } from "@/components/ModalShell";
import { ROOM_LIMIT } from "@/lib/tarot/limits";

/** 대화방 상한 도달 시, 새 대화방 생성을 계속할지 확인. 확인하면 가장 오래된 대화방(과 그
 *  리딩)이 **영구 삭제**된 뒤 새 대화방이 만들어진다 — 되돌릴 수 없으므로 ConfirmModal 과
 *  같은 2버튼 형태를 쓴다(ModalShell 주석 참고). */
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
    <ModalShell
      title="대화방이 가득 찼어요"
      onClose={onClose}
      closeLabel="취소"
      footer={
        <ModalButtonRow>
          <ModalButton tone="neutral" onClick={onClose}>취소</ModalButton>
          <ModalButton tone="danger" onClick={onConfirm} disabled={busy}>삭제하고 시작</ModalButton>
        </ModalButtonRow>
      }
    >
      <p className="whitespace-pre-line">
        {`대화방은 최대 ${ROOM_LIMIT}개까지 만들 수 있어요.\n계속하면 가장 오래된 대화방이 영구 삭제됩니다.`}
      </p>
    </ModalShell>
  );
}
