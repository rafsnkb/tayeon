// Builds the stylesheet the DS bundle ships (cfg.cssEntry).
//
// Three things the converter can't do itself:
//
//  1. Tayeon styles with Tailwind v4, so globals.css is a SOURCE file — the
//     utilities only exist after the Tailwind compiler scans the app.
//
//  2. Tailwind only emits utilities it SEES used. Scanning src/ alone ships
//     just the subset the app happens to use today, so a design agent writing
//     a perfectly valid `bg-bg` or `headlineLarge` would get no CSS at all.
//     The safelist below forces the whole semantic-token surface to exist, in
//     every prefix and the variants components actually use.
//
//  3. The brand font (Pretendard) is loaded by next/font at runtime, which
//     sets --font-pretendard. Nothing sets it outside the Next app, so every
//     preview — and every design built with this DS — would fall back to a
//     system sans. The @font-face block is what ships the real font.
//
// Run: node .design-sync/make-css.mjs
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";

const DIR = ".design-sync/compiled";
const OUT = `${DIR}/tayeon.css`;
mkdirSync(DIR, { recursive: true });

// Keep in sync with the @theme inline block in src/app/globals.css.
const TOKENS = [
  "bg", "surface", "border", "bold-text", "text", "point", "point-strong",
  "point-muted", "point-bg", "cta-fill", "cta-text", "urgent", "urgent-text",
  "success", "success-text", "warning", "warning-text", "accent", "topbar",
  "chip-fill", "icon-muted", "chip-muted-text", "placeholder", "point-text",
  "gold",
];
const PREFIXES = ["bg", "text", "border", "fill", "divide"];
const VARIANTS = ["", "hover:", "disabled:", "focus:", "lg:"];
const TYPE = ["headline", "title", "body", "label"].flatMap((f) =>
  ["Large", "Medium", "Small"].map((s) => f + s),
);

const safelist = [
  ...PREFIXES.flatMap((p) => TOKENS.flatMap((t) => VARIANTS.map((v) => `${v}${p}-${t}`))),
  ...TYPE,
  "animate-fade-in",
].join("\n");
writeFileSync(`${DIR}/safelist.txt`, safelist + "\n");

// Wrapper entry: the app's real stylesheet plus explicit sources, since
// automatic content detection is relative to the CSS file's own location.
writeFileSync(
  `${DIR}/entry.css`,
  `@import "../../src/app/globals.css";\n@source "../../src";\n@source "./safelist.txt";\n`,
);

execFileSync(
  process.execPath,
  [".ds-sync/node_modules/@tailwindcss/cli/dist/index.mjs", "-i", `${DIR}/entry.css`, "-o", OUT, "--minify"],
  { stdio: "inherit" },
);

// url()s point at the REAL font files relative to this stylesheet, so the
// converter can resolve and rewrite them into the bundle's fonts/ dir.
appendFileSync(
  OUT,
  `
@font-face{font-family:"Pretendard";src:url("../../asset/font/Pretendard-SemiBold.otf") format("opentype");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"Pretendard";src:url("../../asset/font/Pretendard-Bold.otf") format("opentype");font-weight:700;font-style:normal;font-display:swap}
:root{--font-pretendard:"Pretendard",system-ui,-apple-system,"Segoe UI",sans-serif}
`,
);
console.log("wrote", OUT);
