import { RenameRoomModal } from "tayeon";

const noop = () => {};

export const Default = () => (
  <RenameRoomModal initialTitle="이직 고민 상담" busy={false} onConfirm={noop} onClose={noop} />
);

export const Busy = () => (
  <RenameRoomModal initialTitle="이직 고민 상담" busy onConfirm={noop} onClose={noop} />
);
