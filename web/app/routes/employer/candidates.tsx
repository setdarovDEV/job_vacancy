import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, Check, Clock, MapPin, SearchX, Send, SlidersHorizontal, UsersRound, type LucideIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { EmployerOnly } from "./EmployerOnly";
import { api, type Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { experienceText, groupDigits, money } from "~/shared/lib/format";
import { authedPage } from "~/shared/query/query";
import { LoadMore } from "~/shared/query/LoadMore";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardLink } from "~/shared/ui/Card";
import { Chip } from "~/shared/ui/Chip";
import { DataTable, type DataTableColumn } from "~/shared/ui/DataTable";
import { DialogRoot, SheetContent } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Field } from "~/shared/ui/Field";
import { FilterChip } from "~/shared/ui/FilterChip";
import { MoneyInput, type Currency } from "~/shared/ui/MoneyInput";
import { RelTime } from "~/shared/ui/RelTime";
import { SearchBar } from "~/shared/ui/SearchBar";
import { PageHeader } from "~/shared/ui/Section";
import { Select } from "~/shared/ui/Select";
import { Skeleton, SkeletonDelay, useSkeletonHold } from "~/shared/ui/Skeleton";
import { Checkbox } from "~/shared/ui/Toggle";

const loadInvite = () => import("./InviteDialog");
const InviteDialog = lazy(loadInvite);

type Resume = Schemas["ResumeCard"];
type Meta = { next_cursor?: string | null; total?: number; total_capped?: boolean; fuzzy?: boolean };

/* ---- URL state ----------------------------------------------------------------------------
 * Every filter lives in the URL (shareable, survives reload and back). Order here = order of
 * the applied-filter chips. `currency` only qualifies `salary_to` and is dropped without it.
 */
const KEYS = ["q", "category_id", "region_id", "with_relocate", "language", "salary_to", "currency", "experience", "work_format", "sort"] as const;
type Key = (typeof KEYS)[number];
type Query = Partial<Record<Key, string>>;
type Applied = { key: Key; value: string };

const EXPERIENCE = ["none", "1_3", "3_6", "6_plus"] as const;
const FORMATS = ["office", "remote", "hybrid"] as const;
const LANGS = ["uz", "ru", "en", "tr", "ko", "de", "zh"];
const MULTI = new Set<Key>(["experience", "work_format"]);
// Column ids (not literals: test/i18n-keys.mjs reads every `key: "…"` as a message key).
const COL = { who: "who", exp: "exp", pay: "pay", act: "act" } as const;

// What the API accepts per parameter. A hand-edited or stale URL loses the bad parts instead of
// turning the page into a validation error that "Retry" can't fix.
const VALID: Partial<Record<Key, (v: string) => boolean>> = {
  category_id: (v) => /^[1-9]\d{0,8}$/.test(v),
  region_id: (v) => /^[1-9]\d{0,8}$/.test(v),
  with_relocate: (v) => v === "true",
  language: (v) => /^[a-z]{2,3}$/.test(v),
  salary_to: (v) => /^\d{1,12}$/.test(v),
  currency: (v) => v === "UZS" || v === "USD",
  sort: (v) => v === "relevance" || v === "updated",
  q: (v) => v.length <= 200,
};
const ENUM: Partial<Record<Key, readonly string[]>> = { experience: EXPERIENCE, work_format: FORMATS };

function parse(sp: URLSearchParams): Query {
  const q: Query = {};
  for (const k of KEYS) {
    let v = sp.get(k)?.trim();
    const allowed = ENUM[k];
    if (v && allowed) v = [...new Set(v.split(","))].filter((x) => allowed.includes(x)).join(",");
    if (v && (VALID[k]?.(v) ?? true)) q[k] = v;
  }
  return normalize(q);
}

/** A consistent, minimal URL: empty values, orphan qualifiers and the default currency go. */
function normalize(q: Query): Query {
  const out: Query = {};
  for (const k of KEYS) if (q[k]) out[k] = q[k];
  if (!out.region_id) delete out.with_relocate;
  if (!out.salary_to || out.currency === "UZS") delete out.currency;
  // "relevance" means nothing without search words.
  if (!out.q && out.sort === "relevance") delete out.sort;
  return out;
}

const withValue = (q: Query, k: Key, v: string | null): Query => normalize({ ...q, [k]: v ?? undefined });
const multi = (q: Query, k: Key) => (q[k] ?? "").split(",").filter(Boolean);
const toggleMulti = (q: Query, k: Key, v: string) => {
  const cur = multi(q, k);
  return withValue(q, k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || null);
};

function appliedFilters(q: Query): Applied[] {
  const out: Applied[] = [];
  for (const k of KEYS) {
    if (k === "q" || k === "sort" || k === "currency" || !q[k]) continue;
    if (MULTI.has(k)) multi(q, k).forEach((value) => out.push({ key: k, value }));
    else out.push({ key: k, value: q[k]! });
  }
  return out;
}

const removeFilter = (q: Query, a: Applied) => (MULTI.has(a.key) ? toggleMulti(q, a.key, a.value) : withValue(q, a.key, null));
/** Filters off; the search words and the sort stay. */
const clearFilters = (q: Query): Query => normalize({ q: q.q, sort: q.sort });
/** Stable string for a query (cache keys, "is the draft different?"). */
const keyOf = (q: Query) => new URLSearchParams(normalize(q) as Record<string, string>).toString();

/** Chip text for one applied filter, in the UI language. */
function useFilterLabel() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  return (a: Applied, q: Query): string => {
    switch (a.key) {
      case "category_id":
        return nameOf(idx.categories.get(Number(a.value))?.name, locale) || t("jobs.filters.category");
      case "region_id":
        return nameOf(idx.regions.get(Number(a.value))?.name, locale) || t("jobs.filters.region");
      case "with_relocate":
        return t("candidates.withRelocate");
      case "language":
        return t("candidatesPage.language", { name: t(`langs.${a.value}`) });
      case "salary_to": {
        // Exact digits: money() rounds millions ("12,3 mln"), a chip must say what really filters.
        const n = Number(a.value);
        const amount = q.currency === "USD" ? `$${groupDigits(n)}` : `${groupDigits(n)}\u00a0${t("salary.currency.UZS")}`;
        return t("salary.upTo", { amount });
      }
      default:
        return t(`enums.${a.key}.${a.value}`);
    }
  };
}

/* ---- page -------------------------------------------------------------------------------- */

export default function Candidates() {
  return <EmployerOnly><Page /></EmployerOnly>;
}

function Page() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const query = useMemo(() => parse(sp), [sp]);
  const apply = (next: Query) => setSp(normalize(next) as Record<string, string>, { replace: true, preventScrollReset: true });
  const label = useFilterLabel();
  const placeOf = usePlaceOf();

  const q = useInfiniteQuery({
    queryKey: ["candidates", query],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const page = await authedPage<Resume>(() =>
        api.GET("/resumes", { params: { query: { ...(query as Record<string, never>), cursor: pageParam } }, signal }));
      return page as typeof page & { meta: Meta };
    },
    getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
    // A filter tweak keeps the current rows on screen, dimmed, until the new ones land.
    placeholderData: keepPreviousData,
  });
  // Cursor pages can overlap when a resume is updated between loads: keep each id once.
  const items = useMemo(() => {
    const seen = new Set<string>();
    return (q.data?.pages ?? []).flatMap((p) => p.data).filter((r) => !seen.has(r.id) && seen.add(r.id));
  }, [q.data]);
  const meta = q.data?.pages[0]?.meta;
  const busy = q.isPlaceholderData;
  const loading = useSkeletonHold(q.isPending);

  // Overlays load on first use and stay mounted afterwards, so they can animate out.
  const [sheet, setSheet] = useState({ mounted: false, open: false });
  // `n` gives every opening a fresh dialog (a second invite for the same person starts clean).
  const [invite, setInvite] = useState<{ resume: Resume; open: boolean; n: number } | null>(null);
  // Invitations sent during this visit, marked on their rows.
  const [invited, setInvited] = useState<ReadonlySet<string>>(() => new Set());

  const applied = appliedFilters(query);
  const filterCount = applied.length;
  const total = meta?.total ?? items.length;
  const countText = !meta
    ? "\u00a0" // keeps the line's height while the first page loads
    : meta.total_capped
      ? t("candidates.totalCapped")
      : t("candidatesPage.count", { count: total, n: groupDigits(total) });
  const sortOptions = [
    ...(query.q ? [{ value: "relevance", label: t("jobs.sortRelevance") }] : []),
    { value: "updated", label: t("candidates.sortUpdated") },
  ];

  // After a chip's × the chip is gone: focus moves to the chip that took its place, or the heading.
  const chipRow = useRef<HTMLUListElement>(null);
  const refocus = useRef<number | null>(null);
  const removeChip = (a: Applied, i: number) => {
    refocus.current = i;
    apply(removeFilter(query, a));
  };
  useLayoutEffect(() => {
    const i = refocus.current;
    if (i == null) return;
    refocus.current = null;
    const buttons = chipRow.current?.querySelectorAll<HTMLButtonElement>("[data-chip] button");
    const next = buttons?.length ? buttons[Math.min(i, buttons.length - 1)] : document.getElementById("cand-results");
    next?.focus({ preventScroll: true });
  }, [query]);

  const openInvite = (resume: Resume) => setInvite((s) => ({ resume, open: true, n: (s?.n ?? 0) + 1 }));
  const inviteButton = (r: Resume, compact?: boolean) => (
    <Button
      type="button"
      variant="soft"
      size="sm"
      icon={<Send className="size-4" />}
      title={compact ? t("candidates.invite") : undefined}
      onPointerEnter={() => void loadInvite()}
      onFocus={() => void loadInvite()}
      onClick={() => openInvite(r)}
      // Phones: above the card's stretched link. Not in the table: it would paint over the sticky header.
      className={cn(!compact && "relative z-10")}
    >
      {/* In the table the label shows from xl; narrower tables keep only the icon. The name
          tells the rows' buttons apart for screen readers (and keeps the visible label in it). */}
      <span className={cn(compact && "max-xl:sr-only")}>{t("candidates.invite")}</span>
      <span className="sr-only">: {r.person.full_name || r.title}</span>
    </Button>
  );

  const columns: DataTableColumn<Resume>[] = [
    { key: COL.who, header: t("candidatesPage.colCandidate"), cell: (r) => <Who r={r} place={placeOf(r)} invited={invited.has(r.id)} /> },
    { key: COL.exp, header: t("candidatesPage.colExperience"), className: "w-36", cell: (r) => <Experience r={r} /> },
    { key: COL.pay, header: t("candidatesPage.colSalary"), align: "end", className: "w-36", cell: (r) => <Pay r={r} /> },
    {
      key: COL.act,
      header: <span className="sr-only">{t("candidatesPage.colActions")}</span>,
      align: "end",
      className: "w-px whitespace-nowrap",
      cell: (r) => inviteButton(r, true),
    },
  ];

  let results: ReactNode;
  if (loading) {
    results = <SkeletonDelay><ResultsSkeleton columns={columns} /></SkeletonDelay>;
  } else if (q.isError && items.length === 0) {
    results = (
      <Card padding="none">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Card>
    );
  } else if (items.length === 0) {
    results = (
      <Card padding="none" className={cn("transition-opacity duration-200", busy && "opacity-60")}>
        <NoResults query={query} applied={applied} label={label} onApply={apply} onRemove={removeChip} />
      </Card>
    );
  } else {
    results = (
      <>
        <DataTable
          rows={items}
          rowKey={(r) => r.id}
          columns={columns}
          caption={t("candidatesPage.results")}
          loading={busy}
          className="anim-fade"
          mobileCard={(r) => <MobileCard r={r} place={placeOf(r)} invited={invited.has(r.id)} action={inviteButton(r)} />}
        />
        {/* A later page (or a background refresh) failed: the rows stay, the retry sits under them. */}
        {q.isError && (
          <ErrorState
            compact
            className="mt-4"
            error={q.error}
            onRetry={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}
          />
        )}
        <LoadMore
          hasNext={q.hasNextPage && !q.isFetchNextPageError}
          loading={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
          loadedCount={items.length}
          className="mt-6"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("account.candidates")} description={t("candidates.hint")} />

      {/* Phones and tablets: a compact search (the keyboard's search key submits) and the
          Filters button; from lg the full bar with its button and the filter panel below. */}
      <div className="flex items-center gap-2">
        <SearchBar
          action="/employer/candidates"
          defaultQuery={query.q ?? ""}
          placeholder={t("candidates.search")}
          onSearch={({ query: text }) => apply(withValue(query, "q", text.trim() || null))}
          className="min-w-0 flex-1 max-lg:p-0 max-lg:[&>button[type=submit]]:hidden"
        />
        <Button
          variant="secondary"
          className="h-11.5 shrink-0 px-3 lg:hidden"
          icon={<SlidersHorizontal className="size-4.5" />}
          aria-haspopup="dialog"
          aria-label={filterCount ? t("candidatesPage.filtersActive", { count: filterCount, n: groupDigits(filterCount) }) : t("common.filters")}
          onClick={() => setSheet({ mounted: true, open: true })}
        >
          <span className="max-sm:hidden">{t("common.filters")}</span>
          {filterCount > 0 && (
            <span aria-hidden="true" className="num grid h-5 min-w-5 place-items-center rounded-pill bg-lapis px-1.5 text-2xs font-semibold text-on-lapis">
              {filterCount}
            </span>
          )}
        </Button>
      </div>

      <Card as="section" aria-labelledby="cand-filters" padding="sm" className="mt-3 hidden lg:block">
        <h2 id="cand-filters" className="sr-only">{t("common.filters")}</h2>
        <Filters q={query} onChange={apply} />
      </Card>

      <section aria-labelledby="cand-results" className="mt-6">
        <h2 id="cand-results" tabIndex={-1} className="sr-only">{t("candidatesPage.results")}</h2>
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
          <p aria-live="polite" className={cn("num mr-auto text-md text-ink-2 transition-opacity duration-200", busy && "opacity-60")}>
            {meta || !loading ? countText : <span aria-hidden="true" className="skeleton anim-delayed inline-block h-4 w-28 align-middle" />}
          </p>
          {sortOptions.length > 1 && (
            <Select
              aria-label={t("jobs.sort")}
              size="sm"
              className="w-52"
              value={query.sort ?? "relevance"}
              onValueChange={(v) => apply(withValue(query, "sort", v))}
              options={sortOptions}
            />
          )}
        </div>

        {applied.length > 0 && (
          // Phones: one sideways-scrolling row; from lg the chips wrap.
          // py-1: a scroller clips vertically too, and focus rings need the room.
          <div className="scrollbar-none edge-mask-x -mx-4 -mb-1 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-1 md:-mx-6 md:px-6 lg:mx-0 lg:overflow-visible lg:px-0 lg:mask-none">
            <ul ref={chipRow} aria-label={t("candidatesPage.applied")} className="flex shrink-0 items-center gap-2 lg:shrink lg:flex-wrap">
              {applied.map((a, i) => (
                <li key={`${a.key}:${a.value}`} data-chip="" className="min-w-0 shrink-0">
                  <FilterChip removeLabel={t("controls.removeFilter", { name: label(a, query) })} onRemove={() => removeChip(a, i)}>
                    {label(a, query)}
                  </FilterChip>
                </li>
              ))}
              <li className="shrink-0">
                <Button variant="ghost" size="sm" shape="pill" className="h-8" onClick={() => apply(clearFilters(query))}>
                  {t("common.clear")}
                </Button>
              </li>
            </ul>
          </div>
        )}

        {meta?.fuzzy && items.length > 0 && !busy && <Callout className="mt-4" role="status">{t("jobs.fuzzy")}</Callout>}

        <div className="mt-4">{results}</div>
      </section>

      {sheet.mounted && (
        <FilterSheet
          open={sheet.open}
          onOpenChange={(open) => setSheet({ mounted: true, open })}
          query={query}
          known={meta && !busy ? { total: meta.total ?? items.length, capped: Boolean(meta.total_capped) } : null}
          onApply={apply}
        />
      )}
      {invite && (
        <Suspense>
          <InviteDialog
            key={invite.n}
            open={invite.open}
            onOpenChange={(open) => setInvite((s) => s && { ...s, open })}
            resumeId={invite.resume.id}
            name={invite.resume.person.full_name ?? ""}
            resumeTitle={invite.resume.title}
            categoryId={invite.resume.category_id}
            onInvited={(id) => setInvited((s) => new Set(s).add(id))}
          />
        </Suspense>
      )}
    </>
  );
}

/* ---- rows ------------------------------------------------------------------------------ */

/** "Toshkent shahri, ko'chishga tayyor" (one catalog index per page, not per row). */
function usePlaceOf() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  return (r: Resume) => {
    const region = r.region_id != null ? nameOf(idx.regions.get(r.region_id)?.name, locale) : "";
    return [region, r.relocate ? t("resume.relocateShort") : ""].filter(Boolean).join(", ");
  };
}

/**
 * One quiet fact with a leading icon. Facts sit in a wrapping row with a gap (no dot
 * separators), so a wrapped line never starts with a stray "·".
 */
function Fact({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      {Icon && <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}
const facts = "flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2";

function Skills({ r, max }: { r: Resume; max: number }) {
  const { t } = useTranslation();
  if (!r.skills.length) return null;
  const more = r.skills.length - max;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-1.5">
      {r.skills.slice(0, max).map((s) => (
        <li key={s.id} className="min-w-0"><Badge tone="outline">{s.name}</Badge></li>
      ))}
      {more > 0 && (
        <li className="num text-xs font-medium text-ink-2">
          <span aria-hidden="true">+{more}</span>
          <span className="sr-only">{t("controls.moreCount", { count: more })}</span>
        </li>
      )}
    </ul>
  );
}

function InvitedBadge() {
  const { t } = useTranslation();
  return <Badge tone="firuza" icon={<Check strokeWidth={2.5} />}>{t("candidatesPage.invited")}</Badge>;
}

/** Table: avatar, resume title (the link), who and where, top skills. */
function Who({ r, place, invited }: { r: Resume; place: string; invited: boolean }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar name={r.person.full_name ?? ""} src={r.person.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <LocalizedLink
          to={`/resumes/${r.id}`}
          prefetch="intent"
          viewTransition
          className="font-semibold text-ink transition-colors duration-150 hover:text-lapis-ink"
        >
          {r.title}
        </LocalizedLink>
        <p className={cn(facts, "mt-0.5")}>
          {r.person.full_name && <Fact>{r.person.full_name}</Fact>}
          {place && <Fact icon={MapPin}>{place}</Fact>}
        </p>
        {(r.skills.length > 0 || invited) && (
          <div className="flex flex-wrap items-center gap-x-2">
            {invited && <div className="mt-2"><InvitedBadge /></div>}
            <Skills r={r} max={3} />
          </div>
        )}
      </div>
    </div>
  );
}

function Experience({ r }: { r: Resume }) {
  const { t } = useTranslation();
  return (
    <>
      <p className="text-ink">{experienceText(r.experience_months, t)}</p>
      {r.last_job && (
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-2" title={`${r.last_job.position}, ${r.last_job.company}`}>
          {r.last_job.position}, {r.last_job.company}
        </p>
      )}
    </>
  );
}

/** Resume freshness (the list is sorted by it); the absolute date is in the title. */
function Updated({ r, className }: { r: Resume; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-ink-2", className)}>
      <Clock aria-hidden="true" className="size-3.5 shrink-0" />
      <RelTime iso={r.updated_at} className="truncate" />
    </span>
  );
}

function Pay({ r }: { r: Resume }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = r.desired_salary;
  return (
    <>
      {s?.amount ? (
        <p className="num whitespace-nowrap font-display font-semibold tracking-heading text-firuza-ink">
          {money(s.amount, s.currency === "USD" ? "USD" : "UZS", t, locale)}
        </p>
      ) : (
        // No expectation isn't money: quiet text, never firuza.
        <p className="text-sm text-ink-2">{t("candidatesPage.salaryNone")}</p>
      )}
      <Updated r={r} className="mt-1 justify-end text-xs" />
    </>
  );
}

/** Phones: the whole card opens the resume; Invite sits above the stretched link. */
function MobileCard({ r, place, invited, action }: { r: Resume; place: string; invited: boolean; action: ReactNode }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const s = r.desired_salary;
  const exp = r.experience_months > 0 ? t("candidatesPage.experience", { value: experienceText(r.experience_months, t) }) : t("enums.experience.none");
  return (
    // -m-4 p-4: the link's hit area covers the list card's padding too. The focus ring and
    // the pressed tint follow the stretched link, not the Invite button.
    <div className="relative -m-4 rounded-panel p-4 transition-colors duration-150 has-[[data-card-link]:active]:bg-sunken/60 has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-offset-2 has-[[data-card-link]:focus-visible]:outline-focus">
      <div className="flex items-start gap-3">
        <Avatar name={r.person.full_name ?? ""} src={r.person.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lead font-semibold tracking-snug text-ink">
            <CardLink to={`/resumes/${r.id}`} prefetch="intent" viewTransition>{r.title}</CardLink>
          </h3>
          <p className="truncate text-sm text-ink-2">{r.person.full_name}</p>
        </div>
      </div>
      {s?.amount ? (
        <p className="num mt-3 font-display text-lg font-semibold tracking-heading text-firuza-ink">
          {money(s.amount, s.currency === "USD" ? "USD" : "UZS", t, locale)}
        </p>
      ) : null}
      <p className={cn(facts, "mt-2")}>
        <Fact icon={BriefcaseBusiness}>{exp}</Fact>
        {place && <Fact icon={MapPin}>{place}</Fact>}
      </p>
      {r.last_job && (
        <p className="mt-0.5 truncate text-sm text-ink-2">
          {t("candidatesPage.lastJob", { job: `${r.last_job.position}, ${r.last_job.company}` })}
        </p>
      )}
      <Skills r={r} max={4} />
      <div className="mt-4 flex items-center justify-between gap-3">
        {invited ? <InvitedBadge /> : <Updated r={r} className="text-sm" />}
        {action}
      </div>
    </div>
  );
}

/** Same table (real header, same column widths) and the same phone cards, in grey. */
function ResultsSkeleton({ columns }: { columns: DataTableColumn<Resume>[] }) {
  const { t } = useTranslation();
  const cells: Record<string, () => ReactNode> = {
    [COL.who]: () => (
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 pt-1">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="mt-2.5 h-3.5 w-2/5" />
          <div className="mt-3 flex gap-1.5">
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>
    ),
    [COL.exp]: () => (
      <>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2.5 h-3.5 w-24" />
      </>
    ),
    [COL.pay]: () => (
      <>
        <Skeleton className="ml-auto h-4 w-20" />
        <Skeleton className="ml-auto mt-2 h-3 w-16" />
      </>
    ),
    [COL.act]: () => <Skeleton className="ml-auto h-9 w-10 rounded-control xl:w-36" />,
  };
  return (
    <div role="status">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true">
        <DataTable
          rows={[0, 1, 2, 3, 4]}
          rowKey={String}
          columns={columns.map((c) => ({ ...c, cell: cells[c.key] }))}
          mobileCard={() => (
            <>
              <div className="flex items-start gap-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 pt-1">
                  <Skeleton className="h-4.5 w-3/4" />
                  <Skeleton className="mt-2.5 h-3.5 w-1/3" />
                </div>
              </div>
              <Skeleton className="mt-4 h-5 w-28" />
              <Skeleton className="mt-3 h-3.5 w-2/3" />
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-36 rounded-control" />
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
}

/* ---- empty ------------------------------------------------------------------------------- */

/** Nothing matched: say why and offer a one-tap way out for every applied condition. */
function NoResults({ query, applied, label, onApply, onRemove }: {
  query: Query;
  applied: Applied[];
  label: (a: Applied, q: Query) => string;
  onApply: (next: Query) => void;
  onRemove: (a: Applied, i: number) => void;
}) {
  const { t } = useTranslation();
  if (!query.q && applied.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound />}
        headingAs="h3"
        title={t("candidatesPage.emptyTitle")}
        body={t("candidatesPage.emptyBody")}
        action={<Button asChild variant="secondary"><LocalizedLink to="/employer/vacancies/new">{t("nav.postVacancy")}</LocalizedLink></Button>}
      />
    );
  }
  return (
    <EmptyState
      icon={<SearchX />}
      headingAs="h3"
      title={query.q ? t("candidatesPage.noMatchQuery", { q: query.q }) : t("candidatesPage.noMatchTitle")}
      body={t("candidatesPage.noMatchBody")}
      action={
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex max-w-lg flex-col items-center gap-2.5">
            <p className="text-sm text-ink-2">{t("candidatesPage.tryRemoving")}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {query.q && (
                <li className="min-w-0">
                  <FilterChip removeLabel={t("candidatesPage.removeQuery", { q: query.q })} onRemove={() => onApply(withValue(query, "q", null))}>
                    {t("candidatesPage.quoted", { q: query.q })}
                  </FilterChip>
                </li>
              )}
              {applied.map((a, i) => (
                <li key={`${a.key}:${a.value}`} className="min-w-0">
                  <FilterChip removeLabel={t("controls.removeFilter", { name: label(a, query) })} onRemove={() => onRemove(a, i)}>
                    {label(a, query)}
                  </FilterChip>
                </li>
              ))}
            </ul>
          </div>
          {applied.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => onApply(clearFilters(query))}>{t("jobs.filters.clear")}</Button>
          )}
        </div>
      }
    />
  );
}

/* ---- filters ----------------------------------------------------------------------------- */

/**
 * The filter controls. Desktop panel (`sheet` off): a row of fields and a row of chips, every
 * change applies at once and the salary on blur/Enter. Sheet: stacked sections that edit a
 * draft, so the salary reports every keystroke.
 */
function Filters({ q, onChange, sheet }: { q: Query; onChange: (next: Query) => void; sheet?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { categories, regions } = useCatalog();
  const ids = useId();

  const categoryGroups = categories.map((c) => ({
    label: nameOf(c.name, locale),
    options: [
      { value: String(c.id), label: t("jobs.filters.allIn", { name: nameOf(c.name, locale) }) },
      ...(c.children ?? []).map((ch) => ({ value: String(ch.id), label: nameOf(ch.name, locale) })),
    ],
  }));
  const salaryTo = q.salary_to ? Number(q.salary_to) : null;
  // The URL keeps a currency only next to an amount; one picked before typing waits here.
  const [early, setEarly] = useState<Currency>("UZS");
  const currency: Currency = sheet || salaryTo != null ? (q.currency === "USD" ? "USD" : "UZS") : early;
  // Not normalized here: the draft keeps its currency while the amount is empty (apply() cleans up).
  const setSalary = (v: number | null) => onChange({ ...q, salary_to: v == null ? undefined : String(v), currency });
  const setCurrency = (c: Currency) => (sheet || salaryTo != null ? onChange({ ...q, currency: c }) : setEarly(c));

  const relocate = q.region_id ? (
    <Checkbox
      checked={q.with_relocate === "true"}
      onCheckedChange={(v) => onChange(withValue(q, "with_relocate", v ? "true" : null))}
      label={t("candidates.withRelocate")}
    />
  ) : null;

  const category = (
    <Field label={t("jobs.filters.category")}>
      <Select value={q.category_id ?? ""} onValueChange={(v) => onChange(withValue(q, "category_id", v))} placeholder={t("jobs.filters.anyCategory")} groups={categoryGroups} />
    </Field>
  );
  const region = (
    <Field label={t("jobs.filters.region")}>
      <Select
        value={q.region_id ?? ""}
        onValueChange={(v) => onChange(withValue(q, "region_id", v))}
        placeholder={t("search.anywhere")}
        options={regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }))}
      />
    </Field>
  );
  const language = (
    <Field label={t("resume.language")}>
      <Select
        value={q.language ?? ""}
        onValueChange={(v) => onChange(withValue(q, "language", v))}
        placeholder={t("candidates.anyLanguage")}
        options={LANGS.map((l) => ({ value: l, label: t(`langs.${l}`) }))}
      />
    </Field>
  );
  const budget = (
    <Field label={t("candidatesPage.budget")}>
      {sheet ? (
        <MoneyInput value={salaryTo} onChange={setSalary} currency={currency} onCurrencyChange={setCurrency} placeholder={groupDigits(15_000_000)} />
      ) : (
        // Uncontrolled: typing doesn't refetch; the filter applies on Enter or blur. Keyed so a
        // chip removal or the back button resets the text.
        <MoneyInput
          key={q.salary_to ?? ""}
          defaultValue={salaryTo}
          onCommit={setSalary}
          currency={currency}
          onCurrencyChange={setCurrency}
          placeholder={groupDigits(15_000_000)}
        />
      )}
    </Field>
  );
  const chips = (field: "experience" | "work_format", values: readonly string[]) => {
    const selected = multi(q, field);
    return values.map((v) => (
      <Chip key={v} selected={selected.includes(v)} onClick={() => onChange(toggleMulti(q, field, v))}>
        {t(`enums.${field}.${v}`)}
      </Chip>
    ));
  };

  if (sheet) {
    return (
      <div className="flex flex-col">
        <Group>{category}</Group>
        <Group>
          {region}
          {relocate && <div className="mt-2">{relocate}</div>}
        </Group>
        <Group>{language}</Group>
        <Group>{budget}</Group>
        <Group legend={t("jobs.filters.experience")}><div className="flex flex-wrap gap-2">{chips("experience", EXPERIENCE)}</div></Group>
        <Group legend={t("jobs.filters.format")}><div className="flex flex-wrap gap-2">{chips("work_format", FORMATS)}</div></Group>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {category}
        {region}
        {language}
        {budget}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
        <div role="group" aria-labelledby={`${ids}-exp`} className="flex flex-wrap items-center gap-2">
          <span id={`${ids}-exp`} className="mr-1 text-sm font-medium text-ink">{t("jobs.filters.experience")}</span>
          {chips("experience", EXPERIENCE)}
        </div>
        <div role="group" aria-labelledby={`${ids}-fmt`} className="flex flex-wrap items-center gap-2">
          <span id={`${ids}-fmt`} className="mr-1 text-sm font-medium text-ink">{t("jobs.filters.format")}</span>
          {chips("work_format", FORMATS)}
        </div>
        {relocate}
      </div>
    </>
  );
}

/** One sheet section; hairlines between sections keep a long panel scannable. */
function Group({ legend, children }: { legend?: string; children: ReactNode }) {
  const cls = "min-w-0 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0";
  // A floated legend is laid out like a normal heading, so the hairline above stays unbroken.
  if (!legend) return <div className={cls}>{children}</div>;
  return (
    <fieldset className={cls}>
      <legend className="float-left mb-2.5 w-full text-sm font-medium text-ink">{legend}</legend>
      <div className="clear-left">{children}</div>
    </fieldset>
  );
}

/* ---- mobile / tablet filter sheet ------------------------------------------------------------ */

/**
 * Changes collect in a draft and apply on "Show N": a live count for the draft (one `limit=1`
 * request, 250 ms after the last change). While it runs the old number stays, dimmed; if it
 * fails the button falls back to a plain label.
 */
function FilterSheet({ open, onOpenChange, query, known, onApply }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: Query;
  /** The applied query's own count, when it's on screen. */
  known: { total: number; capped: boolean } | null;
  onApply: (next: Query) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(query);
  // Every opening starts from the applied filters (a dismissed sheet discards its draft).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(query);
  }

  const draftKey = keyOf({ ...draft, sort: undefined });
  const appliedKey = keyOf({ ...query, sort: undefined });
  const [debounced, setDebounced] = useState(draftKey);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draftKey), 250);
    return () => clearTimeout(timer);
  }, [draftKey]);

  const count = useQuery({
    queryKey: ["candidates-count", debounced],
    enabled: open && debounced !== appliedKey,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const page = await authedPage<Resume>(() =>
        api.GET("/resumes", { params: { query: { ...(Object.fromEntries(new URLSearchParams(debounced)) as Record<string, never>), limit: 1 } }, signal }));
      const meta = page.meta as Meta;
      return { total: meta.total ?? 0, capped: Boolean(meta.total_capped) };
    },
  });

  const same = draftKey === appliedKey;
  const value = same ? known : count.isError ? null : (count.data ?? known);
  const pending = !same && (debounced !== draftKey || count.isFetching);
  const text = !value
    ? t("jobs.filters.show")
    : value.capped
      ? t("candidatesPage.showCapped")
      : value.total === 0
        ? t("candidatesPage.showNone")
        : t("candidatesPage.show", { count: value.total, n: groupDigits(value.total) });

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t("common.filters")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="secondary" disabled={appliedFilters(draft).length === 0} onClick={() => setDraft(clearFilters(draft))}>
              {t("common.clear")}
            </Button>
            <Button
              className="min-w-0 flex-1"
              onClick={() => {
                onApply(draft);
                onOpenChange(false);
              }}
            >
              <span aria-live="polite" className={cn("num truncate transition-opacity duration-200", pending && "opacity-60")}>
                {text}
              </span>
            </Button>
          </>
        }
      >
        <Filters q={draft} onChange={setDraft} sheet />
      </SheetContent>
    </DialogRoot>
  );
}
