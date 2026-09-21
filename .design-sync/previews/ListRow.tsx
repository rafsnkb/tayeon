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
