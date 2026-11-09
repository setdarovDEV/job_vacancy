import { ArrowLeft, BadgeCheck, CalendarClock, Eye, PencilLine, Share2, Users } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import type { Route } from "./+types/index";
import { api, orThrow } from "~/shared/api/client";
import { useSession } from "~/shared/auth/session";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { salary } from "~/shared/lib/format";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo, SITE } from "~/shared/seo/seo";
import { SaveButton } from "~/shared/vacancy/SaveButton";
import { ReportButton } from "~/shared/report/ReportButton";
import { VacancyContent, VacancyFacts, useVacancyPlace } from "~/shared/vacancy/VacancyDetails";
import { Avatar } from "~/shared/ui/Avatar";
import { Badge } from "~/shared/ui/Badge";
import { Button } from "~/shared/ui/Button";
import { RelTime } from "~/shared/ui/RelTime";
import { toast } from "~/shared/ui/toast-store";

const ApplyDialog = lazy(() => import("./ApplyDialog"));

export async function loader({ params, request }: Route.LoaderArgs) {
  const res = await api.GET("/vacancies/{vacancy}", {
    params: { path: { vacancy: params.slug } },
    headers: forwardHeaders(request),
  });
  return { v: orThrow(res) };
}

export function meta({ matches, loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [];
  const { t } = metaT(matches);
  const v = data.v;
  const desc = v.description.replace(/\s+/g, " ").slice(0, 160);
  return seo({
    title: `${v.title}, ${v.company.name} | Job Vacancy`,
    description: `${salary(v.salary, t, "uz")}. ${desc}`,
    path: location.pathname,
    image: v.company.logo_url,
    noindex: v.status !== "published",
  });
}

const EMPLOYMENT_LD: Record<string, string> = {
  full_time: "FULL_TIME", part_time: "PART_TIME", project: "CONTRACTOR", internship: "INTERN", volunteer: "VOLUNTEER",
};

export default function VacancyPage({ loaderData }: Route.ComponentProps) {
  const { v } = loaderData;
  const { t } = useTranslation();
  const { user } = useSession();
  const [applyOpen, setApplyOpen] = useState(false);

  const place = useVacancyPlace(v);
  const open = v.status === "published";

  const share = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: v.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ tone: "success", title: t("jobs.linkCopied") });
      }
    } catch {
      /* the user closed the share sheet */
    }
  };

  const applyButton = (
    <Button size="lg" className="w-full sm:w-auto" disabled={!open} onClick={() => setApplyOpen(true)}>
      {t("common.apply")}
    </Button>
  );

  return (
    <article className="container-page pb-28 pt-6 md:pb-20 md:pt-8">
      <JobPostingLd v={v} place={place} />
      <LocalizedLink to="/vacancies" className="inline-flex items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" />
        {t("jobs.backToList")}
      </LocalizedLink>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!open && (
            <p className="mb-5 rounded-control bg-zafaron-soft px-4 py-3 text-sm font-medium text-zafaron-ink">
              {v.can_edit ? t(`vacancyStatus.${v.status}`) : t("jobs.closed")}
              {v.reject_reason && <span className="mt-1 block font-normal">{v.reject_reason}</span>}
            </p>
          )}
          <header className="rounded-sheet border border-line bg-surface p-5 md:p-8">
            <div className="flex items-start gap-4">
              <Avatar name={v.company.name} src={v.company.logo_url} square size="lg" className="max-sm:hidden" />
              <div className="min-w-0 flex-1">
                <h1 className="text-balance font-display text-2xl font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[2rem]">{v.title}</h1>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
                  <LocalizedLink to={`/companies/${v.company.slug}`} className="font-medium hover:text-lapis-ink hover:underline">
                    {v.company.name}
                  </LocalizedLink>
                  {v.company.verified && <BadgeCheck className="size-4.5 text-firuza" aria-label={t("common.verified")} />}
                  {v.is_featured && <Badge tone="zafaron">{t("common.featured")}</Badge>}
                </p>
              </div>
            </div>

            <VacancyFacts v={v} />

            <div className="mt-7 hidden flex-wrap items-center gap-2 sm:flex">
              {user?.role !== "employer" && applyButton}
              <SaveButton id={v.id} withLabel />
              <Button variant="ghost" size="md" icon={<Share2 className="size-4.5" />} onClick={share}>{t("jobs.share")}</Button>
              {v.can_edit && (
                <Button variant="secondary" asChild icon={<PencilLine className="size-4.5" />}>
                  <LocalizedLink to={`/employer/vacancies/${v.id}/edit`}>{t("common.edit")}</LocalizedLink>
                </Button>
              )}
            </div>
          </header>

          <VacancyContent v={v} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-panel border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <Avatar name={v.company.name} src={v.company.logo_url} square size="md" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{v.company.name}</p>
                {v.company.verified && <p className="text-xs font-medium text-firuza-ink">{t("common.verified")}</p>}
              </div>
            </div>
            <LocalizedLink to={`/companies/${v.company.slug}`} className="mt-4 inline-block text-sm font-medium text-lapis-ink hover:underline">
              {t("jobs.companyJobs")}
            </LocalizedLink>
          </div>
          <dl className="num flex flex-col gap-2.5 rounded-panel border border-line bg-surface p-5 text-sm text-ink-2">
            {v.published_at && (
              <div className="flex items-center gap-2"><CalendarClock className="size-4 text-ink-3" /><RelTime iso={v.published_at} template={(when) => t("jobs.posted", { when })} /></div>
            )}
            <div className="flex items-center gap-2"><Eye className="size-4 text-ink-3" />{t("jobs.views", { count: v.views_count })}</div>
            <div className="flex items-center gap-2"><Users className="size-4 text-ink-3" />{t("jobs.applicants", { count: v.applications_count })}</div>
          </dl>
          {open && <ReportButton target={{ type: "vacancy", id: v.id, name: v.title }} companyId={v.company.id} className="self-start text-ink-3" />}
        </aside>
      </div>

      {/* Phones: the primary actions stay within thumb reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-line glass-bar px-4 py-3 sm:hidden">
        {user?.role !== "employer" ? <div className="flex-1">{applyButton}</div> : <div className="flex-1" />}
        <SaveButton id={v.id} className="size-12 border border-line-strong" />
        <button type="button" onClick={share} aria-label={t("jobs.share")} className="grid size-12 place-items-center rounded-control border border-line-strong text-ink-2">
          <Share2 className="size-5" />
        </button>
      </div>

      {applyOpen && (
        <Suspense>
          <ApplyDialog open={applyOpen} onOpenChange={setApplyOpen} vacancy={v} />
        </Suspense>
      )}
    </article>
  );
}

/** schema.org JobPosting so the vacancy can appear in Google's job search. */
function JobPostingLd({ v, place }: { v: Route.ComponentProps["loaderData"]["v"]; place: string }) {
  if (v.status !== "published" || !v.published_at) return null;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: v.title,
    description: v.description.replace(/\n/g, "<br>"),
    datePosted: v.published_at,
    validThrough: v.expires_at ?? undefined,
    employmentType: EMPLOYMENT_LD[v.employment_type],
    hiringOrganization: { "@type": "Organization", name: v.company.name, sameAs: `${SITE}/companies/${v.company.slug}`, logo: v.company.logo_url ?? undefined },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: place, streetAddress: v.address ?? undefined, addressCountry: "UZ" } },
    directApply: true,
  };
  if (v.work_format === "remote") {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: "UZ" };
  }
  if (v.salary && (v.salary.min != null || v.salary.max != null)) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: v.salary.currency ?? "UZS",
      value: { "@type": "QuantitativeValue", minValue: v.salary.min ?? undefined, maxValue: v.salary.max ?? undefined, unitText: "MONTH" },
    };
  }
  // "<" is escaped so vacancy text can never close the script tag.
  const json = JSON.stringify(ld).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
