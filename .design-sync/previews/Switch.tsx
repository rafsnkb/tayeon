import { Switch } from "tayeon";

const noop = () => {};

export const Off = () => (
  <div className="rounded-2xl border border-border bg-surface p-6">
    <Switch checked={false} onChange={noop} />
  </div>
);

export const On = () => (
  <div className="rounded-2xl border border-border bg-surface p-6">
    <Switch checked onChange={noop} />
  </div>
);

export const Disabled = () => (
  <div className="flex gap-4 rounded-2xl border border-border bg-surface p-6">
    <Switch checked={false} disabled onChange={noop} />
    <Switch checked disabled onChange={noop} />
  </div>
);
