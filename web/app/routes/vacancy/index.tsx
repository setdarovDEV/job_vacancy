import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarClock, CalendarDays, Clock3, ExternalLink, Eye,
  Hourglass, House, Layers, MapPin, PencilLine, SearchX, Star, Users,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from "react";
import { useRevalidator, useViewTransitionState } from "react-router";

import type { Route } from "./+types/index";
import type { ShellHandle } from "../site";
import { ShareMenu } from "./ShareMenu";
import { api, orThrow, soft, type Schemas } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { htmlLang, localizedPath, type Locale } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits, monthNames, salary } from "~/shared/lib/format";
import { plainText, RichText, toHtml } from "~/shared/lib/markdown";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo, SITE } from "~/shared/seo/seo";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Breadcrumbs } from "~/shared/ui/Breadcrumbs";
import { Button } from "~/shared/ui/Button";
import { Callout } from "~/shared/ui/Callout";
import { Card } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { RelTime } from "~/shared/ui/RelTime";
import { SaveButton } from "~/shared/vacancy/SaveButton";

type Vacancy = Schemas["VacancyDetail"];
type Similar = Schemas["VacancyCard"];

const loadApply = () => import("./ApplyDialog");
const ApplyDialog = lazy(loadApply);

const SIMILAR = 5;

export async function loader({ params, request }: Route.LoaderArgs) {
  const headers = forwardHeaders(request);
  const v = orThrow(await api.GET("/vacancies/{vacancy}", { params: { path: { vacancy: params.slug } }, headers }));
  // Same category, newest first; one extra so the current vacancy can be dropped. null = the
  // call failed (the aside shows a retry), [] = nothing similar.
  const similar = await soft<Similar[] | null>(
    api.GET("/vacancies", { params: { query: { category_id: v.category_id, limit: SIMILAR + 1 } }, headers }),
    null,
  );
  return { v, similar: similar && similar.filter((s) => s.id !== v.id).slice(0, SIMILAR) };
}

export const handle: ShellHandle = {
  // An open vacancy brings its own sticky Apply bar on phones: one floating glass bar at the
  // bottom, not two stacked (closed ones have no bar, so the tab bar stays).
  tabBar: (m) => (m.loaderData as { v?: { status?: string } } | undefined)?.v?.status !== "published",
};

export function meta({ matches, loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [];
  const { t, locale } = metaT(matches);
  const v = data.v;
  return seo({
    title: `${v.title}, ${v.company.name} | Job Vacancy`,
    description: `${salary(v.salary, t, locale)}. ${plainText(v.description, 140)}`,
    path: location.pathname,
    image: v.company.logo_url,
    noindex: v.status !== "published",
  });
}

const EMPLOYMENT_LD: Record<string, string> = {
  full_time: "FULL_TIME", part_time: "PART_TIME", project: "CONTRACTOR", internship: "INTERN", volunteer: "VOLUNTEER",
};
const EXPERIENCE_MONTHS: Record<string, number> = { "1_3": 12, "3_6": 36, "6_plus": 72 };

const TZ = "Asia/Tashkent";
/** "24-oktabr 2026" / "24 октября 2026 г." / "October 24, 2026" — the same on server and client. */
function longDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (locale === "uz" || locale === "uz-Cyrl") {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d);
    const p = (type: string) => Number(parts.find((x) => x.type === type)?.value);
    return `${p("day")}-${monthNames(locale, "long")[p("month") - 1]} ${p("year")}`;
  }
  return new Intl.DateTimeFormat(htmlLang[locale], { timeZone: TZ, dateStyle: "long" }).format(d);
}

const H2 = "font-display text-lg font-semibold tracking-heading text-ink md:text-xl";
// Page-level cards: the "lg" padding, one step tighter on phones so 360px keeps a readable measure.
const CARD_PAD = "p-5 sm:p-6 md:p-8";
// Skills / address: sub-parts of the description card, one step quieter than its title.
const H2_SUB = "text-lead font-semibold tracking-snug text-ink";

export default function VacancyPage({ loaderData }: Route.ComponentProps) {
  const { v, similar } = loaderData;
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const { user } = useSession();
  const [applyOpen, setApplyOpen] = useState(false);

  const region = nameOf(idx.regions.get(v.region_id)?.name, locale);
  const district = v.district_id ? nameOf(idx.regions.get(v.district_id)?.name, locale) : "";
  const category = nameOf(idx.categories.get(v.category_id)?.name, locale);
  const place = [district, region].filter(Boolean).join(", ");
  const open = v.status === "published";
  // Employers can't apply; everyone else can (anonymous visitors get the sign-in step).
  const canApply = open && user?.role !== "employer";
  const hasPay = v.salary != null && (v.salary.min != null || v.salary.max != null);
  const pay = salary(v.salary, t, locale);
  const categoryHref = `/vacancies?category_id=${v.category_id}`;
  const apply = () => setApplyOpen(true);
  // Hovering or focusing an Apply button fetches the dialog's code before the click.
  const preload = { onPointerEnter: () => void loadApply(), onFocus: () => void loadApply() };

  const WorkIcon = v.work_format === "remote" ? House : Building2;
  const facts: { id: string; Icon: ComponentType<{ className?: string }>; label: string; value: string }[] = [
    { id: "experience", Icon: BriefcaseBusiness, label: t("jobs.filters.experience"), value: t(`enums.experience.${v.experience}`) },
    { id: "employment", Icon: Clock3, label: t("jobs.filters.employment"), value: t(`enums.employment_type.${v.employment_type}`) },
    { id: "schedule", Icon: CalendarDays, label: t("jobs.filters.schedule"), value: t(`enums.schedule.${v.schedule}`) },
    { id: "format", Icon: WorkIcon, label: t("jobs.filters.format"), value: t(`enums.work_format.${v.work_format}`) },
    ...(place ? [{ id: "place", Icon: MapPin, label: t("jobs.filters.region"), value: place }] : []),
    ...(category ? [{ id: "category", Icon: Layers, label: t("jobs.filters.category"), value: category }] : []),
  ];
  // Hairline grid (gap-px over bg-line): every row must be full, so the last cell stretches over
  // whatever is left of its row — 2 columns on phones, 3 from md.
  const n = facts.length;
  // (n is 4–6: region and category are required, so no "reset to 1" class is ever needed.)
  const lastSpan = cn(n % 2 === 1 && "col-span-2", n % 3 === 1 && "md:col-span-3", n % 3 === 2 && "md:col-span-2");

  return (
    <article aria-labelledby="vacancy-title" className="container-page pb-6 pt-4 md:pb-24 md:pt-8">
      <JobPostingLd v={v} region={region} district={district} category={category} />
      <Breadcrumbs
        items={[
          { label: t("nav.vacancies"), to: "/vacancies" },
          ...(category ? [{ label: category, to: categoryHref }] : []),
          { label: v.title },
        ]}
      />

      <div className="mt-3 grid gap-6 md:mt-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {!open && <StatusCallout v={v} categoryHref={categoryHref} />}

          <Card as="header" radius="sheet" padding="none" className={cn(CARD_PAD, "relative isolate overflow-hidden")}>
            {/* Cover band: the Samarkand light behind the logo, fading out before the text. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40">
              <div className="aurora-hero aurora-fade absolute inset-0 opacity-70" />
              <GirihPattern reveal={false} focus="ellipse 55% 100% at 88% 0%" />
            </div>

            <div className="flex items-center gap-4">
              <Avatar
                name={v.company.name}
                src={v.company.logo_url}
                square
                size="lg"
                priority
                className="shadow-2"
                style={{ viewTransitionName: `vacancy-logo-${v.id}` }}
              />
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 items-center gap-1.5 text-md font-medium text-ink">
                  <LocalizedLink
                    to={`/companies/${v.company.slug}`}
                    prefetch="intent"
                    className="truncate underline-offset-3 hover:text-lapis-ink hover:underline"
                  >
                    {v.company.name}
                  </LocalizedLink>
                  {v.company.verified && (
                    <>
                      <BadgeCheck aria-hidden="true" className="size-4.5 shrink-0 fill-firuza text-surface" />
                      <span className="sr-only">{t("common.verified")}</span>
                    </>
                  )}
                </p>
                {place && <p className="mt-0.5 truncate text-sm text-ink-2">{place}</p>}
              </div>
              {v.is_featured && (
                <Badge tone="zafaron" icon={<Star className="fill-current" />} className="shrink-0 self-start">
                  {t("common.featured")}
                </Badge>
              )}
            </div>

            <h1
              id="vacancy-title"
              className="mt-5 text-balance break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl"
              style={{ viewTransitionName: `vacancy-title-${v.id}` }}
            >
              {v.title}
            </h1>

            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span
                className={
                  hasPay
                    ? "num font-display text-xl font-semibold tracking-heading text-firuza-ink sm:text-2xl md:text-3xl"
                    : "text-lead font-medium text-ink-2"
                }
              >
                {pay}
              </span>
              {hasPay && <span className="text-md text-ink-2">{t("vacancyPage.perMonth")}</span>}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {canApply && (
                // Phones apply from the sticky bar at the bottom.
                <Button size="lg" onClick={apply} {...preload} className="max-md:hidden">
                  {t("common.apply")}
                </Button>
              )}
              <SaveButton id={v.id} withLabel className="max-md:flex-1 max-md:px-3 md:h-13 md:px-5" />
              <ShareMenu title={v.title} className="max-md:flex-1 max-md:px-3 md:h-13 md:px-5" />
              {v.can_edit && (
                <>
                  <Button variant="secondary" asChild icon={<PencilLine className="size-4.5" />} className="max-md:flex-1 md:h-13 md:px-5">
                    <LocalizedLink to={`/employer/vacancies/${v.id}/edit`}>{t("common.edit")}</LocalizedLink>
                  </Button>
                  <Button variant="ghost" asChild icon={<Users className="size-4.5" />} className="max-md:flex-1 md:h-13 md:px-5">
                    <LocalizedLink to={`/employer/vacancies/${v.id}/applications`}>{t("employer.applications")}</LocalizedLink>
                  </Button>
                </>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-3">
              {facts.map((f, i) => (
                <div
                  key={f.id}
                  className={cn("flex min-w-0 flex-col gap-2.5 bg-surface p-4 sm:flex-row", i === n - 1 && lastSpan)}
                >
                  <f.Icon aria-hidden="true" className="size-5 shrink-0 text-lapis" />
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-2">{f.label}</dt>
                    <dd className="mt-0.5 break-words text-md font-medium text-ink">{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
              {v.published_at && (
                <li className="inline-flex items-center gap-1.5">
                  <CalendarClock aria-hidden="true" className="size-4 text-ink-3" />
                  <RelTime iso={v.published_at} template={(when) => t("jobs.posted", { when })} />
                </li>
              )}
              {open && v.expires_at && (
                <li className="inline-flex items-center gap-1.5">
                  <Hourglass aria-hidden="true" className="size-4 text-ink-3" />
                  <time dateTime={v.expires_at}>{t("vacancyPage.expires", { date: longDate(v.expires_at, locale) })}</time>
                </li>
              )}
              <li className="num inline-flex items-center gap-1.5">
                <Eye aria-hidden="true" className="size-4 text-ink-3" />
                {t("vacancyPage.views", { count: v.views_count, n: groupDigits(v.views_count) })}
              </li>
              <li className="num inline-flex items-center gap-1.5">
                <Users aria-hidden="true" className="size-4 text-ink-3" />
                {t("vacancyPage.applicants", { count: v.applications_count, n: groupDigits(v.applications_count) })}
              </li>
            </ul>
          </Card>

          <Card as="section" radius="sheet" padding="none" aria-labelledby="about-job" className={CARD_PAD}>
            <h2 id="about-job" className={H2}>{t("jobs.description")}</h2>
            <RichText text={v.description} className="rich-text mt-4" />

            {v.skills.length > 0 && (
              <section aria-labelledby="job-skills" className="mt-8 border-t border-line pt-6">
                <h2 id="job-skills" className={H2_SUB}>{t("jobs.skills")}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {v.skills.map((s) => (
                    <li key={s.id} className="flex max-w-full">
                      <LocalizedLink
                        to={`/vacancies?q=${encodeURIComponent(s.name)}`}
                        prefetch="intent"
                        aria-label={t("vacancyPage.skillSearch", { name: s.name })}
                        // Chip look (36px; 44px hit area on touch) — a link to the search, not a toggle.
                        className={cn(
                          "relative inline-flex h-9 max-w-full items-center rounded-pill border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink-2",
                          "transition-[background-color,border-color,color,scale] duration-150 ease-spring hover:border-ink-3 hover:text-ink active:scale-[0.97]",
                          "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.25",
                        )}
                      >
                        <span className="truncate">{s.name}</span>
                      </LocalizedLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {v.address && (
              <section aria-labelledby="job-address" className="mt-8 border-t border-line pt-6">
                <h2 id="job-address" className={H2_SUB}>{t("jobs.address")}</h2>
                <div className="mt-3 flex items-start gap-3">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis">
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-md font-medium text-ink">{v.address}</p>
                    {place && <p className="mt-0.5 break-words text-sm text-ink-2">{place}</p>}
                    <a
                      href={`https://yandex.uz/maps/?text=${encodeURIComponent([v.address, place].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-md font-medium text-lapis-ink underline-offset-3 hover:underline"
                    >
                      {t("vacancyPage.openMap")}
                      <ExternalLink aria-hidden="true" className="size-4" />
                      <span className="sr-only">{t("vacancyPage.newTab")}</span>
                    </a>
                  </div>
                </div>
              </section>
            )}

            {canApply && (
              // After reading the whole text the Apply button is right here (from md; phones have the bar).
              <div className="mt-8 hidden items-center justify-between gap-6 border-t border-line pt-6 md:flex">
                <div className="min-w-0">
                  <p className="text-lead font-semibold tracking-snug text-ink">{t("vacancyPage.ctaTitle")}</p>
                  <p className="mt-0.5 text-md text-ink-2">{t("vacancyPage.ctaBody", { company: v.company.name })}</p>
                </div>
                <Button size="lg" onClick={apply} {...preload} className="shrink-0">
                  {t("common.apply")}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
          <CompanyCard company={v.company} />
          <SimilarCard items={similar} categoryHref={categoryHref} />
        </aside>
      </div>

      {canApply && <ApplyBar v={v} pay={pay} hasPay={hasPay} onApply={apply} preload={preload} />}

      {applyOpen && (
        <Suspense>
          <ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} vacancy={v} />
        </Suspense>
      )}
    </article>
  );
}

/** Closed / not yet published: owners see the moderation status, visitors a way out. */
function StatusCallout({ v, categoryHref }: { v: Vacancy; categoryHref: string }) {
  const { t } = useTranslation();
  if (v.can_edit) {
    return (
      <Callout tone={v.status === "rejected" ? "danger" : "warning"} title={t(`vacancyStatus.${v.status}`)}>
        {v.status === "rejected" && v.reject_reason ? v.reject_reason : t(`vacancyPage.ownerHint.${v.status}`)}
      </Callout>
    );
  }
  return (
    <Callout
      tone="warning"
      title={t("jobs.closed")}
      action={
        <Button asChild variant="secondary" size="sm">
          <LocalizedLink to={categoryHref} prefetch="intent">{t("vacancyPage.similarCta")}</LocalizedLink>
        </Button>
      }
    >
      {t("vacancyPage.closedBody")}
    </Callout>
  );
}

function CompanyCard({ company }: { company: Vacancy["company"] }) {
  const { t } = useTranslation();
  const to = `/companies/${company.slug}`;
  return (
    <Card as="section" padding="none" aria-labelledby="company-card-title" className="overflow-hidden">
      <div className="p-5">
        <p className="text-xs font-semibold uppercase tracking-caps text-ink-2">{t("jobs.aboutCompany")}</p>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={company.name} src={company.logo_url} square size="md" />
          <div className="min-w-0 flex-1">
            <h2 id="company-card-title" className="truncate text-lead font-semibold tracking-snug text-ink">
              <LocalizedLink to={to} prefetch="intent" className="underline-offset-3 hover:text-lapis-ink hover:underline">
                {company.name}
              </LocalizedLink>
            </h2>
            {company.verified && (
              <p className="mt-0.5 flex items-center gap-1 text-sm font-medium text-firuza-ink">
                <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
                {t("vacancyPage.verifiedCompany")}
              </p>
            )}
          </div>
        </div>
      </div>
      <FooterLink to={to}>{t("vacancyPage.companyJobs")}</FooterLink>
    </Card>
  );
}

/** "See all →" row closing an aside card (full-width 44px target). */
function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <div className="border-t border-line p-2">
      <LocalizedLink
        to={to}
        prefetch="intent"
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-control px-3 text-center text-md font-medium text-lapis-ink transition-colors duration-150 hover:bg-sunken"
      >
        {children}
        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
      </LocalizedLink>
    </div>
  );
}

function SimilarCard({ items, categoryHref }: { items: Similar[] | null; categoryHref: string }) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  return (
    <Card as="section" padding="none" aria-labelledby="similar-title" className="overflow-hidden">
      <h2 id="similar-title" className="px-5 pt-5 text-lead font-semibold tracking-snug text-ink">{t("vacancyPage.similar")}</h2>
      {items === null ? (
        <ErrorState compact onRetry={() => revalidator.revalidate()} className="m-3" />
      ) : items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<SearchX />}
          title={t("vacancyPage.similarEmpty")}
          body={t("vacancyPage.similarEmptyBody")}
          action={
            <Button asChild variant="secondary" size="sm">
              <LocalizedLink to="/vacancies" prefetch="intent">{t("vacanciesPage.allVacancies")}</LocalizedLink>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="mt-2 divide-y divide-line border-t border-line">
            {items.map((s) => <SimilarRow key={s.id} s={s} />)}
          </ul>
          <FooterLink to={categoryHref}>{t("vacancyPage.similarAll")}</FooterLink>
        </>
      )}
    </Card>
  );
}

function SimilarRow({ s }: { s: Similar }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const to = `/vacancies/${s.slug}`;
  // Only the row being opened carries the shared-element names (one snapshot, not five).
  const morph = useViewTransitionState(localizedPath(locale, to));
  const hasPay = s.salary != null && (s.salary.min != null || s.salary.max != null);
  return (
    <li
      className={cn(
        "relative flex gap-3 px-5 py-3.5 transition-colors duration-150 hover:bg-sunken/60",
        // Keyboard focus rings the whole row (the stretched link hides its own outline).
        "has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:-outline-offset-2 has-[[data-card-link]:focus-visible]:outline-focus",
      )}
    >
      <Avatar
        name={s.company.name}
        src={s.company.logo_url}
        square
        size="sm"
        style={morph ? { viewTransitionName: `vacancy-logo-${s.id}` } : undefined}
      />
      <div className="min-w-0 flex-1">
        <h3
          className="line-clamp-2 break-words text-md font-medium text-ink"
          style={morph ? { viewTransitionName: `vacancy-title-${s.id}` } : undefined}
        >
          <LocalizedLink to={to} prefetch="intent" viewTransition data-card-link="" className="after:absolute after:inset-0 focus-visible:outline-none">
            {s.title}
          </LocalizedLink>
        </h3>
        <p className="mt-0.5 truncate text-sm text-ink-2">{s.company.name}</p>
        <p className={cn("mt-1 truncate", hasPay ? "num font-display text-sm font-semibold text-firuza-ink" : "text-sm text-ink-2")}>
          {salary(s.salary, t, locale)}
        </p>
      </div>
    </li>
  );
}

/**
 * Phones: salary + Apply in a floating glass pill that sticks to the bottom while the
 * vacancy is on screen and comes to rest at the end of the article (so it never covers the
 * footer). The route hides the tab bar, so it's the only glass layer at the bottom.
 */
function ApplyBar({ v, pay, hasPay, onApply, preload }: {
  v: Vacancy;
  pay: string;
  hasPay: boolean;
  onApply: () => void;
  preload: { onPointerEnter: () => void; onFocus: () => void };
}) {
  const { t } = useTranslation();
  // Toasts rise above the bar while this page is open (phones only; desktop toasts sit elsewhere).
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--toast-lift", "4.5rem");
    return () => void root.style.removeProperty("--toast-lift");
  }, []);
  return (
    <div className="glass-chrome sticky bottom-above-tabbar z-30 mt-6 flex items-center gap-3 rounded-pill p-2 pl-5 md:hidden">
      <div className="min-w-0 flex-1">
        {/* Only ink levels on chrome glass: the salary keeps the display face, not the colour. */}
        <p className={cn("truncate", hasPay ? "num font-display text-md font-semibold tracking-heading text-ink" : "text-md font-medium text-ink")}>
          {pay}
        </p>
        <p className="truncate text-xs text-ink-2">{v.company.name}</p>
      </div>
      <Button shape="pill" onClick={onApply} {...preload} className="shrink-0">
        {t("common.apply")}
      </Button>
    </div>
  );
}

/** schema.org JobPosting so the vacancy can appear in Google's job search. */
function JobPostingLd({ v, region, district, category }: { v: Vacancy; region: string; district: string; category: string }) {
  const locale = useLocale();
  if (v.status !== "published" || !v.published_at) return null;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: v.title,
    description: toHtml(v.description),
    datePosted: v.published_at,
    validThrough: v.expires_at ?? undefined,
    employmentType: EMPLOYMENT_LD[v.employment_type],
    url: SITE + localizedPath(locale, `/vacancies/${v.slug}`),
    identifier: { "@type": "PropertyValue", name: v.company.name, value: v.id },
    hiringOrganization: {
      "@type": "Organization",
      name: v.company.name,
      sameAs: SITE + localizedPath(locale, `/companies/${v.company.slug}`),
      logo: v.company.logo_url ?? undefined,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: v.address ?? undefined,
        addressLocality: district || region || undefined,
        addressRegion: region || undefined,
        addressCountry: "UZ",
      },
    },
    industry: category || undefined,
    skills: v.skills.length ? v.skills.map((s) => s.name).join(", ") : undefined,
    directApply: true,
  };
  const months = EXPERIENCE_MONTHS[v.experience];
  if (months) ld.experienceRequirements = { "@type": "OccupationalExperienceRequirements", monthsOfExperience: months };
  if (v.work_format === "remote") {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "UZ" };
  }
  if (v.salary && (v.salary.min != null || v.salary.max != null)) {
    const { min, max } = v.salary;
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: v.salary.currency ?? "UZS",
      value:
        min != null && max != null && min === max
          ? { "@type": "QuantitativeValue", value: min, unitText: "MONTH" }
          : { "@type": "QuantitativeValue", minValue: min ?? undefined, maxValue: max ?? undefined, unitText: "MONTH" },
    };
  }
  // "<" is escaped so vacancy text can never close the script tag.
  const json = JSON.stringify(ld).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
