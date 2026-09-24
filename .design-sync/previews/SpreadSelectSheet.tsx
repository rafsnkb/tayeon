import { SpreadSelectSheet } from "tayeon";

const noop = () => {};
const remaining = { one: 12, three: 5, dual: 2, celtic: 0 };

export const Default = () => (
  <SpreadSelectSheet
    spread="three"
    remainingBySpread={remaining}
    timePassActive={false}
    includeCompatibility={false}
    hasPartner
    onSelect={noop}
    onToggleCompatibility={noop}
    onClose={noop}
  />
);

export const TimePassActive = () => (
  <SpreadSelectSheet
    spread="celtic"
    remainingBySpread={remaining}
    timePassActive
    includeCompatibility
    hasPartner
    onSelect={noop}
    onToggleCompatibility={noop}
    onClose={noop}
  />
);

export const NoPartner = () => (
  <SpreadSelectSheet
    spread="one"
    remainingBySpread={remaining}
    timePassActive={false}
    includeCompatibility={false}
    hasPartner={false}
    onSelect={noop}
    onToggleCompatibility={noop}
    onClose={noop}
  />
);
