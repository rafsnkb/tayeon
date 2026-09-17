"use client";

import SubPageTopBar from "@/components/SubPageTopBar";

/** 피그마 "Screen / PurchaseHistory" — 실제 결제(포트원) 연동 전이라 보여줄 데이터가 없음.
 * 가짜 내역을 지어내는 대신 정직하게 빈 상태만 보여줌. 결제 연동되면 이 자리에 실제 내역 API를
 * 연결하면 됨. */
export default function PurchaseHistoryPage() {
  return (
    <div className="flex min-h-dvh flex-col overflow-visible bg-bg xl:h-full xl:overflow-hidden">
      <SubPageTopBar title="결제 내역" />
      <div className="flex flex-1 items-center justify-center p-4 pt-20">
        <p className="text-center text-sm text-icon-muted">
          아직 결제 내역이 없어요.
          <br />
          이용권을 구입하면 여기에 표시돼요.
        </p>
      </div>
    </div>
  );
}
