import { PurchaseTicketModal } from "tayeon";
const noop = () => {};
export const Default = () => (
  <PurchaseTicketModal onClose={noop} onInvite={noop} onPurchase={noop} />
);
