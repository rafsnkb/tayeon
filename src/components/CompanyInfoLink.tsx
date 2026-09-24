"use client";

import { useState } from "react";
import CompanyInfoModal from "./CompanyInfoModal";

/** 사업자 정보를 여는 링크. 놓이는 자리마다 배경이 달라서(대화 화면은 컴포저 아래 --bg,
 * 로그인 화면은 어두운 면) 색은 className으로 받는다. */
export function CompanyInfoLink({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`underline ${className}`}>
        회사 정보
      </button>
      {open && <CompanyInfoModal onClose={() => setOpen(false)} />}
    </>
  );
}

/* 예전엔 여기에 CompanyInfoBar(채팅 하단의 테두리 있는 footer 바)가 함께 있었다.
 * 피그마 Redesign 에 그런 바가 없어 2026-09-23 에 걷어냈고, 대화 화면은 컴포저 아래에
 * CompanyInfoLink 만 둔다(사업자정보 상시 노출은 PG 입점심사 요건이라 링크는 남긴다). */
