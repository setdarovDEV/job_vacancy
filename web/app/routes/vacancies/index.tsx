import { ArrowDownUp, BellPlus, Check, Plus, SearchX, SlidersHorizontal } from "lucide-react";
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation, useNavigate, useNavigation, useRevalidator, useSearchParams } from "react-router";

import type { Route } from "./+types/index";
import type { ShellHandle } from "../site";
import { api, apiError, type ApiError, type Schemas } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { indexCatalog, nameOf, useCatalog, type Catalog } from "~/shared/catalog/catalog";
import { localizedPath, type Locale } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits, money } from "~/shared/lib/format";
import { LoadMore } from "~/shared/query/LoadMore";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { Button, IconButton } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card } from "~/shared/ui/Card";
import { Chip } from "~/shared/ui/Chip";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { FilterChip } from "~/shared/ui/FilterChip";
import { Popover, popoverItem } from "~/shared/ui/Popover";
import { SearchBar } from "~/shared/ui/SearchBar";
import { Select } from "~/shared/ui/Select";
import { toast } from "~/shared/ui/toast-store";
import { VacancyList, VacancyListSkeleton } from "~/shared/vacancy/VacancyRow";
import { Filters } from "./Filters";
import {
  activeCount, addFilter, apiQuery, appliedFilters, canonicalSearch, clearFilters, hasFilter, QUICK, removeFilter,
  withValue, type Applied, type Query,
} from "./params";

const SaveSearchDialog = lazy(() => import("./SaveSearchDialog"));
const loadSheet = () => import("./FilterSheet");
const FilterSheet = lazy(loadSheet);

type Card = Schemas["VacancyCard"];
type Meta = { next_cursor?: string | null; total?: number; total_capped?: boolean; fuzzy?: boolean };
/** Why the list couldn't load: the API's error envelope, or status 0 when it was unreachable. */
type Failure = { status: number; error: ApiError | null };

// Chips in the applied row are 32px (FilterChip's height); on touch their hit area grows to 44px.
const chipHit = "h-8 pointer-coarse:after:-inset-y-1.5";

// Long list: on phones the site header slides away while scrolling down; the filter bar docks.
export const handle: ShellHandle = { autoHideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = apiQuery(url.searchParams);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  try {
    const res = await api.GET("/vacancies", {
      params: { query: { ...(query as Record<string, never>), cursor } },
      headers: forwardHeaders(request),
    });
    // 400/422 = parameters the API rejects (a hand-edited URL, a stale cursor): that's "no
    // results", not an outage, and retrying wouldn't help.
    const failure: Failure | null = !res.response.ok && res.response.status !== 400 && res.response.status !== 422
      ? { status: res.response.status, error: apiError(res) }
      : null;
    return { items: (res.data?.data ?? []) as Card[], meta: (res.data?.meta ?? {}) as Meta, query, failure };
  } catch {
    return { items: [] as Card[], meta: {} as Meta, query, failure: { status: 0, error: null } as Failure | null };
  }
}

export function meta({ matches, location, loaderData: data }: Route.MetaArgs) {
  const { t, locale } = metaT(matches);
  const q = data?.query ?? {};
  // Category and region pages are indexed: each gets its own title ("Buxgalteriya, Toshkent
  // shahri: vakansiyalar"), not one "Vakansiyalar" shared by all of them.
  const catalog = (matches.find((m) => m?.id === "root")?.loaderData as { catalog?: Catalog } | undefined)?.catalog;
  const context = headingOf(q, catalog ? indexCatalog(catalog) : null, locale);
  const title = context ? `${context}: ${t("jobs.title").toLowerCase()}` : t("jobs.title");
  // Only the plain list, category and region pages are worth indexing.
  const indexable = Object.keys(q).every((k) => k === "category_id" || k === "region_id");
  const keep = canonicalSearch(q, Object.keys(q).filter((k) => k !== "category_id" && k !== "region_id"));
  return seo({
    title: `${title} | Job Vacancy`,
    description: t("hero.subtitle"),
    path: location.pathname + (keep ? `?${keep}` : ""),
    noindex: !indexable,
  });
}

export default function Vacancies({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { query, meta, failure } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const { status } = useSession();

  // A filter change in flight: the controls, chips and heading already show where it's going
  // (instant feedback), while the old results stay on screen, dimmed, until the new ones land.
  const pendingSearch =
    navigation.state === "loading" && navigation.location.pathname === location.pathname ? navigation.location.search : null;
  const shown = useMemo(() => (pendingSearch != null ? apiQuery(new URLSearchParams(pendingSearch)) : query), [pendingSearch, query]);
  const busy = pendingSearch != null;
  // Different search words make the old results meaningless: those get skeletons instead.
  const skeleton = useSlowFlag(busy && (shown.q ?? "") !== (query.q ?? ""));

  // Which result set staggers in: the first paint, and results that replace a skeleton. A filter
  // tweak swaps dimmed results in place; a fade-up from 0 there would flash the whole list out.
  const [fresh, setFresh] = useState<string | null>(location.search);
  if (skeleton && pendingSearch != null && fresh !== pendingSearch) setFresh(pendingSearch);
  else if (fresh != null && fresh !== location.search && fresh !== pendingSearch) setFresh(null);

  // Pages fetched with "Load more" append to the server-rendered first page; a new
  // search (different URL) starts over.
  const more = useFetcher<typeof loader>();
  const [pages, setPages] = useState<{ key: string; items: Card[]; cursor: string | null | undefined }>({
    key: location.search, items: [], cursor: meta.next_cursor,
  });
  if (pages.key !== location.search) setPages({ key: location.search, items: [], cursor: meta.next_cursor });
  useEffect(() => {
    const d = more.data;
    if (!d || more.state !== "idle") return;
    if (d.failure) {
      toast({ tone: "error", title: t(d.failure.status === 0 ? "errors.network" : "errors.internal_error") });
      return;
    }
    setPages((p) => ({ ...p, items: [...p.items, ...d.items], cursor: d.meta.next_cursor }));
    // Runs once per finished load (`t` only changes with the language, which reloads the page).
  }, [more.data, more.state]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...loaderData.items, ...pages.items].filter((v) => !seen.has(v.id) && seen.add(v.id));
  }, [loaderData.items, pages.items]);

  const results = useRef<HTMLElement>(null);
  const apply = (next: Query) => {
    setSearchParams(next, { preventScrollReset: true });
    // Deep in the list, new results would start mid-page: bring the results' top into view. Its
    // scroll margin is the sticky chrome above it, so "hidden under the header" counts as out of view.
    const el = results.current;
    if (el && el.getBoundingClientRect().top < (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)) {
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  };

  const filterCount = activeCount(shown);
  const heading = useHeading(shown);
  const label = useFilterLabel(items);
  const applied = appliedFilters(shown);
  const quick = QUICK.filter((a) => !hasFilter(shown, a));
  const sortOptions = [
    ...(shown.q ? [{ value: "relevance", label: t("jobs.sortRelevance") }] : []),
    { value: "newest", label: t("jobs.sortNewest") },
  ];
  // "relevance" means nothing without search words (e.g. a query removed from a relevance URL).
  const sort = sortOptions.some((o) => o.value === shown.sort) ? shown.sort! : sortOptions[0].value;
  const setSort = (v: string) => apply({ ...shown, sort: v });
  const total = meta.total ?? items.length;
  const countText = meta.total_capped ? t("jobs.totalCapped") : t("vacanciesPage.count", { count: total, n: groupDigits(total) });
  const quoted = (q: string) => t("vacanciesPage.quoted", { q });
  // The empty state carries its own "Save search" as the way forward: one on screen is enough.
  const emptyShown = !skeleton && !failure && items.length === 0;

  // After a chip's × the chip is gone: focus moves to the chip that took its place, or the heading
  // (-1: straight to the heading, e.g. after the search words were removed).
  const chipRow = useRef<HTMLUListElement>(null);
  const refocus = useRef<number | null>(null);
  const removeChip = (a: Applied, i: number) => {
    refocus.current = i;
    apply(removeFilter(shown, a));
  };
  const removeQuery = () => {
    refocus.current = -1;
    apply(withValue(shown, "q", null));
  };
  useLayoutEffect(() => {
    const i = refocus.current;
    if (i == null) return;
    refocus.current = null;
    const buttons = i < 0 ? null : chipRow.current?.querySelectorAll<HTMLButtonElement>("[data-chip] button");
    const next = buttons?.length ? buttons[Math.min(i, buttons.length - 1)] : document.getElementById("results-title");
    next?.focus({ preventScroll: true });
  }, [shown]);

  const loadMore = () => {
    if (!pages.cursor) return;
    const sp = new URLSearchParams(canonicalSearch(query));
    sp.set("cursor", pages.cursor);
    more.load(`${location.pathname}?${sp}`);
  };

  // Overlays load on first use and stay mounted afterwards, so they can animate out.
  const [sheet, setSheet] = useState({ mounted: false, open: false });
  const [save, setSave] = useState({ mounted: false, open: false });
  const openSave = () => {
    if (status !== "authed") {
      navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setSave({ mounted: true, open: true });
  };
  const prefetchSheet = () => void loadSheet();

  const saveButton = (
    <Button variant="soft" size="sm" icon={<BellPlus className="size-4" />} onClick={openSave}>
      {t("jobs.saveSearch")}
    </Button>
  );

  return (
    <>
      {/* Phones and tablets: search, filters and sort stay at hand in a glass bar under the header. */}
      <div className="glass-bar sticky top-(--header-h) z-30 autohide-follow lg:hidden">
        <div className="container-page flex items-center gap-2 py-2">
          <SearchBar
            action="/vacancies"
            defaultQuery={query.q ?? ""}
            extraParams={query}
            suggest
            recent
            // Compact: the keyboard's search key submits, so the field gets the room of the button.
            className="min-w-0 flex-1 p-0 [&>button[type=submit]]:hidden"
          />
          <Button
            variant="secondary"
            className="h-11.5 shrink-0 px-3"
            icon={<SlidersHorizontal className="size-4.5" />}
            aria-haspopup="dialog"
            aria-label={filterCount ? t("vacanciesPage.filtersActive", { count: filterCount, n: groupDigits(filterCount) }) : t("common.filters")}
            onPointerEnter={prefetchSheet}
            onFocus={prefetchSheet}
            onClick={() => setSheet({ mounted: true, open: true })}
          >
            <span className="max-sm:hidden">{t("common.filters")}</span>
            {filterCount > 0 && (
              <span aria-hidden="true" className="num grid h-5 min-w-5 place-items-center rounded-pill bg-lapis px-1.5 text-2xs font-semibold text-on-lapis">
                {filterCount}
              </span>
            )}
          </Button>
          {sortOptions.length > 1 && (
            <Popover
              label={t("jobs.sort")}
              className="w-60"
              trigger={(p) => (
                <IconButton {...p} label={t("jobs.sort")} variant="secondary" className="size-11.5 shrink-0">
                  <ArrowDownUp className="size-4.5" />
                </IconButton>
              )}
            >
              {sortOptions.map((o) => (
                <button key={o.value} type="button" aria-pressed={o.value === sort} className={popoverItem} onClick={() => setSort(o.value)}>
                  <span className="min-w-0 flex-1">{o.label}</span>
                  {o.value === sort && <Check className="size-4 shrink-0 text-lapis" strokeWidth={2.5} aria-hidden="true" />}
                </button>
              ))}
            </Popover>
          )}
        </div>
      </div>

      <div className="container-page pb-16 pt-6 md:pb-24 md:pt-8 lg:pt-10">
        <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-8">
          <aside aria-labelledby="filters-title" className="hidden lg:block">
            {/* Taller than the screen on laptops: the panel scrolls inside, its header stays. */}
            <Card padding="none" className="sticky top-24 flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden">
              <div className="flex min-h-15 shrink-0 items-center justify-between gap-2 border-b border-line px-5 py-3">
                <h2 id="filters-title" className="font-display text-lg font-semibold tracking-heading text-ink">{t("common.filters")}</h2>
                {filterCount > 0 && (
                  <Button variant="ghost" size="sm" className="-mr-2" onClick={() => apply(clearFilters(shown))}>{t("common.clear")}</Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
                <Filters q={shown} onChange={apply} />
              </div>
            </Card>
          </aside>

          <section ref={results} id="results" aria-labelledby="results-title" className="min-w-0 max-lg:scroll-mt-36">
            <div className="mb-6 hidden lg:block">
              <SearchBar action="/vacancies" defaultQuery={query.q ?? ""} extraParams={query} suggest recent />
            </div>

            <header>
              <h1 id="results-title" tabIndex={-1} className="break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">
                {heading}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                {/* No `num`: Onest's tabular "1" is as wide as a "0", so "111" read as "1 1 1". */}
                <p aria-live="polite" className={cn("mr-auto text-md text-ink-2 transition-opacity duration-200", busy && "opacity-60")}>
                  {/* A new search has no count yet: a bar, not the previous search's number. */}
                  {skeleton ? <span aria-hidden="true" className="skeleton inline-block h-4 w-28 align-middle" /> : failure ? "" : countText}
                </p>
                <Select
                  aria-label={t("jobs.sort")}
                  size="sm"
                  className="w-48 max-lg:hidden"
                  value={sort}
                  onValueChange={setSort}
                  options={sortOptions}
                />
                {!emptyShown && saveButton}
              </div>

              {(applied.length > 0 || quick.length > 0) && (
                // Phones: one sideways-scrolling row (applied chips, then one-tap suggestions);
                // desktop: the applied chips wrap, the sidebar has the rest.
                <div
                  className={cn(
                    // py-1.5: a scroller clips vertically too; the 32px chips' 44px touch areas and
                    // focus rings need the room. scroll-px-8: a chip focused by Tab stops clear of
                    // the faded edges.
                    "scrollbar-none edge-mask-x -mx-4 -mb-1.5 mt-2.5 flex scroll-px-8 gap-2 overflow-x-auto overscroll-x-contain px-4 py-1.5 md:-mx-6 md:px-6",
                    "lg:mx-0 lg:overflow-visible lg:px-0 lg:mask-none",
                    applied.length === 0 && "lg:hidden",
                  )}
                >
                  {applied.length > 0 && (
                    <ul ref={chipRow} aria-label={t("vacanciesPage.applied")} className="flex shrink-0 items-center gap-2 lg:shrink lg:flex-wrap">
                      {applied.map((a, i) => (
                        <li key={`${a.key}:${a.value}`} data-chip="" className="min-w-0 shrink-0">
                          <FilterChip removeLabel={t("controls.removeFilter", { name: label(a) })} onRemove={() => removeChip(a, i)}>
                            {label(a)}
                          </FilterChip>
                        </li>
                      ))}
                      <li className="shrink-0">
                        <Button variant="ghost" size="sm" shape="pill" className={chipHit} onClick={() => apply(clearFilters(shown))}>
                          {t("common.clear")}
                        </Button>
                      </li>
                    </ul>
                  )}
                  {quick.length > 0 && (
                    <ul aria-label={t("vacanciesPage.quick")} className="flex shrink-0 items-center gap-2 lg:hidden">
                      {quick.map((a) => (
                        <li key={`${a.key}:${a.value}`} className="shrink-0">
                          <Chip
                            className={cn(chipHit, "pl-2.5")}
                            aria-label={t("vacanciesPage.addFilter", { name: label(a) })}
                            onClick={() => apply(addFilter(shown, a))}
                          >
                            <Plus className="mr-1 size-3.5" strokeWidth={2.5} aria-hidden="true" />
                            {label(a)}
                          </Chip>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </header>

            {meta.fuzzy && items.length > 0 && !busy && !failure && (
              <Callout className="mt-5" role="status">{t("jobs.fuzzy")}</Callout>
            )}

            <div className="mt-5" aria-busy={busy || undefined}>
              {skeleton ? (
                <VacancyListSkeleton count={4} />
              ) : failure ? (
                <Card padding="none">
                  <ErrorState
                    error={failure.error ?? (failure.status === 0 ? new TypeError("network") : { status: failure.status })}
                    onRetry={() => revalidator.revalidate()}
                  />
                </Card>
              ) : items.length > 0 ? (
                <div className={cn("transition-opacity duration-200", busy && "opacity-60")}>
                  <VacancyList key={location.search} items={items} enter={fresh === location.search ? loaderData.items.length : 0} headingAs="h2" />
                  <LoadMore
                    hasNext={Boolean(pages.cursor)}
                    loading={more.state !== "idle"}
                    onClick={loadMore}
                    loadedCount={items.length}
                    className={pages.cursor ? "mt-6" : undefined}
                  />
                </div>
              ) : (
                <Card padding="none" className={cn("transition-opacity duration-200", busy && "opacity-60")}>
                  <NoResults
                    query={shown}
                    applied={applied}
                    label={label}
                    quoted={quoted}
                    onApply={apply}
                    onRemove={removeChip}
                    onRemoveQuery={removeQuery}
                    saveButton={saveButton}
                  />
                </Card>
              )}
            </div>
          </section>
        </div>
      </div>

      {sheet.mounted && (
        <Suspense>
          <FilterSheet
            open={sheet.open}
            onOpenChange={(open) => setSheet({ mounted: true, open })}
            query={query}
            total={failure ? undefined : meta.total}
            capped={Boolean(meta.total_capped)}
            onApply={apply}
          />
        </Suspense>
      )}
      {save.mounted && (
        <Suspense>
          <SaveSearchDialog
            open={save.open}
            onOpenChange={(open) => setSave({ mounted: true, open })}
            query={query}
            defaultName={heading}
            summary={[...(query.q ? [quoted(query.q)] : []), ...appliedFilters(query).map(label)]}
          />
        </Suspense>
      )}
    </>
  );
}

/** Nothing matched: say why and offer a one-tap way out for every applied condition. */
function NoResults({
  query, applied, label, quoted, onApply, onRemove, onRemoveQuery, saveButton,
}: {
  query: Query;
  applied: Applied[];
  label: (a: Applied) => string;
  quoted: (q: string) => string;
  onApply: (next: Query) => void;
  onRemove: (a: Applied, i: number) => void;
  onRemoveQuery: () => void;
  saveButton: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (!query.q && applied.length === 0) {
    return (
      <EmptyState icon={<SearchX />} headingAs="h2" title={t("empty.vacanciesTitle")} body={t("empty.vacanciesBody")} action={saveButton} />
    );
  }
  return (
    <EmptyState
      icon={<SearchX />}
      headingAs="h2"
      title={query.q ? t("vacanciesPage.noMatchQuery", { q: query.q }) : t("vacanciesPage.noMatchTitle")}
      body={t("vacanciesPage.noMatchBody")}
      action={
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex max-w-lg flex-col items-center gap-2.5">
            <p className="text-sm text-ink-2">{t("vacanciesPage.tryRemoving")}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {query.q && (
                <li className="min-w-0">
                  <FilterChip removeLabel={t("vacanciesPage.removeQuery", { q: query.q })} onRemove={onRemoveQuery}>
                    {quoted(query.q)}
                  </FilterChip>
                </li>
              )}
              {applied.map((a, i) => (
                <li key={`${a.key}:${a.value}`} className="min-w-0">
                  <FilterChip removeLabel={t("controls.removeFilter", { name: label(a) })} onRemove={() => onRemove(a, i)}>
                    {label(a)}
                  </FilterChip>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {applied.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => onApply(clearFilters(query))}>{t("jobs.filters.clear")}</Button>
            )}
            {saveButton}
          </div>
        </div>
      }
    />
  );
}

/**
 * True once `active` has lasted 150 ms (fast answers never flash a skeleton), then held for at
 * least 300 ms so a skeleton that did appear doesn't flicker away.
 */
function useSlowFlag(active: boolean, delay = 150, min = 300) {
  const [on, setOn] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    if (active) {
      if (on) return;
      const timer = setTimeout(() => {
        since.current = performance.now();
        setOn(true);
      }, delay);
      return () => clearTimeout(timer);
    }
    if (!on) return;
    const timer = setTimeout(() => setOn(false), Math.max(0, min - (performance.now() - since.current)));
    return () => clearTimeout(timer);
  }, [active, on, delay, min]);
  return on;
}

/** Chip text for one applied filter, in the UI language. */
function useFilterLabel(items: Card[]) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  return (a: Applied): string => {
    switch (a.key) {
      case "category_id":
        return nameOf(idx.categories.get(Number(a.value))?.name, locale) || t("jobs.filters.category");
      case "region_id":
      case "district_id":
        return nameOf(idx.regions.get(Number(a.value))?.name, locale) || t("jobs.filters.region");
      case "company_id":
        // Company pages link here with company_id; the cards on screen carry its name.
        return items.find((v) => v.company.id === a.value)?.company.name ?? t("vacanciesPage.company");
      case "salary_from": {
        // money() rounds to "13 mln"; a chip must say exactly what filters (12 500 000).
        const n = Number(a.value);
        const m = n / 1e6;
        const exact = n < 1e6 || (m < 10 ? Number.isInteger(m * 10) : Number.isInteger(m));
        return t("salary.from", { amount: exact ? money(n, "UZS", t, locale) : `${groupDigits(n)}\u00a0${t("salary.currency.UZS")}` });
      }
      case "with_salary":
        return t("vacanciesPage.withSalary");
      default: {
        const key = `enums.${a.key}.${a.value}`;
        const text = t(key);
        return text === key ? a.value : text;
      }
    }
  };
}

/** "Dasturchi, Toshkent" from the search words (else the category) and the place; "" for none. */
function headingOf(q: Query, idx: ReturnType<typeof indexCatalog> | null, locale: Locale) {
  const parts: string[] = [];
  if (q.q) parts.push(q.q[0].toUpperCase() + q.q.slice(1));
  else if (q.category_id && idx) parts.push(nameOf(idx.categories.get(Number(q.category_id))?.name, locale));
  const place = q.district_id ?? q.region_id;
  if (place && idx) parts.push(nameOf(idx.regions.get(Number(place))?.name, locale));
  return parts.filter(Boolean).join(", ");
}

/** The page H1: the search context, else "Vacancies". */
function useHeading(q: Query) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  return headingOf(q, idx, locale) || t("jobs.title");
}
