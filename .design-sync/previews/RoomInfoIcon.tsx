import { RoomInfoIcon } from "tayeon";

// Icons are stroke="currentColor" at their own intrinsic size — colour comes
// from the parent text-* class, so these cells sweep the token palette rather
// than forcing a square box (which would distort the non-square icons).
export const Tones = () => (
  <div className="flex items-center gap-6 rounded-2xl border border-border bg-surface px-6 py-5">
    <RoomInfoIcon className="text-bold-text" />
    <RoomInfoIcon className="text-icon-muted" />
    <RoomInfoIcon className="text-point" />
    <RoomInfoIcon className="text-urgent" />
  </div>
);

export const InContext = () => (
  <div className="flex w-[300px] items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-point-bg text-point">
      <RoomInfoIcon />
    </span>
    <span className="text-sm font-semibold text-bold-text">대화 정보</span>
  </div>
);
