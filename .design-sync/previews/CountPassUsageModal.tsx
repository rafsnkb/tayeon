import { CountPassUsageModal } from "tayeon";

const noop = () => {};
const pass = {
  id: "cp-1",
  productId: "count-10",
  source: "purchase" as const,
  createdAt: "2026-09-01T09:00:00.000Z",
  basis: 10,
  remaining: 6,
  expiresAt: "2027-09-01T09:00:00.000Z",
  combo: "tarot-saju" as const,
  allowances: { one: 6, three: 4, dual: 2, celtic: 1 },
  status: "active" as const,
};

export const Active = () => <CountPassUsageModal pass={pass} onClose={noop} />;

export const Exhausted = () => (
  <CountPassUsageModal
    pass={{ ...pass, remaining: 0, status: "exhausted" as const, allowances: { one: 0, three: 0, dual: 0, celtic: 0 } }}
    onClose={noop}
  />
);
