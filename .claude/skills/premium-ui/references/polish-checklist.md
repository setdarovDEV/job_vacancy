# Polish checklist — run before calling any UI task done

Mark each item ✅ verified / ➖ not applicable / ❌ fixed-now. Report unverified items honestly.

## Tokens & consistency
- [ ] No hex/rgb/hsl, `text-white`, `bg-black`, `dark:` in changed files (hook enforces)
- [ ] Only scale font sizes (`text-2xs…5xl`), no `text-[…]`; headings use the recipe from pages.md
- [ ] Radii only `rounded-control|panel|sheet|pill|full`; shadows only `shadow-1..4|ring|pop`
- [ ] Spacing follows page grammar (page padding, section gaps, card padding sm/md/lg)
- [ ] No duplicated pattern — reused/extracted shared component instead
- [ ] Numbers/money/counts use `num` + `groupDigits`/`money`/`salary` with the active locale

## Material
- [ ] Glass only on chrome/floating layers; content on solid `surface-card`
- [ ] Text levels allowed for the glass tier (chrome: ink/ink-2; panel: ink-3 ≥ 14px)
- [ ] Looks intentional with `data-glass="lite"` and `data-glass="off"`
- [ ] ≤ 4 blurred layers visible at once; no blur inside scrolling lists
- [ ] No `before:`/`after:` utilities on glass elements

## States
- [ ] Loading skeleton shaped like the content (no layout shift on arrival)
- [ ] Empty state with reason + action (and a distinct "no results for filters" variant)
- [ ] Error state with retry (not "empty", not endless skeleton); offline handled
- [ ] Stale/refetch keeps old data visible with `aria-busy`
- [ ] Every control: hover, focus-visible, active, disabled, loading where async

## Responsive
- [ ] 360 / 390 / 768 / 1024 / 1280 / 1440 checked; no horizontal scroll
- [ ] Grid tracks `minmax(0,1fr)`; text children `min-w-0`; long words `break-words`
- [ ] Touch targets ≥ 44px; nothing hover-only; long-press/context alternatives exist
- [ ] Fixed/sticky bottom UI uses `pb-safe`; toasts don't cover the sticky bar / tab bar
- [ ] Mobile keyboard doesn't hide the focused input (chat composer, forms)

## Accessibility
- [ ] Semantic landmarks/headings in order (one H1)
- [ ] All inputs labelled (`Field`), errors linked via `aria-describedby`, `role="alert"`
- [ ] Icon-only buttons have `label`; images have meaningful `alt` or `alt=""` when decorative
- [ ] Focus visible everywhere; dialogs trap & return focus; Esc closes overlays
- [ ] Keyboard path for every pointer interaction (drag & drop, swipe, long-press)
- [ ] Async results announced (`aria-live="polite"`); status not by color alone
- [ ] Contrast: text ≥ 4.5:1 (large ≥ 3:1), UI boundaries ≥ 3:1 — light AND dark
- [ ] reduced-motion / reduced-transparency / more-contrast behave

## i18n
- [ ] Every new string in uz, uz-Cyrl, ru, en (`node --experimental-strip-types test/i18n-keys.mjs`)
- [ ] Plurals use `_one/_few/_many/_other`; no string concatenation of translated fragments
- [ ] Layout survives the longest locale (ru/uz-Cyrl are ~20–30% longer than en)

## Performance
- [ ] `pnpm build` passes; core bundle ≤ 120 KB gzip, home JS+CSS ≤ 150 KB
- [ ] New heavy UI is `lazy()` and mounted only when needed
- [ ] Images have width/height (or aspect-ratio), `loading="lazy"` below the fold, `decoding="async"`
- [ ] Links to likely next pages use `prefetch="intent"`
- [ ] Only transform/opacity animated; no layout thrash in scroll handlers (passive listeners)

## SEO (public pages)
- [ ] `meta` title/description via `seo()` in all locales, canonical + hreflang
- [ ] JSON-LD where relevant (JobPosting, Organization, BreadcrumbList, WebSite SearchAction)
- [ ] SSR HTML contains the main content (not only skeletons)

## Verification commands
```bash
cd web
pnpm typecheck && pnpm build
node --experimental-strip-types --no-warnings test/i18n-keys.mjs
# with dev server + API + demo seed running:
node test/browser-smoke.mjs && node test/shots-c.mjs      # public
node test/shots-d.mjs && node test/shots-e.mjs            # seeker / employer
```
