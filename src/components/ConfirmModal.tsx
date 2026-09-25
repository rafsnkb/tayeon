import ModalShell, { ModalButton, ModalButtonRow } from "@/components/ModalShell";

/** 제목 + 설명 + 취소/확인. 회원탈퇴·로그아웃처럼 **되돌릴 수 없는** 액션을 묻는다.
 *
 * 껍데기는 알림형 모달과 똑같은 ModalShell 이고, 다른 것은 하단 버튼 줄 하나뿐이다 —
 * 확인을 X 하나로 취소하게 만들면 20px 아이콘이 유일한 탈출구가 되고 큰 버튼이 곧 파괴
 * 액션이 된다. 확인 버튼 색은 경고의 뜻이라 --urgent 를 유지한다(2026-09-25 사용자 결정). */
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
    <ModalShell
      title={title}
      onClose={onClose}
      closeLabel="취소"
      footer={
        <ModalButtonRow>
          <ModalButton tone="neutral" onClick={onClose}>취소</ModalButton>
          <ModalButton tone="danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</ModalButton>
        </ModalButtonRow>
      }
    >
      <p className="whitespace-pre-line">{description}</p>
    </ModalShell>
  );
}
