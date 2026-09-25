"use client";

import ModalShell, { ModalButton } from "@/components/ModalShell";
import { formatDateTime } from "@/lib/util/formatDate";

export type SuspensionInfo = { reason: string | null; suspendedUntil: string | null };

/** 서버가 403과 함께 내려주는 { code: "SUSPENDED", reason, suspendedUntil }를 파싱한다.
 * 정지 관련 API(리딩/결제 준비/보상 수령/시간제 활성화) 응답 처리에서 공용으로 쓴다. */
export function parseSuspensionError(body: unknown): SuspensionInfo | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { code?: unknown; reason?: unknown; suspendedUntil?: unknown };
  if (b.code !== "SUSPENDED") return null;
  return {
    reason: typeof b.reason === "string" ? b.reason : null,
    suspendedUntil: typeof b.suspendedUntil === "string" ? b.suspendedUntil : null,
  };
}

/** 정지 중 사용자가 리딩/결제/보상수령/시간제 활성화를 시도했을 때. 사용자가 지금 할 수 있는
 *  일이 없는 순수 알림형이라 버튼은 "확인" 하나다. */
export default function SuspensionModal({ info, onClose }: { info: SuspensionInfo; onClose: () => void }) {
  return (
    <ModalShell title="이용 불가" onClose={onClose} footer={<ModalButton onClick={onClose}>확인</ModalButton>}>
      <p>이용 정지 기간에는 해당 기능을 사용할 수 없습니다.</p>
      {/* 사유와 종료일은 사용자가 문의할 때 그대로 읽어 전달하는 값이라, 본문 색(약한 회색)이
          아니라 제목 색으로 한 단계 올려 둔다. */}
      <div className="mt-5 flex flex-col gap-4">
        <div>
          <p>이용 정지 사유</p>
          <p className="mt-1 text-base font-bold text-bold-text">{info.reason ?? "약관 위반"}</p>
        </div>
        <div>
          <p>이용 정지 종료일</p>
          <p className="mt-1 text-base font-bold text-bold-text">
            {info.suspendedUntil ? formatDateTime(info.suspendedUntil) : "영구"}
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
