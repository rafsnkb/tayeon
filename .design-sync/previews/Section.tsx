import { Section, ListRow, PersonIcon, GearIcon } from "tayeon";

const noop = () => {};

export const Default = () => (
  <div className="w-[380px] bg-bg p-4">
    <Section title="계정">
      <ListRow icon={<PersonIcon className="h-5 w-5" />} label="내 정보" onClick={noop} />
      <ListRow icon={<GearIcon className="h-5 w-5" />} label="설정" onClick={noop} />
    </Section>
  </div>
);
