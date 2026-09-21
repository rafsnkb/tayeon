import { CompanyInfoBar } from "tayeon";

export const Default = () => (
  <div className="w-[420px] bg-bg p-4">
    <CompanyInfoBar />
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
    <div className="w-[420px] bg-bg p-4">
      <CompanyInfoBar />
    </div>
  </div>
);
