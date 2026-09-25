"use client";

import { useRouter } from "next/navigation";
import ModalShell, { ModalButton } from "@/components/ModalShell";

/** 자미두수가 포함된 조합(구매/수령)을 골랐는데 태어난 시간이 없거나 "모름"인 경우.
 *  `/charge`(구매)와 `/received-passes`(리워드 수령) 양쪽에서 공용으로 쓴다.
 *
 *  버튼이 하나인 알림형이다 — 예전엔 "닫기"와 "입력하러 가기" 둘이었는데, 닫기는 X 와 같은
 *  일이라 목업 폼으로 오면서 자연스럽게 X 로 흡수됐다. 남는 버튼은 사용자가 실제로 해야 할
 *  일 하나뿐이다.
 *
 *  제목은 부르는 쪽이 정한다. 한동안 "상품 구매 불가"로 박혀 있었는데, 리워드 수령은 돈을
 *  내는 일이 아니라 이미 받은 것을 꺼내는 일이라 그 문장이 사실과 달랐다(2026-09-25). */
export default function NoBirthTimePopup({
  onClose,
  title = "상품 구매 불가",
}: {
  onClose: () => void;
  title?: string;
}) {
  const router = useRouter();
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      footer={<ModalButton onClick={() => router.push("/me/profile")}>태어난 시간 입력하기</ModalButton>}
    >
      <p className="whitespace-pre-line">
        {"자미두수는 태어난 시간이 있어야 계산할 수 있어요.\n내 프로필에서 입력한 뒤 다시 시도해주세요."}
      </p>
    </ModalShell>
  );
}
