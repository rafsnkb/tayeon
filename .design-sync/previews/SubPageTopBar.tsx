import { SubPageTopBar } from "tayeon";

const noop = () => {};

export const Default = () => (
  <div className="w-[420px] bg-bg pb-10">
    <SubPageTopBar title="설정" onBack={noop} />
  </div>
);

export const LongTitle = () => (
  <div className="w-[420px] bg-bg pb-10">
    <SubPageTopBar title="구매 내역 및 영수증" onBack={noop} />
  </div>
);
