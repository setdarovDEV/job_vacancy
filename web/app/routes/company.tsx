import { BadgeCheck, Globe, MapPin, Users, CalendarDays, BriefcaseBusiness } from "lucide-react";
import { useMemo } from "react";

import type { Route } from "./+types/company";
import { api, orThrow, type Schemas } from "~/shared/api/client";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { RichText } from "~/shared/lib/markdown";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { VacancyRow } from "~/shared/vacancy/VacancyRow";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";

export async function loader({ params, request }: Route.LoaderArgs) {
  const headers = forwardHeaders(request);
  const company = orThrow(await api.GET("/companies/{company}", { params: { path: { company: params.slug } }, headers }));
  const jobs = await api
    .GET("/vacancies", { params: { query: { company_id: company.id, limit: 20 } }, headers })
    .then((r) => ({ items: (r.data?.data ?? []) as Schemas["VacancyCard"][], more: Boolean(r.data?.meta?.next_cursor) }))
    .catch(() => ({ items: [] as Schemas["VacancyCard"][], more: false }));
  return { company, jobs };
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [];
  const c = data.company;
  return seo({
    title: `${c.name} | Job Vacancy`,
    description: (c.about ?? "").replace(/\s+/g, " ").slice(0, 160) || undefined,
    path: location.pathname,
    image: c.logo_url,
  });
}

export default function CompanyPage({ loaderData }: Route.ComponentProps) {
  const { company: c, jobs } = loaderData;
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const industry = nameOf(idx.categories.get(c.industry_id ?? -1)?.name, locale);
  const region = nameOf(idx.regions.get(c.region_id ?? -1)?.name, locale);
  const site = c.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <div className="pb-20">
      <div className="h-36 bg-lapis md:h-52" style={c.cover_url ? { background: `center/cover url(${JSON.stringify(c.cover_url)})` } : undefined}>
        {!c.cover_url && <div className="size-full bg-[radial-gradient(circle_at_80%_20%,color-mix(in_oklab,var(--firuza),transparent_55%),transparent_60%)]" />}
      </div>
      <div className="container-page">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          <Avatar name={c.name} src={c.logo_url} square size="xl" className="-mt-12 size-24 border-4 border-paper md:-mt-14 md:size-28" />
          <div className="min-w-0 flex-1 md:pt-4">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.03em] text-ink md:text-3xl">
              {c.name}
              {c.verified && <BadgeCheck className="size-6 shrink-0 text-firuza" aria-label={t("common.verified")} />}
            </h1>
            {industry && <p className="mt-1 text-ink-2">{industry}</p>}
          </div>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
              {t("companies.openJobs")} <span className="num text-ink-3">{jobs.items.length}{jobs.more ? "+" : ""}</span>
            </h2>
            <div className="mt-4">
              {jobs.items.length ? (
                <div className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                  {jobs.items.map((v) => <VacancyRow key={v.id} v={v} />)}
                </div>
              ) : (
                <div className="rounded-panel border border-line bg-surface">
                  <EmptyState icon={<BriefcaseBusiness className="size-6" />} title={t("companies.noOpen")} />
                </div>
              )}
              {jobs.more && (
                <Button variant="secondary" asChild className="mt-4">
                  <LocalizedLink to={`/vacancies?company_id=${c.id}`}>{t("common.showAll")}</LocalizedLink>
                </Button>
              )}
            </div>

            {c.about && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t("companies.about")}</h2>
                <RichText text={c.about} className="mt-4 max-w-[68ch] space-y-4 leading-relaxed text-ink-2" />
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <dl className="flex flex-col gap-4 rounded-panel border border-line bg-surface p-5 text-sm">
              {site && <Info icon={<Globe />} label={t("companies.website")}><a className="text-lapis-ink hover:underline" href={c.website!.startsWith("http") ? c.website! : `https://${c.website}`} target="_blank" rel="noopener noreferrer nofollow">{site}</a></Info>}
              {region && <Info icon={<MapPin />} label={t("jobs.address")}>{[region, c.address].filter(Boolean).join(", ")}</Info>}
              {c.size && <Info icon={<Users />} label={t("companies.size")}>{c.size}</Info>}
              {c.founded_year && <Info icon={<CalendarDays />} label={t("companies.founded")}>{c.founded_year}</Info>}
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, children }: { icon: React.ReactElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-ink-3 [&>svg]:size-4.5" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className="mt-0.5 break-words text-ink">{children}</dd>
      </div>
    </div>
  );
}
