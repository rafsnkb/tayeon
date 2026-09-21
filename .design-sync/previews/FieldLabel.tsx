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

// Every card in this gallery renders on a white body with no `dark` class, so
// the dark half of the token set is otherwise invisible here. `dark` on a
// wrapper is exactly how the app switches themes (globals.css defines the
// variant as a class, not prefers-color-scheme), and the opaque bg-bg inside
// it stands in for the app background the white page would otherwise show
// through.
export const Dark = () => (
  <div className="dark">
    <div className="flex w-[320px] flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
      <FieldLabel required>태어난 시간</FieldLabel>
      <div className="h-11 rounded-xl border border-border bg-bg" />
    </div>
  </div>
);
