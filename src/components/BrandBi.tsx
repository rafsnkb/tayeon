type BrandBiProps = {
  className?: string;
  variant?: "auto" | "dark" | "light";
};

export function BrandBi({ className = "h-7 w-14", variant = "auto" }: BrandBiProps) {
  if (variant === "dark") {
    return <img src="/textures/bi_dark.png" alt="타연" className={`${className} object-contain`} />;
  }

  if (variant === "light") {
    return <img src="/textures/bi_light.png" alt="타연" className={`${className} object-contain`} />;
  }

  return (
    <span className="inline-flex" aria-label="타연">
      <img src="/textures/bi_light.png" alt="타연" className={`${className} object-contain dark:hidden`} />
      <img src="/textures/bi_dark.png" alt="" className={`${className} hidden object-contain dark:block`} />
    </span>
  );
}
