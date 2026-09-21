"use client";

import { CloseIcon } from "@/app/(app)/tarot/icons";
import { LoginPanel } from "./LoginPanel";

/** 피그마 "Screen / LoginModal" — 비로그인 상태로 대화 화면을 보다가 로그인이 필요한 행동을
 * 했을 때(입력창에 쓰려고 할 때 등) 화면 위로 뜬다. 뒤의 대화 화면이 그대로 보이는 게 요점이라
 * 딤드 너머로 컴포저와 상단바가 비친다.
 *
 * 목업에서 딤드 바깥을 찍으면 #0a0b0c인데, 다크 배경 #141517 위에 black/50을 얹은 값과 정확히
 * 같다 — 다른 모달들이 쓰는 bg-black/50 그대로다.
 *
 * 닫기 X는 목업에 없지만 넣었다(2026-09-22, 사용자 지시). 로그인할 생각이 없는 사람이
 * 빠져나갈 길이 "카드 바깥 누르기"뿐이면 알아채기 어렵다. 카드 자체(LoginPanel)는 /login
 * 페이지와 공유하므로, X는 여기서 카드 위에 얹는다. */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <LoginPanel />
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-5 top-5 text-icon-muted"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
