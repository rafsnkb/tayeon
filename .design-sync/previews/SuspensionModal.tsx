import { SuspensionModal } from "tayeon";

const noop = () => {};

export const WithReason = () => (
  <SuspensionModal
    info={{ reason: "이용약관 위반 신고가 접수되었습니다.", suspendedUntil: "2026-10-01T00:00:00.000Z" }}
    onClose={noop}
  />
);

export const NoReason = () => (
  <SuspensionModal info={{ reason: null, suspendedUntil: null }} onClose={noop} />
);
