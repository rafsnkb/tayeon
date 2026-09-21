import { TimePassCard } from "tayeon";

const noop = () => {};
const pass = { id: "tp-1", minutes: 30, combo: "tarot-saju" as const };
const longPass = { id: "tp-2", minutes: 120, combo: "tarot-saju-ziwei" as const };

export const Default = () => (
  <div className="w-[380px] bg-bg p-4">
    <TimePassCard pass={pass} />
  </div>
);

export const WithAction = () => (
  <div className="w-[380px] bg-bg p-4">
    <TimePassCard pass={longPass} actionLabel="사용하기" onAction={noop} />
  </div>
);

export const Busy = () => (
  <div className="w-[380px] bg-bg p-4">
    <TimePassCard pass={longPass} actionLabel="사용하기" onAction={noop} busy />
  </div>
);
