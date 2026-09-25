import ModalShell, { ModalButton } from "@/components/ModalShell";

/** 저장 완료 같은 단순 안내 + 확인 버튼 하나(취소 없음). 모달 껍데기는 ModalShell 이 갖는다.
 *
 * tone="error"는 결제 실패처럼 잘못된 결과를 알릴 때만 쓴다 — 문구 색만 urgent로 바꾸고
 * 나머지 구조는 그대로 둬서 성공/실패가 같은 자리에 같은 모양으로 뜨도록 한다.
 *
 * 제목 줄을 쓰지 않는 유일한 모달이다: 여기서는 title 로 넘어오는 문장이 곧 본문이라
 * (예: "저장했어요") 위에 또 제목을 얹으면 같은 말이 두 번 나온다. */
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
    <ModalShell onClose={onClose} footer={<ModalButton onClick={onClose}>확인</ModalButton>}>
      <p className={`whitespace-pre-line text-lg font-bold ${tone === "error" ? "text-urgent" : "text-bold-text"}`}>
        {title}
      </p>
    </ModalShell>
  );
}
