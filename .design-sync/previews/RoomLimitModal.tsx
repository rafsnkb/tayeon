import { RoomLimitModal } from "tayeon";

const noop = () => {};

export const Default = () => <RoomLimitModal onConfirm={noop} onClose={noop} />;
export const Busy = () => <RoomLimitModal onConfirm={noop} onClose={noop} busy />;
