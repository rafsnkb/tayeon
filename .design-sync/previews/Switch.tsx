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

// Every card in this gallery renders on a white body with no `dark` class, so
// the dark half of the token set is otherwise invisible here. `dark` on a
// wrapper is exactly how the app switches themes (globals.css defines the
// variant as a class, not prefers-color-scheme), and the opaque bg-bg inside
// it stands in for the app background the white page would otherwise show
// through.
export const Dark = () => (
  <div className="dark">
    <div className="flex gap-4 rounded-2xl border border-border bg-surface p-6">
      <Switch checked={false} onChange={noop} />
      <Switch checked onChange={noop} />
      <Switch checked disabled onChange={noop} />
    </div>
  </div>
);
