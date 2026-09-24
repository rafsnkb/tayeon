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

// Every card in this gallery renders on a white body with no `dark` class, so
// the dark half of the token set is otherwise invisible here. `dark` on a
// wrapper is exactly how the app switches themes (globals.css defines the
// variant as a class, not prefers-color-scheme), and the opaque bg-bg inside
// it stands in for the app background the white page would otherwise show
// through.
export const Dark = () => (
  <div className="dark">
    <div className="w-[380px] bg-bg p-4">
      <TimePassCard pass={longPass} actionLabel="사용하기" onAction={noop} />
    </div>
  </div>
);
