import { PolicyModal } from "tayeon";

const noop = () => {};

export const Terms = () => <PolicyModal policy="terms" onClose={noop} />;
export const Privacy = () => <PolicyModal policy="privacy" onClose={noop} />;
