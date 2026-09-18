"use client";

import { CloseIcon } from "@/app/(app)/tarot/icons";

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

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 피그마 "SuspensionPopup" — 정지 중 사용자가 리딩/결제/보상수령/시간제 활성화를 시도했을 때. */
export default function SuspensionModal({ info, onClose }: { info: SuspensionInfo; onClose: () => void }) {
  return (
    <div data-modal-overlay="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[28px] border border-border bg-topbar p-5 pt-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="w-5" />
          <p className="flex-1 text-center text-lg font-bold text-bold-text">이용 불가</p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-bold-text">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-6 text-center text-sm font-semibold text-icon-muted">
          이용 정지 기간에는 해당 기능을 사용할 수 없습니다.
        </p>
        <div className="mb-7 flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="text-sm text-icon-muted">이용 정지 사유</p>
            <p className="mt-1 text-base font-bold text-bold-text">{info.reason ?? "약관 위반"}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-icon-muted">이용 정지 종료일</p>
            <p className="mt-1 text-base font-bold text-bold-text">
              {info.suspendedUntil ? formatDateTime(info.suspendedUntil) : "영구"}
            </p>
          </div>
        </div>
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
