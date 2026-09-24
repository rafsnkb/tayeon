import { SpreadOneIcon } from "tayeon";

// Icons are stroke="currentColor" at their own intrinsic size — colour comes
// from the parent text-* class, so these cells sweep the token palette rather
// than forcing a square box (which would distort the non-square icons).
export const Tones = () => (
  <div className="flex items-center gap-6 rounded-2xl border border-border bg-surface px-6 py-5">
    <SpreadOneIcon className="text-bold-text" />
    <SpreadOneIcon className="text-icon-muted" />
    <SpreadOneIcon className="text-point" />
    <SpreadOneIcon className="text-urgent" />
  </div>
);

export const InContext = () => (
  <div className="flex w-[300px] items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-point-bg text-point">
      <SpreadOneIcon />
    </span>
    <span className="text-sm font-semibold text-bold-text">원카드</span>
  </div>
);
