"use client";

import { useState } from "react";
import CompanyInfoModal from "./CompanyInfoModal";

/** 사업자 정보를 여는 링크. 놓이는 자리마다 배경이 달라서(채팅 하단 바는 --topbar, 로그인
 * 화면은 어두운 면) 색은 className으로 받는다. */
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

/** 채팅 화면 하단에 항상 노출되는 바. 예전엔 여기에 상호·주소·전화까지 한 줄로 밀어넣고
 * overflow-x-auto로 흘렸는데, 스크롤바까지 숨겨둬서(scrollbar-width:none) 366px 폭에서
 * 605px 중 뒷부분을 읽을 방법이 없었다. 지금은 링크만 두고 내용은 모달이 받는다. */
export function CompanyInfoBar() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-center border-t border-border bg-topbar px-3 text-[10px] text-icon-muted">
      <CompanyInfoLink />
    </footer>
  );
}
