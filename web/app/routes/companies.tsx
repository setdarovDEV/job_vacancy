import { ArrowRight, BadgeCheck, Building2, SearchX, Users } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { data, useLocation, useNavigate, useNavigation, useRevalidator, useViewTransitionState } from "react-router";

import type { Route } from "./+types/companies";
import { api, apiError, type ApiError, type Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { localizedPath } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { plainText } from "~/shared/lib/markdown";
import { useSpotlight } from "~/shared/lib/spotlight";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Card, CardLink } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { FilterChip } from "~/shared/ui/FilterChip";
import { Pagination } from "~/shared/ui/Pagination";
import { SearchBar } from "~/shared/ui/SearchBar";
import { PageHeader } from "~/shared/ui/Section";
import { Skeleton, SkeletonText, useSkeletonHold } from "~/shared/ui/Skeleton";
import type { ShellHandle } from "./site";

type Company = Schemas["Company"];
type Failure = { status: number; error: ApiError | null };

// A long directory: on phones the header slides away while scrolling down (returns on scroll up).
export const handle: ShellHandle = { autoHideHeader: true };

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // The API caps the name filter at 100 characters; a longer hand-typed query would be a 400.
  const q = url.searchParams.get("q")?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Math.floor(Number(url.searchParams.get("page"))) || 1);
  const base = { q: q ?? "", page };
  const failed = (failure: Failure) =>
    // A real error status keeps the broken page out of search indexes; the UI still renders.
    data({ ...base, items: [] as Company[], next: null, total: null, pageCount: null, failure }, { status: 502 });
  try {
    const res = await api.GET("/companies", { params: { query: { q, page } }, headers: forwardHeaders(request) });
    if (!res.data) return failed({ status: res.response.status, error: apiError(res) });
    const meta = res.data.meta;
    return {
      ...base,
      items: (res.data.data ?? []) as Company[],
      next: meta?.next_page ?? null,
      // total / page_count come from cached page anchors; older API builds only had next_page.
      total: typeof meta?.total === "number" ? meta.total : null,
      pageCount: typeof meta?.page_count === "number" ? meta.page_count : null,
      failure: null as Failure | null,
    };
  } catch {
    return failed({ status: 0, error: null });
  }
}

export function meta({ matches, location, loaderData: d }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({
    title: `${t("companiesPage.metaTitle")} | Job Vacancy`,
    description: t("companies.subtitle"),
    path: location.pathname,
    noindex: Boolean(d?.q) || (d?.page ?? 1) > 1 || Boolean(d?.failure),
  });
}

/** True once `on` has stayed true for `ms`: fast answers never flash a skeleton. */
function useSlowFlag(on: boolean, ms = 150) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!on) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), ms);
    return () => clearTimeout(timer);
  }, [on, ms]);
  return on && slow;
}

export default function Companies({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { items, next, total, q, page, failure } = loaderData;

  // Honest page count: the API's own, or (older API) as far as next_page lets us know.
  const pageCount = loaderData.pageCount ?? page + (next ? 1 : 0);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/companies?${s}` : "/companies";
  };

  // Another page or query of this directory is loading: the current grid stays, dimmed. A new
  // query makes the old cards meaningless, so after 150 ms it becomes a skeleton (kept ≥ 300 ms).
  const pending =
    navigation.state === "loading" && navigation.location.pathname === location.pathname
      ? new URLSearchParams(navigation.location.search)
      : null;
  const newQuery = pending != null && (pending.get("q")?.trim() ?? "") !== q;
  const held = useSkeletonHold(newQuery);
  const skeleton = useSlowFlag(held) && held;
  const busy = pending != null || revalidator.state === "loading";

  const clearQuery = () => {
    navigate(localizedPath(locale, "/companies"));
    // The chip is gone: keep keyboard focus on the results heading instead of <body>.
    requestAnimationFrame(() => document.getElementById("companies-results")?.focus({ preventScroll: true }));
  };

  const shownTotal = total ?? items.length;

  return (
    <div className="relative isolate">
      {/* Brand light under the (clear at rest) header, fading out before the grid. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade pointer-events-none absolute inset-x-0 -top-(--header-h) -z-10 h-80 md:h-96"
      />
      <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
        <PageHeader title={t("companies.title")} description={t("companies.subtitle")} />
        <SearchBar
          action="/companies"
          size="lg"
          defaultQuery={q}
          placeholder={t("companies.search")}
          label={t("companiesPage.searchLabel")}
          id="companies-q"
          className="max-w-2xl"
        />

        {!failure && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:mt-10">
            <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-2" aria-live="polite">
              <h2
                id="companies-results"
                tabIndex={-1}
                className="num text-md font-semibold text-ink focus-visible:outline-none"
              >
                {skeleton ? t("common.loading") : t("companiesPage.count", { count: shownTotal, n: groupDigits(shownTotal) })}
              </h2>
              {q && (
                <FilterChip onRemove={clearQuery} removeLabel={t("controls.removeFilter", { name: q })}>
                  {t("companiesPage.quoted", { q })}
                </FilterChip>
              )}
            </div>
            {items.length > 1 && (
              // The API ranks verified employers first: say so, it explains the order.
              <p className="flex items-center gap-1.5 text-sm text-ink-2">
                <BadgeCheck aria-hidden="true" className="size-4 shrink-0 fill-firuza text-surface" />
                {t("companiesPage.verifiedFirst")}
              </p>
            )}
          </div>
        )}

        <div className={failure ? "mt-8 md:mt-10" : "mt-4"} aria-busy={busy || undefined}>
          {skeleton ? (
            <CompanyGridSkeleton />
          ) : failure ? (
            <Card padding="none">
              <ErrorState
                error={failure.error ?? (failure.status === 0 ? new TypeError("network") : { status: failure.status })}
                onRetry={() => revalidator.revalidate()}
              />
            </Card>
          ) : items.length > 0 ? (
            <div className={cn("transition-opacity duration-200", busy && "opacity-60")}>
              <CompanyGrid key={`${q}|${page}`} items={items} />
              <Pagination page={page} pageCount={pageCount} hrefFor={pageHref} className="mt-10" />
            </div>
          ) : (
            <Card padding="none" className={cn("transition-opacity duration-200", busy && "opacity-60")}>
              {page > 1 ? (
                <EmptyState
                  icon={<Building2 />}
                  headingAs="p"
                  title={t("companiesPage.pageEmptyTitle")}
                  body={t("companiesPage.pageEmptyBody")}
                  action={
                    <Button asChild variant="secondary">
                      <LocalizedLink to={pageHref(1)}>{t("companiesPage.firstPage")}</LocalizedLink>
                    </Button>
                  }
                />
              ) : q ? (
                <EmptyState
                  icon={<SearchX />}
                  headingAs="p"
                  title={t("companiesPage.noMatchTitle", { q })}
                  body={t("companiesPage.noMatchBody")}
                  action={
                    <Button asChild variant="secondary">
                      <LocalizedLink to="/companies">{t("companiesPage.showAll")}</LocalizedLink>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Building2 />}
                  headingAs="p"
                  title={t("companiesPage.emptyTitle")}
                  body={t("companiesPage.emptyBody")}
                  action={
                    <Button asChild>
                      <LocalizedLink to="/employers">{t("companiesPage.emptyAction")}</LocalizedLink>
                    </Button>
                  }
                />
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

function CompanyGrid({ items }: { items: Company[] }) {
  const list = useSpotlight<HTMLUListElement>();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const locale = useLocale();
  return (
    <ul ref={list} className={grid}>
      {items.map((c, i) => {
        const meta = [
          nameOf(idx.categories.get(c.industry_id ?? -1)?.name, locale),
          nameOf(idx.regions.get(c.region_id ?? -1)?.name, locale),
        ].filter(Boolean).join(" · ");
        return (
          // First paint of a page only (the grid is keyed by query + page), max 8 staggered.
          <li key={c.id} className="anim-enter min-w-0" style={{ "--i": i } as CSSProperties}>
            <CompanyCard c={c} meta={meta} priority={i < 3} />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One employer: a solid card whose name link is stretched over it, with the open-jobs link as
 * the secondary target (above the stretched link). Logo and name morph into the company page.
 */
function CompanyCard({ c, meta, priority }: { c: Company; meta: string; priority?: boolean }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const to = `/companies/${c.slug}`;
  // Only the card being opened gets view-transition names (each name is its own snapshot).
  const morph = useViewTransitionState(localizedPath(locale, to));
  const open = c.open_vacancies ?? 0;
  const about = c.about ? plainText(c.about, 180) : "";
  return (
    <Card as="article" interactive padding="none" className="spotlight flex h-full flex-col p-4 sm:p-5">
      <div className="flex items-center gap-3.5">
        <Avatar
          name={c.name}
          src={c.logo_url}
          square
          size="lg"
          priority={priority}
          className="shrink-0"
          style={morph ? { viewTransitionName: `company-logo-${c.id}` } : undefined}
        />
        <div className="min-w-0 flex-1">
          {/* The check runs inline after the last word, so a wrapped name keeps it beside the text. */}
          <h3 className="line-clamp-2 break-words text-lead font-semibold tracking-snug text-ink">
            <CardLink
              to={to}
              prefetch="intent"
              viewTransition
              style={morph ? { viewTransitionName: `company-name-${c.id}` } : undefined}
            >
              {c.name}
            </CardLink>
            {c.verified && (
              <>
                <BadgeCheck aria-hidden="true" className="ml-1.5 inline size-5 fill-firuza align-text-bottom text-surface" />
                <span className="sr-only">{t("common.verified")}</span>
              </>
            )}
          </h3>
          {meta && <p className="mt-0.5 truncate text-sm text-ink-2">{meta}</p>}
        </div>
      </div>
      {/* The flexible middle keeps every footer on the same line across a grid row. */}
      <div className="flex-1">
        {about && <p className="mt-3 line-clamp-2 break-words text-sm text-ink-2">{about}</p>}
      </div>
      <div className="mt-4 flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3">
        {open > 0 ? (
          <LocalizedLink
            to={`/vacancies?company_id=${c.id}`}
            prefetch="intent"
            aria-label={t("companiesPage.jobsOf", { count: open, n: groupDigits(open), name: c.name })}
            // Above the stretched name link; a 44px target that still sits on the 28px row.
            className="relative z-10 -my-2 -ml-2 inline-flex min-h-11 items-center gap-1 rounded-pill px-2 text-sm font-semibold text-lapis-ink transition-[background-color,scale] duration-150 hover:bg-lapis-soft active:scale-[0.97]"
          >
            <span className="num">{t("companiesPage.openJobs", { count: open, n: groupDigits(open) })}</span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </LocalizedLink>
        ) : (
          <span className="text-sm text-ink-2">{t("companies.noOpen")}</span>
        )}
        {c.size && (
          <span className="flex items-center gap-1.5 text-sm text-ink-2">
            <Users aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
            <span>{t("companiesPage.employees", { size: c.size.replace("-", "–") })}</span>
          </span>
        )}
      </div>
    </Card>
  );
}

/** Placeholder grid shaped exactly like CompanyCard (same padding, logo tile and rows). */
function CompanyGridSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-busy="true" className="anim-fade">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className={grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={cn("surface-card flex flex-col p-4 sm:p-5", i >= 3 && "max-sm:hidden")}>
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-14 shrink-0 rounded-panel" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4.5 w-2/3" />
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            </div>
            <SkeletonText lines={2} className="mt-3" />
            <div className="mt-4 flex min-h-7 items-center justify-between border-t border-line pt-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
