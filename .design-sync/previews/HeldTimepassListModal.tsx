import { HeldTimepassListModal } from "tayeon";

const noop = () => {};
const timePasses = [
  { id: "tp-1", minutes: 30, combo: "tarot" as const },
  { id: "tp-2", minutes: 60, combo: "tarot-saju" as const },
  { id: "tp-3", minutes: 120, combo: "tarot-saju-ziwei" as const },
];

export const Default = () => (
  <HeldTimepassListModal timePasses={timePasses} onSelect={noop} onClose={noop} />
);

export const SinglePass = () => (
  <HeldTimepassListModal timePasses={timePasses.slice(0, 1)} onSelect={noop} onClose={noop} />
);
