import { BellPlus, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Form, useFetcher, useLocation, useNavigate, useNavigation, useSearchParams } from "react-router";

import type { Route } from "./+types/index";
import { api, type Schemas } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { VacancyRow } from "~/shared/vacancy/VacancyRow";
import { Button } from "~/shared/ui/Button";
import { DialogRoot, SheetContent } from "~/shared/ui/Dialog";
import { EmptyState } from "~/shared/ui/EmptyState";
import { Select } from "~/shared/ui/Select";
import { Filters } from "./Filters";
import { activeCount, apiQuery, canonicalSearch } from "./params";

const SaveSearchDialog = lazy(() => import("./SaveSearchDialog"));

type Card = Schemas["VacancyCard"];
type Meta = { next_cursor?: string | null; total?: number; total_capped?: boolean; fuzzy?: boolean };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const query = apiQuery(url.searchParams);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  try {
    const res = await api.GET("/vacancies", {
      params: { query: { ...(query as Record<string, never>), cursor } },
      headers: forwardHeaders(request),
    });
    return { items: (res.data?.data ?? []) as Card[], meta: (res.data?.meta ?? {}) as Meta, query, failed: !res.response.ok && res.response.status !== 422 };
  } catch {
    return { items: [] as Card[], meta: {} as Meta, query, failed: true };
  }
}

export function meta({ matches, location, loaderData: data }: Route.MetaArgs) {
  const { t } = metaT(matches);
  const q = data?.query ?? {};
  const title = q.q ? `${q.q[0].toUpperCase()}${q.q.slice(1)}: ${t("jobs.title").toLowerCase()}` : t("jobs.title");
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
  const { query, meta } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(query);
  const [saveOpen, setSaveOpen] = useState(false);
  const { status } = useSession();
  const navigate = useNavigate();

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
    setPages((p) => ({ ...p, items: [...p.items, ...d.items], cursor: d.meta.next_cursor }));
  }, [more.data, more.state]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...loaderData.items, ...pages.items].filter((v) => !seen.has(v.id) && seen.add(v.id));
  }, [loaderData.items, pages.items]);

  const apply = (next: Record<string, string>) => setSearchParams(next, { preventScrollReset: true });
  const busy = navigation.state === "loading" && navigation.location?.pathname === location.pathname;
  const filterCount = activeCount(query);
  const heading = useHeading(query);

  const loadMore = () => {
    if (!pages.cursor) return;
    const sp = new URLSearchParams(canonicalSearch(query));
    sp.set("cursor", pages.cursor);
    more.load(`${location.pathname}?${sp}`);
  };

  const openSave = () => {
    if (status !== "authed") {
      navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    setSaveOpen(true);
  };

  return (
    <div className="container-page pb-20 pt-8 md:pt-10">
      <header className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">{heading}</h1>
        <Form method="get" role="search" className="flex max-w-3xl gap-2" preventScrollReset>
          {Object.entries(query).map(([k, v]) => k !== "q" && <input key={k} type="hidden" name={k} value={v} />)}
          <label className="flex h-12 flex-1 items-center gap-3 rounded-control border border-line-strong bg-surface px-3.5 transition-[border-color,box-shadow] focus-within:border-lapis focus-within:shadow-[0_0_0_4px_var(--lapis-soft)]">
            <Search className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
            <span className="sr-only">{t("search.what")}</span>
            <input
              key={query.q ?? ""}
              name="q"
              type="search"
              defaultValue={query.q ?? ""}
              autoComplete="off"
              placeholder={t("search.what")}
              className="h-full w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          <Button type="submit" size="md" className="h-12">{t("search.submit")}</Button>
        </Form>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label={t("common.filters")}>
          <div className="sticky top-24">
            <Filters q={query} onChange={apply} />
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="-ml-3 mt-5" onClick={() => apply(query.q ? { q: query.q } : {})}>
                {t("jobs.filters.clear")}
              </Button>
            )}
          </div>
        </aside>

        <section aria-labelledby="results-count" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p id="results-count" className="num w-full text-sm text-ink-2 sm:mr-auto sm:w-auto" aria-live="polite">
              {meta.total_capped ? t("jobs.totalCapped") : t("jobs.total", { count: meta.total ?? items.length })}
            </p>
            <DialogRoot open={sheetOpen} onOpenChange={(o) => { setSheetOpen(o); if (o) setDraft(query); }}>
              <Button variant="secondary" size="sm" className="lg:hidden" icon={<SlidersHorizontal className="size-4" />} onClick={() => setSheetOpen(true)}>
                {t("common.filters")}
                {filterCount > 0 && <span className="num ml-0.5 grid size-5 place-items-center rounded-full bg-lapis text-[0.6875rem] text-on-lapis">{filterCount}</span>}
              </Button>
              <SheetContent
                title={t("common.filters")}
                closeLabel={t("common.close")}
                footer={
                  <>
                    <Button variant="secondary" onClick={() => setDraft(query.q ? { q: query.q } : {})}>{t("common.clear")}</Button>
                    <Button className="flex-1" onClick={() => { apply(draft); setSheetOpen(false); }}>{t("jobs.filters.show")}</Button>
                  </>
                }
              >
                <Filters q={draft} onChange={setDraft} />
              </SheetContent>
            </DialogRoot>
            <Select
              aria-label={t("jobs.sort")}
              size="sm"
              className="w-48"
              value={query.sort ?? (query.q ? "relevance" : "newest")}
              onValueChange={(v) => apply({ ...query, sort: v })}
              options={[
                ...(query.q ? [{ value: "relevance", label: t("jobs.sortRelevance") }] : []),
                { value: "newest", label: t("jobs.sortNewest") },
              ]}
            />
            <Button variant="soft" size="sm" icon={<BellPlus className="size-4" />} onClick={openSave}>
              <span className="max-sm:sr-only">{t("jobs.saveSearch")}</span>
            </Button>
          </div>

          {meta.fuzzy && (
            <p className="mb-3 rounded-control bg-zafaron-soft px-4 py-3 text-sm text-zafaron-ink">{t("jobs.fuzzy")}</p>
          )}

          <div className={cn("transition-opacity duration-200", busy && "opacity-55")}>
            {items.length > 0 ? (
              <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                {items.map((v) => <VacancyRow key={v.id} v={v} />)}
              </div>
            ) : (
              <div className="rounded-panel border border-line bg-surface">
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title={loaderData.failed ? t("errors.network") : t("empty.vacanciesTitle")}
                  body={loaderData.failed ? undefined : t("empty.vacanciesBody")}
                  action={
                    loaderData.failed ? (
                      <Button variant="secondary" onClick={() => navigate(".", { replace: true })}>{t("common.retry")}</Button>
                    ) : filterCount > 0 ? (
                      <Button variant="secondary" onClick={() => apply(query.q ? { q: query.q } : {})}>{t("jobs.filters.clear")}</Button>
                    ) : (
                      <Button variant="soft" icon={<BellPlus className="size-4" />} onClick={openSave}>{t("jobs.saveSearch")}</Button>
                    )
                  }
                />
              </div>
            )}
          </div>

          {pages.cursor && items.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" loading={more.state !== "idle"} onClick={loadMore}>{t("jobs.loadMore")}</Button>
            </div>
          )}
        </section>
      </div>

      {saveOpen && (
        <Suspense>
          <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} query={query} defaultName={heading} />
        </Suspense>
      )}
    </div>
  );
}

/** "Dasturchi · Toshkent" style heading from the active search, else "Vacancies". */
function useHeading(q: Record<string, string>) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const parts: string[] = [];
  if (q.q) parts.push(q.q[0].toUpperCase() + q.q.slice(1));
  else if (q.category_id) parts.push(nameOf(idx.categories.get(Number(q.category_id))?.name, locale));
  const place = q.district_id ?? q.region_id;
  if (place) parts.push(nameOf(idx.regions.get(Number(place))?.name, locale));
  return parts.filter(Boolean).join(", ") || t("jobs.title");
}
