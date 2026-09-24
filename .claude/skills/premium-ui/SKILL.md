---
name: premium-ui
description: Samarkand Glass design system for jobvacancy.uz (React Router 8 + Tailwind v4). Use for ANY change to web/app — pages, components, styles, layout, dark mode, mobile, animation, loading/empty/error states — so every screen reaches premium Liquid Glass quality with consistent tokens.
---

# Samarkand Glass — premium UI for jobvacancy.uz

You are working on `web/` of jobvacancy.uz: React 19, React Router 8 framework mode (SSR), Vite 8,
Tailwind v4 (`web/app/styles/app.css`), Radix primitives, `motion` (lazy), TanStack Query (private
pages only), openapi-fetch, lucide-react, fonts Onest (text) + Unbounded (display), 4 locales
(uz, uz-Cyrl, ru, en). The target look is **premium, calm, trustworthy, and alive**: Samarkand
tile identity (lapis, firuza, za'faron, anor, girih star) + **Liquid Glass** material for floating
layers + solid, highly legible surfaces for content.

Before writing UI code, read the reference that matches the task:

| Task | Read |
|---|---|
| Anything touching color, type, radius, shadow, spacing tokens | `references/app.css` (the target stylesheet) |
| Glass surfaces, header, tab bar, dialogs, popovers, hero, aurora | `references/liquid-glass.md` |
| Building or changing a component in `app/shared/ui` | `references/components.md` |
| Building or redesigning a page/route | `references/pages.md` |
| Loading / empty / error states, animation, transitions | `references/motion-and-states.md` |
| Finishing any UI task (always) | `references/polish-checklist.md` |

## Step 0 — is the new token layer installed?

Check `web/app/styles/app.css` for `--glass-panel` and `light-dark(`. If missing, the first UI task
is migrating to `references/app.css` (TZ task UI-01): replace the token section, keep the existing
token *names* (all current components keep working), then run `pnpm build`, `pnpm typecheck`, and
fix any visual regressions. Do not start page redesigns before this.

## The 12 hard rules

1. **Tokens only.** Colors come from semantic tokens (`bg-surface`, `text-ink-2`, `border-line`,
   `bg-lapis`, `text-on-anor`…). Never hex/rgb/hsl in className, never `text-white`/`bg-black`,
   never `dark:`. A missing color → add a token to `app.css` (`:root` with `light-dark()`, the
   `@supports not` fallback block, and `@theme inline`). The plugin hook checks every edit and
   reports violations back to you right after the write — fix them immediately.
2. **Type scale only.** `text-2xs xs sm md base lead lg xl 2xl 3xl 4xl 5xl`. No `text-[…]`.
   Headings: `font-display font-semibold tracking-heading` (h1 hero: `tracking-display`).
   Body/UI: Onest. Numbers, money, counts: add `num` (tabular).
3. **Radius & elevation from tokens.** `rounded-control` (inputs, buttons, small cards),
   `rounded-panel` (cards, panels), `rounded-sheet` (dialogs, sheets, hero search),
   `rounded-pill` (chips, badges, pills, nav items). Shadows `shadow-1..4`, `shadow-ring`.
   No `rounded-md/lg/xl/2xl`, no `shadow-sm/md/lg`, no arbitrary `shadow-[…]`.
4. **Glass is for floating & chrome layers only** — header (`glass-bar`), mobile tab bar and sticky
   action bars (`glass-chrome`), hero search / filter bar / stat tiles over the aurora (`glass-panel`),
   dialogs, sheets, popovers, menus, toasts (`glass-sheet`). Content (vacancy rows, forms, resume,
   descriptions, chat bubbles, tables) sits on solid `surface-card`. Never nest glass in glass.
   Max ~4 blurred layers visible at once. Details: `references/liquid-glass.md`.
5. **Text on glass:** `chrome` → only `text-ink`/`text-ink-2`; `panel` → `text-ink-3` only at ≥ 14px;
   `sheet` → all levels. Minimum contrast 4.5:1 body, 3:1 large text & UI boundaries.
6. **Every data view has 4 states:** loading (skeleton shaped like content), empty (EmptyState with
   next action), error (ErrorState with retry — never reuse "empty" for errors, never an endless
   skeleton), success. For TanStack queries branch on `isPending` → `isError` → empty → data.
7. **Every interactive element has 5 states:** default, hover (pointer devices only), `focus-visible`
   (visible ring — never `outline-none` without a replacement like `focus-visible:shadow-ring` or
   `field-shell`), active/pressed (`active:scale-[0.98]` for buttons, `0.97` for pills), disabled
   (`disabled:opacity-50 disabled:pointer-events-none` + reason via tooltip or hint when not obvious).
   Touch targets ≥ 44×44px (`size-11`, `h-11`) on mobile.
8. **Mobile first, 360px up.** Test 360, 390, 768, 1024, 1280, 1440. No horizontal scroll ever:
   grid tracks use `minmax(0,1fr)`, flex/grid children that hold text get `min-w-0`, long words
   `break-words`, badges may wrap. Fixed/sticky bottom elements use `pb-safe`; toasts sit above
   the mobile tab bar and sticky action bars.
9. **One shared primitive per pattern.** Before writing markup, search `app/shared/ui` and
   `components.md`. If the pattern appears twice, extract it (Card, SearchBar, MoneyInput,
   ConfirmDialog, BackLink, Callout, ErrorState, SelectableCard, Timeline, StatCard…). Don't
   leave page-local copies.
10. **i18n everything.** All user-visible strings through `t("namespace.key")` and added to ALL four
    files `app/shared/i18n/messages/{uz,uz-Cyrl,ru,en}.ts` (uz.ts is the typed source). This
    includes aria-labels, titles, meta, currency labels (`t("salary.currency.UZS")`). CI runs
    `test/i18n-keys.mjs`.
11. **Performance budget.** Home page JS+CSS ≤ 150 KB gzip, core bundle ≤ 120 KB (CI). No new
    runtime dependency on public pages without measuring (`pnpm build` + gzip). Prefer CSS
    (`@starting-style`, `anim-*`, `:has()`, native popover) over JS. Heavy UI (dialogs, sheets,
    charts, emoji/map pickers) is `lazy()` and mounted only when open. Animate only `transform`
    and `opacity`.
12. **Accessibility is part of "premium".** Semantic elements, labelled controls (`Field`),
    `aria-live` for async results, focus returns to the trigger after dialogs, keyboard paths for
    every pointer interaction (kanban: "Move to…" menu), `prefers-reduced-motion`,
    `prefers-reduced-transparency`, `prefers-contrast: more` all honored (app.css already does).

## Codebase conventions (follow exactly)

- **Class merging:** `cn()` from `~/shared/lib/cn`. Variants as `const variants = {…} as const`,
  prop type `keyof typeof variants`. Polymorphism with Radix `Slot` / `asChild`.
- **Files:** shared UI in `app/shared/ui/PascalCase.tsx` (named exports, add to `ui/index.ts`);
  routes kebab-case or `folder/index.tsx` with colocated PascalCase parts; helpers kebab-case.
  Routes import `~/shared/...` per file (not the barrel); `shared/` uses relative imports.
- **Links & navigation:** `LocalizedLink to="/path"`, `localizedPath(locale, "/x")`, `useLocale()`.
  Add `prefetch="intent"` on primary list→detail links; `viewTransition` on list→detail.
- **Data:** public loaders `api.GET(..., { headers: forwardHeaders(request) })` then `orThrow` /
  `soft`. Private data via TanStack Query `authed()` / `authedPage()`; keys are arrays with a
  kebab-case head (`["my-applications", status]`). Mutations optimistic with `onMutate` +
  rollback + `onSettled` invalidate. Errors: `toast({ tone: "error", title: errorText(t, e.error) })`.
- **Forms:** `useSubmit()` → `{ pending, error, fields, run }`, `<Field error={fields.x}>`,
  `<FormError>`. After a failed submit, focus + scroll to the first invalid field.
- **Meta/SEO:** `meta` via `metaT(matches)` + `seo({...})`; never hardcode a locale in formatting
  (`salary(v.salary, t, locale)`).
- **Formatting:** `~/shared/lib/format.ts` (`money`, `salary`, `groupDigits`, `relativeTime`).
  Every count shown to users goes through `groupDigits`. `RelTime` gets a `title` with the
  absolute date.
- **Comments:** short "why" notes, English, like the existing code.

## Workflow for any UI task

1. Read the relevant references (table above) and the current file(s).
2. List what the screen must show in each state (loading/empty/error/success) and on
   each breakpoint before editing.
3. Reuse or extract primitives; then compose the page.
4. Add/adjust i18n keys in all 4 locales.
5. Verify: `cd web && pnpm typecheck && pnpm build`; check bundle size if you added imports;
   run the related `test/*.mjs` Playwright script if the dev server + API are available; take
   screenshots at 390px and 1360px in light and dark when a browser is available.
6. Walk `references/polish-checklist.md` and fix every miss before reporting done.
7. Report: what changed, which checklist items were verified, anything not verified and why.

## Things that look premium here (use them)

- Aurora + girih hero with a glass search bar; stats and popular searches as glass pills.
- Solid content cards that lift 2px on hover (`surface-card surface-card-interactive`) with a
  single stretched link (`after:absolute after:inset-0`) and secondary buttons at `relative z-10`.
- Salary in `font-display` firuza-ink with `num`; verified badge in firuza; TOP in za'faron pill.
- Applied-filter chips row with "clear all"; sticky glass filter bar on mobile.
- Spring-eased dialogs/popovers (`anim-dialog`, `anim-pop`), list entrance stagger on first
  paint only (`anim-enter` with `--i`), view transitions from list to detail.
- Skeletons that exactly mirror the final layout (`skeleton` utility).
- Empty states with an illustration-grade icon tile, a one-line reason and one primary action.

## Things that make it look cheap (never)

- Glass on long text, glass on glass, blur on list rows, rainbow gradients, neon glows.
- Random spacing (`p-5` here, `p-7` there): use the page/card recipes in `pages.md`.
- Mixed heading styles, arbitrary font sizes, emoji as icons, raw white text on brand colors.
- Layout shift: images without size, fonts without fallback metrics, SSR spinner → content swap.
- Hover-only affordances (e.g. delete visible only on hover) — they don't exist on touch.
