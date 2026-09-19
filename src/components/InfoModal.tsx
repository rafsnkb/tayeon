/** 저장 완료 같은 단순 안내 + 확인 버튼 하나만 있는 모달(취소 없음). ConfirmModal과 같은
 * 시각 언어(rounded-[28px] border-border bg-topbar)를 쓰되, 되돌릴 액션이 없으니 닫기 버튼은
 * "확인" 하나만 둔다. */
export default function InfoModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-7 text-center text-lg font-bold text-bold-text">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-12 w-full rounded-2xl bg-point text-base font-semibold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
