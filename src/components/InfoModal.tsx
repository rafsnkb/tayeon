/** 저장 완료 같은 단순 안내 + 확인 버튼 하나만 있는 모달(취소 없음). ConfirmModal과 같은
 * 시각 언어(rounded-[28px] border-border bg-topbar)를 쓰되, 되돌릴 액션이 없으니 닫기 버튼은
 * "확인" 하나만 둔다.
 *
 * tone="error"는 결제 실패처럼 잘못된 결과를 알릴 때만 쓴다 — 문구 색만 urgent로 바꾸고
 * 나머지 구조는 그대로 둬서 성공/실패가 같은 자리에 같은 모양으로 뜨도록 한다. */
export default function InfoModal({
  title,
  tone = "info",
  onClose,
}: {
  title: string;
  tone?: "info" | "error";
  onClose: () => void;
}) {
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
        <p
          className={`mb-7 whitespace-pre-line text-center text-lg font-bold ${
            tone === "error" ? "text-urgent" : "text-bold-text"
          }`}
        >
          {title}
        </p>
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
