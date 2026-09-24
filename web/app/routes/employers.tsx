import type { Route } from "./+types/employers";
import { api } from "~/shared/api/client";
import { metaT } from "~/shared/seo/meta";
import { forwardHeaders, seo } from "~/shared/seo/seo";
import { CandidatesTeaser } from "./employers/Candidates";
import { Faq, FinalCta } from "./employers/Faq";
import { Features, Steps } from "./employers/Features";
import { Hero } from "./employers/Hero";
import { AiBlock, Pricing } from "./employers/Pricing";
import { pickLogos, Proof, type ProofStats } from "./employers/Proof";

/**
 * Two parallel, individually soft calls feed the proof strip (live totals + companies hiring
 * here). Everything else on this sales page is static, so a failing API only hides that strip.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const headers = forwardHeaders(request);
  const [companies, vacancies] = await Promise.all([
    api.GET("/companies", { headers }).then((r) => r.data ?? null, () => null),
    api.GET("/vacancies", { params: { query: { limit: 1 } }, headers }).then((r) => r.data ?? null, () => null),
  ]);
  const stats: ProofStats = {
    vacancies: vacancies?.meta?.total != null ? { n: vacancies.meta.total, capped: Boolean(vacancies.meta.total_capped) } : null,
    companies: companies?.meta.total ?? null,
  };
  return { companies: companies ? pickLogos(companies.data) : [], stats };
}

export function meta({ matches, location }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return seo({
    title: `${t("employersPage.metaTitle")} | Job Vacancy`,
    description: t("employersPage.metaDescription"),
    path: location.pathname,
  });
}

export default function Employers({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Hero />
      <div className="pb-8 md:pb-12">
        <Proof companies={loaderData.companies} stats={loaderData.stats} />
        <Features />
        <Steps />
        <CandidatesTeaser />
        <AiBlock />
        <Pricing />
        <Faq />
        <FinalCta />
      </div>
    </>
  );
}
