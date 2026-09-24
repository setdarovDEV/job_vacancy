# Liquid Glass — material spec for jobvacancy.uz

Liquid Glass here means: a translucent tint + backdrop blur & saturation + a 1px "lens edge" that
catches light at the top-left + a soft specular sheen on the upper part + an inner top highlight,
floating over a colored **aurora** (brand light). The material makes chrome and floating UI feel
physical and premium while content stays solid and readable.

All of it is already implemented as utilities in `references/app.css`:

| Utility | Tint (light / dark) | Blur | Use for | Allowed text |
|---|---|---|---|---|
| `glass-bar` | .74 / .78 | 20px | Site header, sticky full-width filter bar | ink, ink-2 |
| `glass-chrome` | .74 / .78 | 20px | Mobile tab bar, sticky bottom action bar (vacancy Apply, form Save), chat composer dock | ink, ink-2 |
| `glass-panel` | .80 / .80 | 24px | Hero search, stat tiles, popular-search pills, floating filter chips, image captions | ink, ink-2, ink-3 ≥ 14px |
| `glass-sheet` | .88 / .88 | 32px | Dialog, Sheet, Popover, Menu, Select list, Toast, Tooltip, command palette | all |
| `glass-interactive` | hover → .90 | — | add to clickable glass (pills, segmented items, floating buttons) | — |
| `aurora-hero` | — | — | background layer of hero sections (home, employers, auth, company cover fallback) | — |
| `surface-card` (+`-interactive`) | solid | — | ALL content cards/rows/panels | all |

Contrast basis (computed with WCAG formula against worst-case saturated backdrops — deep lapis,
firuza, ink): at .72 tint ink-3 drops to 3.3:1, at .78 it passes 3.8–4.6:1, at .86 ≥ 4.6:1. That is
why chrome forbids ink-3 and panel allows it only for ≥ 14px secondary text. If you need small
muted text on chrome, use ink-2.

## Anatomy (what the utilities draw)

```
┌ ::before  1px gradient ring (edge-hi → edge-lo → edge-hi), masked to the border only
│ background  var(--_glass-tint)  — translucent surface color
│ backdrop    blur(var(--_glass-blur)) saturate(170%)
│ box-shadow  inset 0 1px 0 glass-inner (top highlight), inset 0 -1px 0 edge-shade, elevation
└ ::after   linear-gradient(180deg, glass-sheen, transparent 42%) — specular sheen
```

Consequences:
- A glass element is `position: relative; isolation: isolate` and **owns its ::before/::after**.
  Don't put `before:`/`after:` utilities on it (use a child element instead). Stretched links
  (`after:absolute after:inset-0`) therefore live on solid cards, not glass.
- `overflow: hidden` on a glass element is fine; on its *parent* it may clip the shadow — give the
  parent padding instead.
- Radius comes from the element (`rounded-panel`, `rounded-sheet`, `rounded-pill`); the ring and
  sheen inherit it.

## Where glass goes — screen by screen

- **Header** (`SiteHeader.tsx`): `glass-bar sticky top-0 z-40`. Nav items become pills
  (`rounded-pill px-3.5 py-2`), active item `bg-lapis-soft text-lapis-ink`. Primary CTA pill.
- **Mobile tab bar** (new, `< md`): floating `glass-chrome rounded-sheet fixed inset-x-3 bottom-3
  pb-safe z-40`, 4–5 items (seeker: Search, Saved, Applications, Chat, Profile; employer:
  Vacancies, Candidates, Chat, Company, Profile). Active item `text-lapis-ink` + filled icon.
  Pages get `pb-28 md:pb-0` so content isn't hidden.
- **Hero** (home, employers): `aurora-hero` layer + masked girih pattern; glass pill badge above
  the H1; glass search (`rounded-sheet p-2`); glass pills for popular searches; glass stat tiles.
- **Vacancies list**: desktop sidebar filters are a **solid** `surface-card` (dense form). Mobile:
  a sticky `glass-bar` under the header with "Filters (n)" + sort; filters open in a `glass-sheet`
  bottom sheet. Applied-filter chips are solid `bg-lapis-soft`.
- **Vacancy page**: header card solid; the mobile sticky Apply bar is `glass-chrome pb-safe`;
  apply dialog `glass-sheet`.
- **Company page**: cover image or `aurora-hero` fallback (never a flat `bg-lapis` slab); logo
  tile sits on a `glass-panel` badge overlapping the cover.
- **Dialogs/Sheets/Popovers/Menus/Select/Toast**: `glass-sheet` + overlay `bg-overlay` (dialogs
  and sheets only). Popovers get `shadow-4` via the tier.
- **Account & employer panels**: solid. Only the account sidebar on desktop may be `glass-panel`
  when it floats over the aurora (sticky); the mobile account strip is `glass-bar`.
- **Chat**: bubbles solid (own: `bg-lapis text-on-lapis`, other: `bg-surface border-line`);
  the composer dock is `glass-chrome` pinned to the bottom with `pb-safe`; the thread header is
  `glass-bar`.
- **Kanban**: columns solid `bg-sunken/70 rounded-panel`, cards `surface-card`; the drag ghost may
  be `glass-sheet` for a lifted feel.

## Aurora rules

- The global aurora is `body::before` (fixed, painted once). Keep it subtle: it tints the page and
  gives glass something to refract.
- `aurora-hero` is stronger and only goes behind heroes/cover areas. Never behind paragraphs.
- Don't animate the aurora continuously (battery, GPU). A single fade/slide on load is ok.
- In dark mode the aurora is the main source of glass "life" — check dark screenshots.

## Performance tiers (`html[data-glass]`)

Set **before first paint** by a new inline boot script in `<head>` of `root.tsx`. (There is no
inline theme script today: the theme is rendered on the server from the `jv_theme` cookie, and
`data-theme` is `light`, `dark` or absent for "system".) The script respects an explicit user
choice in the `jv_glass` cookie before falling back to device detection:

```ts
// Glass tier: off for users who ask for less transparency or more contrast; lite on weak devices.
const glassBoot = `(()=>{try{var d=document.documentElement,m=matchMedia,n=navigator;
var c=document.cookie.match(/(?:^|;\\s*)jv_glass=(full|lite|off)/);if(c){d.dataset.glass=c[1];return}
var off=m('(prefers-reduced-transparency: reduce)').matches||m('(prefers-contrast: more)').matches;
var weak=(n.hardwareConcurrency||8)<=4||(n.deviceMemory||8)<=4||(n.connection&&n.connection.saveData);
d.dataset.glass=off?'off':weak?'lite':'full'}catch(e){}})()`;
// <script dangerouslySetInnerHTML={{ __html: glassBoot }} /> in <head>, before styles paint.
```

- SSR renders `data-glass` from the `jv_glass` cookie (default `full`); the script adjusts it
  before paint. Add `suppressHydrationWarning` to `<html>` (new — not present today) so React
  accepts the client-side attribute change.
- Optional user override in Settings → Appearance: "Shaffoflik: To'liq / Yengil / O'chiq",
  persisted in a cookie `jv_glass` read by the root loader (like `jv_theme`).
- `lite`: 12–16px blur, lower saturation, more opaque tints. `off`: solid surfaces, no aurora.

## Budget & measuring

- ≤ 4 simultaneously visible backdrop-filtered layers (header + tab bar + one sheet + one popover).
- Never `backdrop-filter` on elements inside scrolling lists (each row would re-blur on scroll).
- Blur radius ≤ 32px. Large blurred areas (full-screen sheets) use the `sheet` tier only while open.
- Check on a mid Android (Chrome DevTools: CPU 4× slowdown, "Rendering → Frame rendering stats"):
  scrolling the vacancies list with header + tab bar must stay ≥ 55 fps; if not, the device class
  should be `lite`.
- `prod-check.mjs` must pass after the glass migration, with the TZ targets (LCP ≤ 2.0s, CLS ≤ 0.05
  on slow 4G — UI-01 tightens the script's current 2.5s / 0.1).

## Optional: true refraction ("lens") — Chromium only, progressive

Real Liquid Glass bends the backdrop. On Chromium you can add an SVG displacement filter to
**one** hero element (the search bar) when `data-glass="full"` and the UA is Chromium
(`navigator.userAgentData?.brands.some(b => b.brand === "Chromium")`):

```html
<svg width="0" height="0" aria-hidden="true" class="absolute">
  <filter id="jv-lens" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="1" seed="7" result="n" />
    <feGaussianBlur in="n" stdDeviation="2" result="nb" />
    <feDisplacementMap in="SourceGraphic" in2="nb" scale="18" xChannelSelector="R" yChannelSelector="G" />
  </filter>
</svg>
```
```css
:root[data-glass="full"][data-lens] .glass-lens {
  backdrop-filter: url(#jv-lens) blur(var(--blur-panel)) saturate(var(--glass-saturate));
}
```
Only ship this if it measurably doesn't hurt INP/LCP; otherwise skip. Everything else must look
complete without it.

## Review questions for any glass usage

1. Is this element floating or chrome? If it's content → solid card.
2. What is behind it in the worst case (light & dark)? Is every text level on it allowed?
3. Does it still look intentional with `data-glass="off"` (solid) and `lite`?
4. How many blurred layers are visible at once on this screen?
5. Does it have focus-visible, hover, pressed states — and do they stay readable?
