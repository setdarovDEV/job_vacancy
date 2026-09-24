import type { Route } from "./+types/home";
import { api, soft } from "~/shared/api/client";
import { htmlLang, localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo, SITE } from "~/shared/seo/seo";
import { Categories } from "./home/Categories";
import {
  lastDay, LATEST_WINDOW, pickCompanies, pickFresh, settle, TELEGRAM_BOT,
  type CompanyTile, type Count, type Section, type VacancyCard,
} from "./home/data";
import { Hero } from "./home/Hero";
import { FinalCta, FreshVacancies, Regions, TopCompanies, TwoPaths } from "./home/Sections";

/**
 * One round trip of parallel, individually soft calls: every section degrades on its own (a
 * compact error with Retry, or it steps aside) and never takes the page down with it.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const headers = forwardHeaders(request);
  const [latest, withSalary, companies, popular] = await Promise.all([
    settle<VacancyCard[]>(api.GET("/vacancies", { params: { query: { sort: "newest", limit: LATEST_WINDOW } }, headers })),
    // limit=1: only meta.total is read.
    settle<VacancyCard[]>(api.GET("/vacancies", { params: { query: { with_salary: true, limit: 1 } }, headers })),
    settle<Parameters<typeof pickCompanies>[0]>(api.GET("/companies", { headers })),
    soft<string[]>(api.GET("/search/popular", { headers }) as never, []),
  ]);
  const count = (s: typeof withSalary | typeof companies): Count | null =>
    s.ok && s.data.meta.total != null ? { n: s.data.meta.total, capped: Boolean(s.data.meta.total_capped) } : null;
  const fresh: Section<VacancyCard[]> = latest.ok ? { ok: true, data: pickFresh(latest.data.items) } : latest;
  const top: Section<CompanyTile[]> = companies.ok ? { ok: true, data: pickCompanies(companies.data.items) } : companies;
  return {
    popular,
    stats: {
      total: count(latest),
      companies: count(companies),
      withSalary: count(withSalary),
      lastDay: latest.ok ? lastDay(latest.data.items, latest.data.meta, Date.now()) : null,
    },
    fresh,
    companies: top,
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({
    title: `Job Vacancy: ${t("homePage.metaTitle")}`,
    description: t("homePage.metaDescription"),
    path: location.pathname,
  });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <JsonLd />
      <Hero popular={loaderData.popular} stats={loaderData.stats} />
      <Categories />
      <FreshVacancies data={loaderData.fresh} />
      <TopCompanies data={loaderData.companies} />
      <TwoPaths />
      <Regions />
      <FinalCta />
    </>
  );
}

/** WebSite + SearchAction (sitelinks search box) and the Organization, in the page's language. */
function JsonLd() {
  const locale = useLocale();
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE + localizedPath(locale, "/"),
        name: "Job Vacancy",
        inLanguage: htmlLang[locale],
        publisher: { "@id": `${SITE}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE}${localizedPath(locale, "/vacancies")}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${SITE}/#organization`,
        name: "Job Vacancy",
        url: SITE,
        logo: `${SITE}/favicon.svg`,
        sameAs: [`https://t.me/${TELEGRAM_BOT}`],
      },
    ],
  };
  // "<" is escaped so no string can ever close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />;
}
