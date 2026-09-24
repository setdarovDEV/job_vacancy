import { BadgeCheck, BriefcaseBusiness, CalendarDays, Globe, Mail, MapPin, Phone, Shapes, Users } from "lucide-react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useRevalidator } from "react-router";

import type { Route } from "./+types/company";
import { api, apiError, orThrow, type ApiError, type Schemas } from "~/shared/api/client";
import { errorText } from "~/shared/api/errors";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { plainText, RichText } from "~/shared/lib/markdown";
import { LoadMore } from "~/shared/query/LoadMore";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo, SITE } from "~/shared/seo/seo";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Breadcrumbs } from "~/shared/ui/Breadcrumbs";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card, CardHeader } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { TabPanel, Tabs } from "~/shared/ui/Tabs";
import { toast } from "~/shared/ui/toast-store";
import { VacancyList } from "~/shared/vacancy/VacancyRow";

type Company = Schemas["Company"];
type VacancyCard = Schemas["VacancyCard"];
type Jobs =
  | { ok: true; items: VacancyCard[]; cursor: string | null }
  | { ok: false; status: number; error: ApiError | null };

const PAGE = 20;

export async function loader({ params, request }: Route.LoaderArgs) {
  const headers = forwardHeaders(request);
  const company = orThrow(await api.GET("/companies/{company}", { params: { path: { company: params.slug } }, headers }));
  // The vacancies are a section of their own: if that call fails the profile still renders,
  // with an inline error and Retry in place of the list (never an empty "no jobs").
  const jobs: Jobs = await api
    .GET("/vacancies", { params: { query: { company_id: company.id, limit: PAGE } }, headers })
    .then((r): Jobs =>
      r.data
        ? { ok: true, items: (r.data.data ?? []) as VacancyCard[], cursor: r.data.meta?.next_cursor ?? null }
        : { ok: false, status: r.response.status, error: apiError(r) },
    )
    .catch((): Jobs => ({ ok: false, status: 0, error: null }));
  return { company, jobs };
}

export function meta({ matches, loaderData: d, location }: Route.MetaArgs) {
  if (!d) return [];
  const { t } = metaT(matches);
  const c = d.company;
  return seo({
    title: `${t("companiesPage.companyMetaTitle", { name: c.name })} | Job Vacancy`,
    description: plainText(c.about ?? "", 160) || t("companiesPage.companyMetaDescription", { name: c.name }),
    path: location.pathname,
    image: c.logo_url,
  });
}

export default function CompanyPage({ loaderData }: Route.ComponentProps) {
  // Keyed by company: moving between two company pages starts on a fresh tab and list.
  return <CompanyView key={loaderData.company.id} company={loaderData.company} jobs={loaderData.jobs} />;
}

const siteHref = (w: string) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);
const siteLabel = (w: string) => w.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");

function CompanyView({ company: c, jobs }: { company: Company; jobs: Jobs }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const industry = nameOf(idx.categories.get(c.industry_id ?? -1)?.name, locale);
  const region = nameOf(idx.regions.get(c.region_id ?? -1)?.name, locale);
  const size = c.size?.replace("-", "–");
  const about = (c.about ?? "").trim();
  const open = c.open_vacancies ?? (jobs.ok ? jobs.items.length : 0);
  // Vacancies first; a company with nothing open but a story to tell opens on "About".
  const [tab, setTab] = useState(jobs.ok && !jobs.items.length && about ? "about" : "jobs");
  const facts = { c, industry, region, size, open };

  return (
    <div className="pb-16 md:pb-24">
      <OrganizationLd c={c} region={region} />
      <section aria-labelledby="company-name" className="relative isolate">
        {/* Cover: the uploaded image, or the brand light with girih running up under the clear
            header. The fade (not a hard edge) hands over to the page. */}
        {!c.cover_url && (
          <>
            <div
              aria-hidden="true"
              className="aurora-hero aurora-fade anim-fade pointer-events-none absolute inset-x-0 -top-(--header-h) bottom-0 -z-10"
              style={{ animationDuration: "var(--dur-4)" }}
            />
            <GirihPattern className="-z-10" focus="ellipse 80% 70% at 70% 15%" />
          </>
        )}
        <div className="container-page pt-4 md:pt-6">
          <Breadcrumbs items={[{ label: t("companies.title"), to: "/companies" }, { label: c.name }]} />
          {c.cover_url ? (
            <img
              src={c.cover_url}
              alt=""
              width={1216}
              height={304}
              fetchPriority="high"
              decoding="async"
              className="mt-4 w-full rounded-sheet bg-sunken object-cover"
              style={{ aspectRatio: "4 / 1", minHeight: "8rem" }}
            />
          ) : (
            <div aria-hidden="true" className="h-14 md:h-24" />
          )}

          <div
            // Logo | name, with the website link under the name on tablets and at the end of
            // the row from lg (a long name keeps the full width until then).
            className={cn(
              "grid gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-end md:gap-x-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]",
              c.cover_url && "-mt-8 px-2 md:px-6",
            )}
          >
            {/* Concentric: 28px glass badge − 6px padding = the logo's 22px corner. */}
            <div className="glass-panel justify-self-start rounded-sheet p-1.5">
              <Avatar
                name={c.name}
                src={c.logo_url}
                square
                size="xl"
                priority
                className="md:size-24 md:text-3xl"
                style={{ viewTransitionName: `company-logo-${c.id}` }}
              />
            </div>
            <div className="min-w-0">
              <h1
                id="company-name"
                className="break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl"
                style={{ viewTransitionName: `company-name-${c.id}` }}
              >
                {c.name}
              </h1>
              <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-md text-ink-2">
                {c.verified && (
                  <li className="flex">
                    <Badge tone="firuza" icon={<BadgeCheck />}>{t("companiesPage.verified")}</Badge>
                  </li>
                )}
                {industry && <MetaItem icon={<Shapes className="size-4" />}>{industry}</MetaItem>}
                {region && <MetaItem icon={<MapPin className="size-4" />}>{region}</MetaItem>}
                {size && <MetaItem icon={<Users className="size-4" />}>{t("companiesPage.employees", { size })}</MetaItem>}
              </ul>
            </div>
            {c.website && (
              <Button asChild variant="secondary" icon={<Globe className="size-4.5" />} className="max-w-full justify-self-start md:col-start-2 lg:col-start-3">
                <a href={siteHref(c.website)} target="_blank" rel="noopener noreferrer nofollow">
                  <span className="truncate">{siteLabel(c.website)}</span>
                  <span className="sr-only"> {t("companiesPage.newTab")}</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="container-page mt-8 grid gap-6 md:mt-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs
            value={tab}
            onValueChange={setTab}
            label={t("companiesPage.sections")}
            tabs={[
              { value: "jobs", label: t("nav.vacancies"), count: open },
              { value: "about", label: t("companies.about") },
            ]}
          >
            {/* Both panels are rendered (the inactive one `hidden`), so the server HTML always
                carries the company's description and facts for search engines. */}
            <TabPanel value="jobs" forceMount hidden={tab !== "jobs"} className="mt-5">
              <h2 className="sr-only">{t("companies.openJobs")}</h2>
              <JobsPanel c={c} jobs={jobs} />
            </TabPanel>
            <TabPanel value="about" forceMount hidden={tab !== "about"} className="mt-5">
              <h2 className="sr-only">{t("companies.about")}</h2>
              <Card padding="lg">
                {about ? (
                  <RichText text={about} className="rich-text" />
                ) : (
                  <p className="text-md text-ink-2">{t("companiesPage.noAbout")}</p>
                )}
              </Card>
              {/* Phones and tablets have no aside: the facts live under the story. */}
              <Facts {...facts} className="mt-4 lg:hidden" />
            </TabPanel>
          </Tabs>
        </div>
        <aside className="hidden min-w-0 lg:block">
          <Facts {...facts} className="sticky top-24" />
        </aside>
      </div>
    </div>
  );
}

function MetaItem({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden="true" className="shrink-0 text-ink-3">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

/** The company's open vacancies: the server's first page, then "Load more" by cursor. */
function JobsPanel({ c, jobs }: { c: Company; jobs: Jobs }) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const more = useMoreJobs(c.id, jobs);

  if (!jobs.ok) {
    return (
      <Card padding="none" aria-busy={revalidator.state === "loading" || undefined}>
        <ErrorState
          headingAs="h3"
          error={jobs.error ?? (jobs.status === 0 ? new TypeError("network") : { status: jobs.status })}
          onRetry={() => revalidator.revalidate()}
        />
      </Card>
    );
  }
  if (!more.items.length) {
    return (
      <Card padding="none">
        <EmptyState
          icon={<BriefcaseBusiness />}
          title={t("companies.noOpen")}
          body={t("companiesPage.noJobsBody", { name: c.name })}
          action={
            <Button asChild variant="secondary">
              <LocalizedLink to="/vacancies" prefetch="intent">{t("shell.footer.allVacancies")}</LocalizedLink>
            </Button>
          }
        />
      </Card>
    );
  }
  return (
    <>
      <VacancyList items={more.items} enter={jobs.items.length} headingAs="h3" />
      <LoadMore hasNext={more.hasNext} loading={more.loading} onClick={more.load} loadedCount={more.items.length} className="mt-6" />
    </>
  );
}

/**
 * Pages after the first come straight from the API in the browser (the profile itself doesn't
 * need reloading). A revalidated first page (Retry, back/forward) starts the list over.
 */
function useMoreJobs(companyId: string, jobs: Jobs) {
  const { t } = useTranslation();
  const first = jobs.ok ? jobs.items : null;
  const [state, setState] = useState({ base: first, items: [] as VacancyCard[], cursor: jobs.ok ? jobs.cursor : null });
  const [loading, setLoading] = useState(false);
  if (state.base !== first) setState({ base: first, items: [], cursor: jobs.ok ? jobs.cursor : null });
  const run = useRef(0);

  const load = async () => {
    const cursor = state.cursor;
    if (!cursor || loading) return;
    const id = ++run.current;
    setLoading(true);
    try {
      const r = await api.GET("/vacancies", { params: { query: { company_id: companyId, cursor, limit: PAGE } } });
      if (id !== run.current) return;
      if (!r.data) {
        toast({ tone: "error", title: errorText(t, apiError(r)) || t("errors.internal_error") });
        return;
      }
      const page = (r.data.data ?? []) as VacancyCard[];
      const next = r.data.meta?.next_cursor ?? null;
      setState((s) => ({ ...s, items: [...s.items, ...page], cursor: next }));
    } catch {
      if (id === run.current) toast({ tone: "error", title: t("errors.network") });
    } finally {
      if (id === run.current) setLoading(false);
    }
  };

  const items = useMemo(() => {
    const seen = new Set<string>();
    return [...(first ?? []), ...state.items].filter((v) => !seen.has(v.id) && Boolean(seen.add(v.id)));
  }, [first, state.items]);

  return { items, hasNext: Boolean(state.cursor), loading, load };
}

function Facts({ c, industry, region, size, open, className }: {
  c: Company; industry?: string; region?: string; size?: string; open: number; className?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const link = "text-lapis-ink underline-offset-4 hover:underline";
  const place = [region, c.address].filter(Boolean).join(", ");
  const rows: { id: string; icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (industry) rows.push({ id: "industry", icon: <Shapes className="size-4.5" />, label: t("jobs.filters.category"), value: industry });
  if (place) rows.push({ id: "place", icon: <MapPin className="size-4.5" />, label: t("jobs.address"), value: place });
  if (size) rows.push({ id: "size", icon: <Users className="size-4.5" />, label: t("companies.size"), value: size });
  if (c.founded_year) {
    rows.push({ id: "founded", icon: <CalendarDays className="size-4.5" />, label: t("companies.founded"), value: c.founded_year });
  }
  if (c.website) {
    rows.push({
      id: "site", icon: <Globe className="size-4.5" />, label: t("companies.website"),
      value: (
        <a className={link} href={siteHref(c.website)} target="_blank" rel="noopener noreferrer nofollow">
          {siteLabel(c.website)}
          <span className="sr-only"> {t("companiesPage.newTab")}</span>
        </a>
      ),
    });
  }
  if (c.email) rows.push({ id: "email", icon: <Mail className="size-4.5" />, label: t("form.email"), value: <a className={link} href={`mailto:${c.email}`}>{c.email}</a> });
  if (c.phone) {
    rows.push({ id: "phone", icon: <Phone className="size-4.5" />, label: t("settings.phone"), value: <a className={`num ${link}`} href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a> });
  }
  rows.push({ id: "open", icon: <BriefcaseBusiness className="size-4.5" />, label: t("companies.openJobs"), value: <span className="num">{groupDigits(open)}</span> });

  return (
    <Card as="section" aria-labelledby={id} className={className}>
      <CardHeader id={id} title={t("companiesPage.facts")} />
      {c.verified && (
        // Trust is explained, not just decorated.
        <Callout tone="success" icon={<BadgeCheck />} title={t("companiesPage.verified")} className="mt-4">
          {t("companiesPage.verifiedHint")}
        </Callout>
      )}
      <dl className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.id} className="flex gap-3 py-3 last:pb-0">
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-ink-3">{r.icon}</span>
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-ink-2">{r.label}</dt>
              <dd className="mt-0.5 break-words text-md text-ink">{r.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Organization structured data for the profile (only the fields the company filled in). */
function OrganizationLd({ c, region }: { c: Company; region?: string }) {
  const { pathname } = useLocation();
  const page = SITE + pathname;
  const [lo, hi] = (c.size ?? "").split("-").map((n) => parseInt(n, 10));
  const ld = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${page}#organization`,
    name: c.name,
    url: c.website ? siteHref(c.website) : page,
    mainEntityOfPage: page,
    logo: c.logo_url ?? undefined,
    image: c.cover_url ?? undefined,
    description: c.about ? plainText(c.about, 500) : undefined,
    foundingDate: c.founded_year ? String(c.founded_year) : undefined,
    email: c.email ?? undefined,
    telephone: c.phone ?? undefined,
    address:
      region || c.address
        ? { "@type": "PostalAddress", addressCountry: "UZ", addressRegion: region || undefined, streetAddress: c.address ?? undefined }
        : undefined,
    numberOfEmployees: Number.isFinite(lo)
      ? { "@type": "QuantitativeValue", minValue: lo, maxValue: Number.isFinite(hi) ? hi : undefined }
      : undefined,
  };
  // "<" escaped so a name containing "</script>" can't break out of the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />;
}
