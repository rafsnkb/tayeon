# design-sync notes — tayeon

Repo-specific gotchas for future syncs. Read this before re-running.

## This repo is a Next.js app, not a DS package

There is no `dist/`, no package `exports`, and no Storybook. The DS surface is
defined by hand in **`.design-sync/entry.tsx`** — a barrel that re-exports the
components we sync. Add or remove a component there AND in
`cfg.componentSrcMap`; the two must agree.

- The barrel must use **relative** specifiers (`../src/...`), never the `@/`
  alias. The prop extractor (ts-morph) is built without `compilerOptions.paths`,
  so `@/` re-exports resolve to nothing and every component ends up with an
  empty `{[key: string]: unknown}` props body.
- `--entry ./.design-sync/entry.tsx` is required. Without it the converter
  looks for `node_modules/tayeon` and dies. Do **not** fix that by symlinking
  the repo into its own `node_modules` — the resulting cycle makes the `.d.ts`
  glob walk forever and node OOMs at ~4 GB.

## Page-local components are exported in place

21 components live inside `page.tsx` / `layout.tsx` files and were made
reachable by adding `export` to their declarations (no file moves). Verified
safe: Next 16's generated `.next/types/validator.ts` constrains page modules
with `Specific extends AppPageConfig<...>`, which permits extra named exports.
`npx tsc --noEmit` is the check — it exercises that validator.

`src/lib/tarot/RoomsContext.tsx` also exports `RoomsContext` now, purely so
previews can supply a mock instead of running the real Firebase-backed
provider.

## Build order (cfg.buildCmd covers the first two)

1. `node .design-sync/make-css.mjs` — Tailwind v4 compile + safelist + fonts.
2. `npx tsc -p .design-sync/tsconfig.types.json` — emits `.design-sync/types/`,
   the declaration tree prop extraction reads. **Stale types = stale props**,
   so re-run whenever component props change.
3. `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ./node_modules --entry ./.design-sync/entry.tsx --out ./ds-bundle`
4. `node .design-sync/copy-assets.mjs` — **must run after every build**; the
   converter clears `--out` and this puts `public/textures/` back at the
   bundle root.

`package.json` carries `"types": ".design-sync/types/index.d.ts"` solely for
this pipeline (the package is private and unpublished). `.design-sync/types/`
is generated and gitignored.

## Why the CSS is built, not copied

Tailwind v4 means `src/app/globals.css` is a *source* file, and Tailwind emits
only utilities it sees used. Shipping a scan of `src/` alone gave a stylesheet
where `bg-bg`, `bg-urgent`, `headlineLarge` and friends simply did not exist —
a design agent using a valid token would get silently unstyled output. The
safelist in `make-css.mjs` forces the full token surface (23 tokens × 5
prefixes × 5 variants + the 12 typography utilities). **Keep the TOKENS list in
sync with the `@theme inline` block in `globals.css`.**

The brand font is loaded by `next/font/local` at runtime, so nothing defines
`--font-pretendard` outside the Next app. `make-css.mjs` appends the
`@font-face` rules and the variable; `cfg.extraFonts` ships the two `.otf`s.

## Browser shim

`.design-sync/preview-env.ts` defines `globalThis.process` before anything
else the barrel imports. Without it every component fails with
`ReferenceError: process is not defined` — Next's `__NEXT_*` flags and the
Firebase config are read at module scope. **Values there are placeholders on
purpose; never put real credentials in that file** — the bundle is uploaded.

## Provider

`cfg.provider` is `DsPreviewProvider` (`.design-sync/preview-provider.tsx`),
exported from the barrel and excluded from the component list via
`componentSrcMap: {"DsPreviewProvider": null}`. It supplies Next's
`AppRouterContext` / `PathnameContext` / `SearchParamsContext` plus a static
`RoomsContext` value.

## Known render warns

None outstanding — the last validate run exited clean with zero warnings.
Overlay components each carry `cfg.overrides.<Name> = {cardMode: "single",
viewport: ...}`; without it a `fixed inset-0` modal escapes its grid cell and
trips `[GRID_OVERFLOW]`. `ListRow` uses `cardMode: "column"`, and
`SubPageTopBar` is `single` because it is a fixed viewport overlay.

## Deliberate floor cards (6)

Not failures — these cannot render meaningfully offline:

- `CardImage`, `CelticCrossLayout`, `DualPathLayout` — card art comes from the
  app's `/api/tarot/cards/:id` endpoint, and `CardImage` hides itself `onError`.
- `ReadingLoadingMessage` — typewriter animation; captures at frame 0 as a
  single character.
- `ModalViewportChrome` — renders no UI at all (syncs the iOS theme-color meta).
- `AppShell` — renders only its collapsed sidebar rail in an isolated frame.

## Findings worth acting on (outside sync scope)

- `FieldLabel` is **triplicated byte-for-byte** across
  `signup/page.tsx`, `compatibility/page.tsx` and `me/profile/page.tsx`. Only
  the signup copy is synced. Worth deduping into `src/components/`.
- `ComingSoon` in `me/page.tsx` is **not a component** — it is a click handler
  that calls `alert()`. It is excluded via `componentSrcMap`. Renaming it (e.g.
  `showComingSoon`) would stop it reading as a component.

## Re-sync risks

- **`.design-sync/entry.tsx` and `componentSrcMap` drift.** Neither is derived;
  a component added to `src/` appears in neither until someone edits both. A
  component *deleted* from `src/` breaks the build at the barrel.
- **Stale `.design-sync/types/`.** Gitignored, so a fresh clone has none — step
  2 above is mandatory, not optional. Skipping it silently degrades every
  prop contract to `unknown`.
- **Safelist vs. token drift.** New tokens in `globals.css` will not ship as
  utilities until added to `TOKENS` in `make-css.mjs`.
- **Page-local exports are load-bearing.** Anyone refactoring `tarot/page.tsx`
  may drop an `export` and break the barrel. The build fails loudly, which is
  the intended safety net.
- **Preview data is inlined** in `.design-sync/previews/*.tsx` (pass combos,
  spread keys, FAQ copy). If `SPREADS`, `COMBOS` or the pass types change, the
  previews still compile but may depict a product that no longer exists.
- **Toolchain assumptions:** playwright 1.63.0 (pins the cached chromium 1243)
  and the Tailwind CLI installed into `.ds-sync/`, not the repo lockfile.
