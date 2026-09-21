import { BrandBi } from "tayeon";

// The wordmark ships as /textures/bi_{light,dark}.png. `auto` swaps the two
// on the `dark` class; the explicit variants are for surfaces that don't
// follow the theme (a dark hero band in light mode, and vice versa).
export const Auto = () => (
  <div className="flex w-[320px] items-center justify-center rounded-2xl border border-border bg-surface py-10">
    <BrandBi className="h-10 w-20" />
  </div>
);

export const OnDarkSurface = () => (
  <div className="flex w-[320px] items-center justify-center rounded-2xl bg-[#141517] py-10">
    <BrandBi variant="light" className="h-10 w-20" />
  </div>
);

export const OnLightSurface = () => (
  <div className="flex w-[320px] items-center justify-center rounded-2xl bg-[#f7f4fb] py-10">
    <BrandBi variant="dark" className="h-10 w-20" />
  </div>
);
