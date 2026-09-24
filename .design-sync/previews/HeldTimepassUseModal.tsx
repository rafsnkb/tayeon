import { HeldTimepassUseModal } from "tayeon";

const noop = () => {};
const pass = { id: "tp-2", minutes: 60, combo: "tarot-saju" as const };

export const Default = () => (
  <HeldTimepassUseModal pass={pass} busy={false} onConfirm={noop} onClose={noop} />
);

export const Busy = () => (
  <HeldTimepassUseModal pass={pass} busy onConfirm={noop} onClose={noop} />
);
