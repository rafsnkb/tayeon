# Building with the Tayeon design system

Tayeon (타연) is a Korean AI tarot / saju / ziwei consultation app. Its UI is
mobile-first: most components assume a phone-width column, and copy is Korean.
Write Korean UI text when composing screens with these components.

## Wrap the tree in `DsPreviewProvider`

These components come from a Next.js app, so many of them read Next's client
router (`useRouter`, `usePathname`) or the app's rooms context. Rendered
without a provider they throw — `invariant expected app router to be mounted`
or `useRooms must be used within RoomsProvider` — and paint nothing.

`DsPreviewProvider` is exported from the bundle and supplies inert versions of
both. Wrap once at the root:

```jsx
const { DsPreviewProvider, SubPageTopBar, Section, ListRow, GearIcon } = window.Tayeon;

<DsPreviewProvider>
  <div className="min-h-screen bg-bg">
    <SubPageTopBar title="설정" onBack={() => {}} />
    <div className="mx-auto w-full max-w-[420px] p-4">
      <Section title="계정">
        <ListRow icon={<GearIcon className="h-5 w-5" />} label="설정" onClick={() => {}} />
      </Section>
    </div>
  </div>
</DsPreviewProvider>
```

Components needing it: `SubPageTopBar`, `SupportCenter`, `NoBirthTimePopup`,
`AppShell`. Wrapping everything is harmless, so just always wrap.

## Styling idiom: Tailwind utilities bound to semantic tokens

This is Tailwind v4. **Never use raw palette utilities** (`bg-white`,
`text-gray-500`, `bg-pink-500`) — every colour is a semantic token, and the
tokens are what make light and dark mode work. Use these families:

| Family | Tokens |
|---|---|
| Surfaces | `bg-bg` (app background), `bg-surface` (card), `bg-topbar` (bar / modal body), `bg-chip-fill` |
| Text | `text-bold-text` (primary), `text-text` (secondary), `text-icon-muted` (labels/icons), `text-placeholder` (weak text on a LIGHT surface), `text-chip-muted-text` (weak text on `bg-chip-fill`) |
| Brand | `bg-point` (핑크 #ff007f, fills only), `text-point-text` (pink AS TEXT), `bg-point-bg` (tinted wash), `point-strong`, `point-muted`, `accent`, `gold` |
| Action | `bg-cta-fill` / `text-cta-text` (primary CTA) |
| Status | `urgent` (destructive/error), `success`, `warning` — each with a `-text` pair, e.g. `bg-urgent text-urgent-text` |
| Lines | `border-border` |

Each works with every Tailwind prefix: `bg-`, `text-`, `border-`, `fill-`,
`divide-`, plus variants (`hover:`, `disabled:`, `lg:`).

Two of those need care, because a token that reads well on one surface is
invisible on another:

- `bg-chip-fill` is a DARK face in both themes — light mode's is deep purple,
  not a pale grey. Text on it is `text-white` (or `text-chip-muted-text` when
  it should read as disabled). `text-placeholder` on a chip is unreadable.
- `point` at #ff007f only clears contrast as a fill. As body-size text on the
  light background it lands at 3.47, so use `text-point-text`, which resolves
  to a deeper pink in light mode and a brighter one in dark.

The `TokenSpecimen` card shows every token in both themes side by side, with
the measured ratio for each combination the app ships. Check it before
inventing a colour pairing.

**Dark mode** is a `.dark` class on an ancestor (not `prefers-color-scheme`).
Every token above already has a dark value, so correct token use needs no
`dark:` variants at all. Reach for `dark:` only to swap an asset.

**Typography** has named utilities — use them instead of ad-hoc `text-[13px]`:
`headlineLarge|Medium|Small`, `titleLarge|Medium|Small`,
`bodyLarge|Medium|Small`, `labelLarge|Medium|Small`. Plain Tailwind sizes
(`text-sm font-semibold`) are also used throughout the components themselves,
so both are idiomatic.

Only two font weights ship: **600 (SemiBold)** and **700 (Bold)** — Pretendard.
`font-normal` has no matching file and renders synthetically; prefer
`font-semibold` / `font-bold`. There is also `animate-fade-in` for entrances.

## Shapes and static assets

Rounded shapes are large: cards/sheets use `rounded-[28px]`, buttons
`rounded-2xl`, inner rows `rounded-xl`. Modals are full-screen overlays —
`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4` wrapping
a `max-w-sm` card — so render at most one at a time.

Images are served from the DS root: `/textures/bi_light.png` and
`/textures/bi_dark.png` (the 타연 wordmark, behind `BrandBi`). Pass cards
carry their own artwork under `/pass/` — one image per product. Reference them
by those absolute paths.

## Where the truth lives

- `_ds/<folder>/styles.css` → imports `fonts/fonts.css` (Pretendard `@font-face`)
  and `_ds_bundle.css` (all tokens + compiled utilities). Read `_ds_bundle.css`
  to confirm a token or utility exists before inventing one.
- `components/<group>/<Name>/<Name>.d.ts` is the real prop contract, and
  `<Name>.prompt.md` shows usage. Groups: `general` (shared), `tarot` (reading
  screens + the full icon set), `me`, `settings`, `signup`, `app`.
- Icons are `stroke="currentColor"` at their own intrinsic size — colour them
  with a `text-*` token on the icon or its parent, and size with `h-*`/`w-*`.

## Known gaps

`CardImage`, `CelticCrossLayout` and `DualPathLayout` load card art from the
app's `/api/tarot/cards/:id` endpoint, so they render blank without a running
backend. `ReadingLoadingMessage` animates in. `ModalViewportChrome` renders no
UI (it syncs the iOS theme-color meta). These ship with a plain card, not a
preview — they still work when the app is running.
