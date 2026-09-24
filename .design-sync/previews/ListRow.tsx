import { ListRow, PersonIcon, GearIcon, LogoutDoorIcon, TicketIcon } from "tayeon";

const noop = () => {};

export const Default = () => (
  <div className="w-[360px] rounded-2xl border border-border bg-surface">
    <ListRow icon={<PersonIcon className="h-5 w-5" />} label="내 정보" onClick={noop} />
  </div>
);

export const Stacked = () => (
  <div className="w-[360px] divide-y divide-border rounded-2xl border border-border bg-surface">
    <ListRow icon={<PersonIcon className="h-5 w-5" />} label="내 정보" onClick={noop} />
    <ListRow icon={<TicketIcon className="h-5 w-5" />} label="보유 이용권" onClick={noop} />
    <ListRow icon={<GearIcon className="h-5 w-5" />} label="설정" onClick={noop} />
  </div>
);

export const Danger = () => (
  <div className="w-[360px] rounded-2xl border border-border bg-surface">
    <ListRow icon={<LogoutDoorIcon className="h-5 w-5" />} label="로그아웃" danger onClick={noop} />
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
    <div className="w-[360px] divide-y divide-border rounded-2xl border border-border bg-surface">
      <ListRow icon={<PersonIcon className="h-5 w-5" />} label="내 정보" onClick={noop} />
      <ListRow icon={<TicketIcon className="h-5 w-5" />} label="보유 이용권" onClick={noop} />
      <ListRow icon={<LogoutDoorIcon className="h-5 w-5" />} label="로그아웃" danger onClick={noop} />
    </div>
  </div>
);
