# Component spec — `web/app/shared/ui`

Each entry: purpose → API → visual recipe → states → a11y. "UPGRADE" = existing component to
change; "NEW" = to build. Keep existing props backward compatible unless noted. Every component
must be shown on `/ui` (dev showcase) with all variants and states, light + dark.

## Foundations shared by all components

- Heights: `sm` h-9 (36px, desktop only / dense), `md` h-11 (44px, default), `lg` h-13 (52px, hero).
- Horizontal padding: sm px-3, md px-4, lg px-6. Icon size: sm 16, md 18–20, lg 20.
- Label text: sm `text-sm`, md `text-md`, lg `text-base`; weight `font-medium`
  (primary actions `font-semibold`).
- Transitions: color/border `duration-150`; transform with `var(--ease-spring)`.
- Focus: global `:focus-visible` outline for buttons/links; text-like inputs use `field-shell`
  (border → focus color + `shadow-ring`). Never remove both.
- Disabled: `opacity-50 pointer-events-none`; `aria-disabled` for links.

---

## Button — UPGRADE (`Button.tsx`)

Variants:
| variant | recipe |
|---|---|
| primary | `bg-lapis text-on-lapis shadow-2 hover:bg-lapis-hover` |
| secondary | `bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-sunken` |
| soft | `bg-lapis-soft text-lapis-ink hover:bg-[color-mix(in_oklab,var(--lapis-soft),var(--lapis)_10%)]` |
| ghost | `text-ink-2 hover:bg-sunken hover:text-ink` |
| danger | `bg-anor text-on-anor hover:bg-anor-hover` (fixes dark-mode 2.7:1 contrast) |
| glass (NEW) | `glass-panel glass-interactive text-ink` — only over aurora/hero/media |

Add `shape?: "default" | "pill"` (`rounded-control` / `rounded-pill`). Header and hero CTAs use pill.
Pressed: `active:scale-[0.98]`. Loading keeps width (spinner replaces icon; label stays), `aria-busy`.
`IconButton`: keep required `label`; add `variant="glass"`; min 44px on touch (`size-11`).

## Badge / Chip — UPGRADE

- **Badge** (static label): `h-6 rounded-pill px-2.5 text-xs font-semibold` (was `rounded-md`).
  Tones: neutral `bg-sunken text-ink-2`, lapis, firuza, zafaron, anor (`*-soft` bg + `*-ink` text),
  outline `border border-line-strong text-ink-2`. Allow wrap for long skills (`max-w-full truncate`
  with `title`).
- **Chip** (toggle): `h-9 rounded-pill px-3 text-sm font-medium border`. Off:
  `border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink`. On (`aria-pressed=true`):
  `border-lapis bg-lapis-soft text-lapis-ink` + check icon (width animates). Add disabled style.
- **FilterChip** (NEW, removable applied filter): `h-8 rounded-pill bg-lapis-soft pl-3 pr-1.5
  text-sm text-lapis-ink` + `IconButton` "×" (`aria-label={t("common.removeFilter", {name})}`).

## Card — NEW (`Card.tsx`)

Replaces the 41 hand-written `rounded-panel border border-line bg-surface` copies.
```tsx
<Card as="article" interactive padding="md">…</Card>   // surface-card (+ surface-card-interactive)
<Card material="glass">…</Card>                          // glass-panel (only over aurora)
<CardHeader title description actions /> <CardBody/> <CardFooter/>
```
Padding scale: `sm` p-4, `md` p-5 md:p-6 (default), `lg` p-6 md:p-8. Heading in cards:
`text-lead font-semibold tracking-snug` (not font-display) unless it's a page-level panel title
(`font-display text-lg tracking-heading`).

## StatCard / KPI — NEW
Label `text-sm text-ink-2`, value `num font-display text-2xl font-semibold tracking-heading`,
delta pill (firuza up / anor down with arrow icon + sr-only text), optional sparkline (inline SVG,
no chart lib). Used on employer dashboard and home stats (glass variant).

## Field / Input / Textarea — UPGRADE
- Wrap every text-like control in `field-shell` (single focus/invalid treatment) — delete the 13
  copies of `focus:shadow-[0_0_0_4px_var(--lapis-soft)]`.
- Input: `leading`/`trailing` slots, sizes md/lg; `inputMode`, `autoComplete` set correctly.
- Textarea: `field-sizing: content`, **counter** when `maxLength` given (`num text-xs text-ink-3`,
  turns `text-anor-ink` at ≥ 95%).
- Field: label `text-sm font-medium text-ink`, optional marker `text-ink-3`, hint `text-sm text-ink-2`,
  error `text-sm text-anor-ink` with icon and `role="alert"`; success tick (firuza) optional.

## MoneyInput — NEW (replaces Filters.SalaryInput, candidates.SalaryTo, vacancy-edit.MoneyInput)
Digit grouping while typing (`groupDigits`, caret preserved), currency suffix selectable
(UZS / USD via `t("salary.currency.*")`), `inputMode="numeric"`, min/max validation, paste-safe.

## SalaryRange — NEW
Two MoneyInputs (from/to) + optional dual-thumb slider (CSS-only range inputs) for the filters sheet.
Validates `from ≤ to` inline.

## PhoneInput — NEW
`+998 (XX) XXX-XX-XX` mask, stores E.164; paste of any format normalizes.

## SearchBar — NEW (replaces 4 hand-built bars: home, vacancies, companies, candidates)
```tsx
<SearchBar size="lg" material="glass" region onSubmit suggestions />
```
Keyword input + optional region Select (bare) + submit button, one `field-shell`-style focus ring on
the whole bar (`focus-within`). Suggestions: combobox (`role="combobox"`, listbox of recent +
`/search/suggest` titles), debounced 150ms, `aria-activedescendant`, Enter submits, Esc closes.
Mobile: stacked layout, full-width button.

## Select / MonthPicker / Popover / Menu — UPGRADE
- Panels use `glass-sheet rounded-panel p-1.5`; items `rounded-control px-3 py-2 text-md`,
  highlighted `bg-sunken`, selected check in lapis.
- **Fix:** bare Select variant needs a visible focus style (`focus-visible:bg-surface
  focus-visible:shadow-ring`).
- Consolidate: use one popover system. Keep native Popover for simple menus; for complex
  keyboard menus use Radix Menu. Popover must not close on every inner button click unless it's
  a menu item (`data-close`).

## Dialog / Sheet — UPGRADE
`glass-sheet`, `rounded-sheet`, padding p-6 md:p-7, title `font-display text-xl tracking-heading`,
description `text-md text-ink-2`, footer right-aligned (mobile: full-width stacked, primary last).
Sheet on mobile: bottom sheet with grab handle (`h-1.5 w-10 rounded-pill bg-line-strong mx-auto`),
max-h 88dvh, internal scroll, sticky footer `pb-safe`. Desktop sheet: right panel 26rem.

## ConfirmDialog — NEW (replaces 4 copies)
`confirm({ title, body, confirmLabel, tone: "danger" | "default" })` returning a promise; focus on
the safe action by default for destructive tones.

## Tabs / SegmentedControl — UPGRADE / NEW
- Tabs: add `focus-visible` ring on triggers; underline indicator (motion layoutId, lazy).
- SegmentedControl (NEW): pill track `bg-sunken rounded-pill p-1`, active thumb `bg-surface
  shadow-1 rounded-pill` sliding with CSS (`anchor` or transform). Used for theme/language, list
  views, kanban mobile column switcher (`role="tablist"` + arrow keys + `tabpanel`).

## Toast — UPGRADE
`glass-sheet rounded-panel`, icon per tone (fix: info uses Info icon, not success), optional
**action** button (Undo/Retry), stacks max 3, position bottom-center on mobile **above** tab bar /
sticky bars (`bottom-[calc(env(safe-area-inset-bottom)+6rem)]`), bottom-right on desktop.

## Skeleton — UPGRADE
Use the `skeleton` utility. Provide shaped skeletons next to their component:
`VacancyRowSkeleton` (exists), `CompanyCardSkeleton`, `ApplicationRowSkeleton`,
`ConversationSkeleton`, `ResumeSkeleton`, `KanbanColumnSkeleton`, `StatCardSkeleton`.
Never a single `h-96` block.

## EmptyState / ErrorState — UPGRADE / NEW
- EmptyState: icon tile `size-14 rounded-panel bg-lapis-soft text-lapis grid place-items-center`,
  title `text-lead font-semibold`, body `text-md text-ink-2 max-w-sm`, one primary action.
- **ErrorState (NEW):** anor-soft icon tile, title from `errorText`, "Try again" button calling
  `refetch()` / `revalidator.revalidate()`, secondary "Go home". Offline variant (WifiOff icon)
  when `!navigator.onLine`.

## Callout — NEW (replaces 3 ad-hoc za'faron blocks)
Tones info (lapis), success (firuza), warning (zafaron), danger (anor): `rounded-panel
bg-*-soft text-*-ink p-4` + icon + title + body + optional action.

## Avatar / AvatarGroup — UPGRADE / NEW
Keep initials fallback + deterministic tint. Add `alt` = person/company name when the image
conveys identity (not decorative). Sizes xs 24, sm 32, md 40, lg 56, xl 80. Square (company)
uses `rounded-control` for ≤ md, `rounded-panel` for lg+. `width`/`height` attributes always set.
Company logos: `object-contain bg-surface p-1.5 border border-line`.
AvatarGroup: overlapping `-space-x-2` with `ring-2 ring-surface`, "+N" bubble.

## Breadcrumbs / BackLink — NEW (replaces 13 hand-rolled back links)
Breadcrumbs on detail pages (with `BreadcrumbList` JSON-LD); BackLink on mobile/private pages:
`inline-flex items-center gap-1.5 text-md text-ink-2 hover:text-ink` + ArrowLeft.

## Pagination / InfiniteList — NEW / UPGRADE
- Pagination with page numbers for `/companies` (keyset-compatible "Load more" stays for vacancies).
- LoadMore: add IntersectionObserver auto-load after the 2nd manual click; keep the button for
  a11y; announce "N more loaded" via `aria-live="polite"`.

## Stepper / Progress — NEW
Stepper for the resume and vacancy editors (sections become steps on mobile, a sticky section nav
on desktop with completion ticks). Progress bar (determinate) for uploads and profile completeness;
top **NavigationProgress** bar (2px lapis, driven by `useNavigation().state`) in `site.tsx`.

## FileDropzone — NEW
Drag & drop + click, accept/size hints, preview (image) or file row (PDF/DOC), progress ring,
error per file, keyboard accessible. Used for avatar, logo, company cover, chat attachments.

## Timeline — NEW (replaces 2 ad-hoc versions)
Vertical line `bg-line`, dots colored by status, time `RelTime` with absolute `title`.

## SelectableCard — NEW (replaces 3 radio-card variants: ApplyDialog, register roles, resume visibility)
Radio semantics (`role="radio"` in a `radiogroup` or native input), selected: `border-2 border-lapis
bg-lapis-soft`, unselected: `border border-line-strong hover:border-ink-3`.

## DataTable — NEW (desktop) → cards (mobile)
For candidates, sessions, admin moderation: sticky header `glass-bar`, zebra none, row hover
`bg-sunken/60`, sortable headers with `aria-sort`, selection checkboxes; below `md` each row
renders as a `surface-card`.

## CommandPalette (⌘K) — NEW, lazy
Search vacancies/companies/pages/actions; `glass-sheet`, top-centered, fuzzy local results +
`/search/suggest`. Only loaded on first ⌘K/Ctrl+K or header search icon tap.

## MobileTabBar — NEW
See `liquid-glass.md`. Role-aware items, unread badges (`bg-anor text-on-anor`), `aria-current`.

## StatusBadge — UPGRADE
Map each application status to a tone + icon; include text (never color alone).

## Kbd, Tooltip, ShareMenu — NEW/UPGRADE
Kbd: `inline-flex h-5 items-center rounded-pill border border-line-strong bg-surface px-1.5
font-sans text-2xs font-medium text-ink-2`. Tooltip: one shared `TooltipProvider` in
root (not one per tooltip), `glass-sheet text-sm`. ShareMenu: Web Share API on mobile, fallback
menu with Telegram, copy link (toast with check).
