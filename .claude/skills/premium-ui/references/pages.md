# Page recipes — every route in `web/app/routes.ts`

## Global page grammar (use everywhere, no ad-hoc values)

| Element | Recipe |
|---|---|
| Page container | `container-page` (76rem). Long text pages: `container-prose` (44rem). |
| Page top padding | hero pages `pt-14 md:pt-24`; all other pages `pt-6 md:pt-10` |
| Page bottom padding | `pb-16 md:pb-24`; + `pb-28` on mobile when the tab bar or a sticky bar is visible |
| Section gap | `mt-12 md:mt-20` between marketing sections; `gap-6` between app panels |
| H1 (app pages) | `font-display text-2xl md:text-3xl font-semibold tracking-heading text-ink` |
| H1 (hero) | `font-display text-3xl sm:text-4xl md:text-5xl font-semibold tracking-display` |
| H2 (section) | `font-display text-xl md:text-2xl font-semibold tracking-heading` |
| H3 / card title | `text-lead font-semibold tracking-snug` |
| Lead paragraph | `text-lead text-ink-2 max-w-2xl` |
| Body | `text-md` in app UI, `text-base` in long-form reading |
| Meta line | `text-sm text-ink-2` (ink-3 only on solid surfaces) |
| PageHeader | H1 + optional description + actions right (mobile: actions wrap below, full width) + optional Breadcrumbs above |
| Two-column app layout | `grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)]`; sidebars `sticky top-24` |
| Detail layout | `grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]`; aside `sticky top-24` |

Shell (`site.tsx`): `glass-bar` header, `NavigationProgress`, `main#main`, redesigned footer,
`MobileTabBar` (< md, signed-in or not — anonymous: Search, Companies, Employers, Login).

---

## Public

### `/` Home — `home.tsx` (currently hero only → full landing)
1. **Hero:** `aurora-hero` + masked girih, glass pill "Bugun N ta yangi vakansiya" (live count from
   API meta), H1, lead, `SearchBar size="lg" material="glass"` with suggestions + region, popular
   searches as `glass-panel glass-interactive` pills, 3 glass StatCards (vacancies, companies,
   hired/applications this week).
2. **Categories grid:** 8–12 top categories from the catalog as solid tiles (icon tile + name +
   `num` count), link to `/vacancies?category=`. "All categories" opens a sheet.
3. **Fresh & featured vacancies:** 6 `VacancyCard`s (featured first), "See all".
4. **Top companies:** logo cloud / 8 company cards (verified first) with open-job counts.
5. **Two paths:** split section "Ish izlayapman" / "Xodim izlayapman" with 3 steps each and CTAs
   (register as seeker / post a vacancy).
6. **Cities:** chips to `/vacancies?region=` for the 14 regions (also good for SEO).
7. **App/Telegram bot CTA** (bot already exists) + final CTA band.
Data: one loader with `Promise.all` of `soft()` calls; each section degrades independently.
SEO: WebSite + SearchAction JSON-LD, Organization JSON-LD.

### `/vacancies` — `vacancies/index.tsx`, `Filters.tsx`
- Desktop: left `surface-card` filters (sticky), right results. Top of results: H1 with query
  context ("Frontend dasturchi · 248 ta"), sort Select, "Save search" button, **FilterChip row**
  with "Clear all".
- Mobile: sticky `glass-bar` below header: SearchBar compact + "Filtrlar (n)" button + sort;
  filters in bottom `Sheet` with a sticky footer "Show N results" (live count).
- Results: `VacancyCard` list (solid, interactive, stretched link, `prefetch="intent"`,
  `viewTransition`), skeleton rows while `navigation.state === "loading"` for a *new* query
  (keep old results dimmed for filter tweaks), fuzzy-match Callout, EmptyState with suggestions
  (remove a filter chips), infinite "Load more".
- Fix: root `shouldRevalidate` so filter changes don't refetch catalog + messages.

### `/vacancies/:slug` — `vacancy/index.tsx`, `ApplyDialog.tsx`
- Breadcrumbs (Vacancies › Category › Title) + JSON-LD BreadcrumbList.
- Header card: logo (view-transition name `vacancy-logo-{id}`), H1 (`break-words`, name
  `vacancy-title-{id}`), company + verified, **salary block** (display font, firuza-ink),
  facts grid (experience, employment, schedule, format, region) as icon + label pairs,
  posted `RelTime` + **expires date**, views count (grouped).
- Actions: Apply (primary lg), Save (IconButton heart), Share (ShareMenu). Mobile: sticky
  `glass-chrome pb-safe` bar with salary + Apply.
- Body: `RichText` with prose styles (h3/ul/ol/strong spacing, max 70ch), skills as Badges
  linking to search, address with map link.
- Aside: company card (glass-free solid), "Similar vacancies" (5 rows), "Report vacancy" link.
- ApplyDialog: SelectableCards for resumes, cover letter Textarea with counter, success state
  with animated check and "Go to my applications".

### `/companies` — `companies.tsx`
SearchBar + industry/region Selects; grid `sm:grid-cols-2 lg:grid-cols-3` of company cards
(logo, name + verified, industry · region, `num` open jobs, "N ta vakansiya" button).
Pagination with numbers. ErrorState on loader failure (not "empty").

### `/companies/:slug` — `company.tsx`
Cover (image with `aspect-[4/1]` + LQIP, or `aurora-hero` + girih fallback), logo on glass badge
overlapping, name/verified/industry/region/size/website, Tabs: **Vacancies** (default) · About ·
(Reviews later). Aside: facts, team size, links. Organization JSON-LD.

### `/employers` — `employers.tsx`
Hero with dashboard screenshot mock (real UI screenshot, `aspect` + width/height), value props
grid (4), "How it works" 3 steps, candidate search teaser, pricing (plans with "Tez kunda" badge),
FAQ Accordion, final CTA. AI block → glass-panel on aurora (not a flat lapis slab).

### Auth — `auth/*`
Split layout on desktop: left `aurora-hero` + girih + 3 trust bullets / testimonial, right
`glass-sheet` card (max-w-md) with the form; mobile: single column card. Google button first,
divider "yoki", email form; password strength meter on register; CodeInput large cells with
paste; resend countdown in `num`. Errors inline under fields + FormError summary.

### Static pages `/about /contacts /privacy /terms` — `page.tsx`
`container-prose`, H1, "Last updated" date, table of contents (sticky on desktop) for legal pages,
prose styles.

### 404 / error boundary
Illustration-grade icon, search bar, links to vacancies/companies/home. Error boundary shows
ErrorState with retry + request id (from `X-Request-ID` if exposed) for support.

---

## Seeker account (`account/layout.tsx`)
Layout: desktop sidebar 15rem (`glass-panel` when sticky over aurora, else solid) with avatar,
name, **profile completeness Progress**, nav with icons + counts; mobile: `glass-bar` scrollable
segmented strip under header + tab bar.

- **`/me` settings:** Sections (Profile, Contacts, Notifications, Appearance [theme, language,
  glass tier], Security [password, sessions as DataTable→cards], Danger zone [delete account]).
  Each section a `Card` with Section header; save per section with inline success.
- **`/me/resumes`:** cards with title, updated `RelTime`, visibility Select (colored dot),
  completeness bar, actions (Open, Edit, PDF, Duplicate, Delete via ConfirmDialog). Empty: "Create
  your first resume" with a 3-step illustration.
- **`/me/resumes/new|:id/edit`:** Stepper (Basics → Experience → Education → Skills & languages →
  Visibility → Preview). Desktop: left sticky section nav with ticks + right live preview toggle.
  Autosave draft (debounced) + "Saved" indicator; `useBlocker` unsaved-changes guard; sticky
  `glass-chrome` save bar with `pb-safe`.
- **`/me/applications`:** SegmentedControl/Chips by status with counts, rows (logo, title,
  company, StatusBadge, updated), ErrorState on failure.
- **`/me/applications/:id`:** header card + Timeline + cover letter + chat button + withdraw
  (ConfirmDialog).
- **`/me/saved`, `/me/searches`, `/me/notifications`:** saved = VacancyCard list with remove
  (undo toast); searches = cards with filter badges, notify Switch, "Run search"; notifications =
  grouped by day, unread tint `bg-lapis-soft/40`, mark all read, icon per type.

## Employer (`employer/*`)
- **`/employer` dashboard:** PageHeader with company switcher + "New vacancy". KPI row (StatCards:
  active vacancies, new applications 7d, views 7d, avg. time to first response), "Needs attention"
  list (new applicants, expiring vacancies, drafts), vacancies DataTable (status tabs, views,
  applicants, expires, actions menu). Empty: onboarding checklist (company profile → logo → first
  vacancy → verification).
- **`/employer/company`:** profile form with FileDropzone logo + cover, live preview card, team
  members table with roles + invite (invite flow must require acceptance — see TZ SEC).
- **`/employer/vacancies/new|:id/edit`:** Stepper (Basics → Conditions & salary → Description →
  Skills → Preview & publish), SalaryRange with validation, description editor with counter and
  markdown toolbar, preview exactly like the public page, sticky save bar, unsaved guard.
- **`/employer/vacancies/:id/applications` kanban:** columns `bg-sunken/70 rounded-panel`, header
  with count, cards `surface-card` (avatar, name, resume title, experience, `RelTime`, rating dots
  later). Drag & drop with pointer events that also work on touch (long-press 200ms), keyboard
  "Move to…" menu always visible on focus, `aria-live` announcements. Mobile: SegmentedControl
  columns with arrow keys + swipe.
- **`/employer/applications/:id`:** two columns — ResumeView (left), aside with stage Select,
  private note (autosave), history Timeline, chat button.
- **`/employer/candidates`:** SearchBar + filters (desktop sidebar / mobile Sheet — currently
  missing), results as DataTable→cards with Invite; InviteDialog picks vacancy.

## Chat (`chat/*`)
Two-pane on desktop (list 22rem, thread), single pane on mobile with slide transition and **no
site header** (thread header with back button as `glass-bar`). Bubbles: own `bg-lapis
text-on-lapis rounded-panel rounded-br-control` (theme radius tokens work per corner), others
`bg-surface border border-line rounded-panel rounded-bl-control`; replace the raw
`bg-black/45 text-white` media overlays with `bg-scrim text-on-scrim`. Message actions via
long-press / context menu (not hover-only). Composer `glass-chrome pb-safe`. Attachment previews
use lucide icons instead of emoji. Day separators as glass pills.

## Public resume `/resumes/:id`
Document-like `surface-card` (A4 proportion on desktop), header with photo, contacts gated,
Timeline sections, sticky actions (PDF, Invite) on desktop aside / mobile glass bar.

## Admin (new, MVP minimal — see TZ)
`/admin` with moderation queue (DataTable: vacancy, company, submitted, actions Approve/Reject with
reason), companies verification, reports, users (block). Solid UI, dense, keyboard friendly.
