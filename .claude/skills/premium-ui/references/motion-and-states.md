# Motion & states

## Motion principles

- Motion answers a user action (open, select, confirm, move) or orients after navigation.
  No decorative looping animation; no fade-up on every section while scrolling.
- Durations: `--dur-1` 120ms (press, color), `--dur-2` 200ms (hover, small reveals, popovers),
  `--dur-3` 320ms (dialogs, sheets, layout), `--dur-4` 520ms (hero reveal only).
- Easing: `var(--ease-spring)` for things that *arrive* or *move* (popovers, dialogs, cards lifting,
  pills pressing back); `var(--ease-out-quint)` for slides and fades; `var(--ease-in-quick)` for
  exits (exits are faster than entrances).
- Only `transform` and `opacity` animate (plus `background-color`/`border-color`/`box-shadow` on
  hover). Never animate `width/height/top/left`, `backdrop-filter` or blur radius.
- CSS first: `anim-*` utilities for Radix `data-state`, `@starting-style` for native popovers,
  `anim-enter` with `style={{ "--i": index }}` for the first paint of lists (max 8 items staggered,
  and **not** on "Load more" appends or refetches). `motion` (lazy `domMax`) only for layout
  animations: Tabs indicator, SegmentedControl thumb, Toast stack, kanban card reflow.
- `prefers-reduced-motion`: global rule in app.css makes animations instant — don't bypass it with
  JS timers; motion's `reducedMotion="user"` already respects it.

### Signature interactions

| Interaction | Spec |
|---|---|
| Button press | `active:scale-[0.98]` 120ms |
| Glass pill press | `glass-interactive` → scale .97, tint up on hover |
| Card hover | `surface-card-interactive`: translateY(-2px) + shadow-3, spring 200ms |
| Save (heart) | icon scale 1 → 1.25 → 1 (spring), fill anor, `aria-pressed`; undo toast on remove |
| Dialog open | overlay fade 200ms; content `dialog-in` scale .96→1 + fade, spring 320ms |
| Sheet (mobile) | slide up 320ms out-quint, drag handle, swipe-down to close (pointer events) |
| Popover/Select | `pop-in` translateY(6px) scale .97 → none, spring 200ms |
| Route change | NavigationProgress bar; list→detail View Transition (title + logo shared) |
| Apply success | check icon draw (stroke-dashoffset) 400ms + confetti-free subtle scale |
| Kanban drop | card settles with spring; column count ticks (num) |
| Toast | slide from bottom + fade, spring; swipe to dismiss on touch |
| Hero load | girih mask sweep once (existing), aurora fade 520ms |

### View Transitions (React Router)

```tsx
<LocalizedLink to={`/vacancies/${v.slug}`} viewTransition prefetch="intent">…</LocalizedLink>
// list item: style={{ viewTransitionName: `vacancy-title-${v.id}` }} on the title,
//            `vacancy-logo-${v.id}` on the logo; same names on the detail page.
```
Names must be unique on the page. Skip when `prefers-reduced-motion` (app.css already shortens).

## The four data states (mandatory for every list/detail/widget)

```tsx
if (q.isPending) return <VacancyRowSkeleton count={5} />;       // shaped like content
if (q.isError)   return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
if (!q.data.items.length) return <EmptyState icon={…} title body action />;
return <List … />;
```

- **Loading:** skeleton with the same outer size/radius/padding as the real item (no layout shift
  when data arrives). Show after 150ms delay for fast responses (avoid flash) — CSS
  `animation-delay` on the skeleton wrapper opacity is enough.
- **Empty:** explain why + one action ("Clear filters", "Create resume", "Post a vacancy").
  Different copy for "no data yet" vs "no results for these filters".
- **Error:** `ErrorState` with the translated error (`errorText`), Retry, and offline variant.
  Server loaders: `soft()` sections render a compact inline ErrorState, not a blank gap.
- **Partial/stale:** while refetching keep old data with `opacity-60 transition-opacity` +
  `aria-busy="true"`; never blank the list.
- **Optimistic:** mutations update UI immediately, roll back with an error toast that offers Retry.

### SSR & private pages
`private.tsx` currently renders a spinner on the server then swaps — replace with a layout-shaped
skeleton (sidebar + header + content blocks) so there is no jump, and keep the redirect logic.

### Forms
- Inline validation on blur (not on every keystroke) for format rules; `required` messages on
  submit. After a 422, map `fields`, focus the first invalid field, scroll it into view (center).
- Submit button shows loading, keeps width, disables double submit. Success: toast + (where it
  makes sense) inline "Saved ✓" next to the section title that fades after 2s.
- Unsaved changes guard (`useBlocker`) on long editors (resume, vacancy, company).
- Character counters on limited fields; salary from ≤ to; dates start ≤ end.
