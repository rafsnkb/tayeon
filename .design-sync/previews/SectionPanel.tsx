import { SectionPanel } from "tayeon";

export const Default = () => (
  <div className="w-[380px] bg-bg p-4">
    <SectionPanel title="알림">
      <p className="text-sm font-semibold text-icon-muted">새 리딩이 끝나면 알려드려요.</p>
    </SectionPanel>
  </div>
);

export const WithRows = () => (
  <div className="w-[380px] bg-bg p-4">
    <SectionPanel title="화면">
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-semibold text-bold-text">다크 모드</span>
        <span className="text-sm font-semibold text-icon-muted">시스템 설정</span>
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-semibold text-bold-text">글자 크기</span>
        <span className="text-sm font-semibold text-icon-muted">보통</span>
      </div>
    </SectionPanel>
  </div>
);
