"use client";

import { LoginPanel } from "./LoginPanel";

/** 피그마 "Screen / LoginModal" — 비로그인 상태로 대화 화면을 보다가 로그인이 필요한 행동을
 * 했을 때(입력창에 쓰려고 할 때 등) 화면 위로 뜬다. 뒤의 대화 화면이 그대로 보이는 게 요점이라
 * 딤드 너머로 컴포저와 상단바가 비친다.
 *
 * 목업에서 딤드 바깥을 찍으면 #0a0b0c인데, 다크 배경 #141517 위에 black/50을 얹은 값과 정확히
 * 같다 — 다른 모달들이 쓰는 bg-black/50 그대로다. */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      data-modal-overlay="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <LoginPanel />
      </div>
    </div>
  );
}
