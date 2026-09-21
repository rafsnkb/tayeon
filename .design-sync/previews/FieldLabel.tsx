import { FieldLabel } from "tayeon";

export const Default = () => (
  <div className="flex w-[320px] flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
    <FieldLabel>생년월일</FieldLabel>
    <div className="h-11 rounded-xl border border-border bg-bg" />
  </div>
);

export const Required = () => (
  <div className="flex w-[320px] flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
    <FieldLabel required>태어난 시간</FieldLabel>
    <div className="h-11 rounded-xl border border-border bg-bg" />
  </div>
);
