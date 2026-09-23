import { BadgeCheck, Building, Search } from "lucide-react";
import { Form } from "react-router";

import type { Route } from "./+types/companies";
import { api, type Schemas } from "~/shared/api/client";
import { nameOf, useCatalog, indexCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";
import { useMemo } from "react";

type Company = Schemas["Company"];

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  try {
    const res = await api.GET("/companies", { params: { query: { q, page } }, headers: forwardHeaders(request) });
    return { items: (res.data?.data ?? []) as Company[], next: res.data?.meta?.next_page ?? null, q: q ?? "", page };
  } catch {
    return { items: [] as Company[], next: null, q: q ?? "", page };
  }
}

export function meta({ matches, location, loaderData: data }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({
    title: `${t("companies.title")} | Job Vacancy`,
    description: t("companies.subtitle"),
    path: location.pathname,
    noindex: Boolean(data?.q) || (data?.page ?? 1) > 1,
  });
}

export default function Companies({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const { items, next, q, page } = loaderData;
  const pageHref = (p: number) => `/companies?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div className="container-page pb-20 pt-8 md:pt-10">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">{t("companies.title")}</h1>
      <p className="mt-2 max-w-[38rem] text-ink-2">{t("companies.subtitle")}</p>
      <Form method="get" role="search" className="mt-6 flex max-w-xl gap-2">
        <label className="flex h-11 flex-1 items-center gap-3 rounded-control border border-line-strong bg-surface px-3.5 focus-within:border-lapis focus-within:shadow-[0_0_0_4px_var(--lapis-soft)]">
          <Search className="size-4.5 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">{t("companies.search")}</span>
          <input key={q} name="q" type="search" defaultValue={q} placeholder={t("companies.search")} className="h-full w-full bg-transparent text-ink outline-none placeholder:text-ink-3" />
        </label>
        <Button type="submit">{t("search.submit")}</Button>
      </Form>

      {items.length === 0 ? (
        <div className="mt-8 rounded-panel border border-line bg-surface">
          <EmptyState icon={<Building className="size-6" />} title={t("companies.empty")} />
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <LocalizedLink
                to={`/companies/${c.slug}`}
                className="flex h-full items-start gap-4 rounded-panel border border-line bg-surface p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-pop"
              >
                <Avatar name={c.name} src={c.logo_url} square size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <span className="truncate">{c.name}</span>
                    {c.verified && <BadgeCheck className="size-4 shrink-0 text-firuza" aria-label={t("common.verified")} />}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-3">
                    {[nameOf(idx.categories.get(c.industry_id ?? -1)?.name, locale), nameOf(idx.regions.get(c.region_id ?? -1)?.name, locale)].filter(Boolean).join(", ")}
                  </p>
                  <p className={`num mt-3 text-sm font-medium ${c.open_vacancies ? "text-firuza-ink" : "text-ink-3"}`}>
                    {c.open_vacancies ? t("companies.open", { count: c.open_vacancies }) : t("companies.noOpen")}
                  </p>
                </div>
              </LocalizedLink>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || next) && (
        <nav className="mt-8 flex justify-center gap-2" aria-label={t("companies.title")}>
          {page > 1 && <Button variant="secondary" asChild><LocalizedLink to={pageHref(page - 1)}>{t("companies.prev")}</LocalizedLink></Button>}
          {next && <Button variant="secondary" asChild><LocalizedLink to={pageHref(next)}>{t("companies.next")}</LocalizedLink></Button>}
        </nav>
      )}
    </div>
  );
}
