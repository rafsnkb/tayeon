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

// Every card in this gallery renders on a white body with no `dark` class, so
// the dark half of the token set is otherwise invisible here. `dark` on a
// wrapper is exactly how the app switches themes (globals.css defines the
// variant as a class, not prefers-color-scheme), and the opaque bg-bg inside
// it stands in for the app background the white page would otherwise show
// through.
export const Dark = () => (
  <div className="dark">
    <div className="w-[380px] bg-bg p-4">
      <Section title="계정">
        <ListRow icon={<PersonIcon className="h-5 w-5" />} label="내 정보" onClick={noop} />
        <ListRow icon={<GearIcon className="h-5 w-5" />} label="설정" onClick={noop} />
      </Section>
    </div>
  </div>
);
