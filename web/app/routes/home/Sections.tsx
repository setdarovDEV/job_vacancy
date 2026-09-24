import { BadgeCheck, BriefcaseBusiness, ExternalLink, SearchX, Send, UserRound } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useRevalidator } from "react-router";

import { useSession } from "~/shared/auth/session";
import { indexCatalog, nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { useSpotlight } from "~/shared/lib/spotlight";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Card, CardLink } from "~/shared/ui/Card";
import { EmptyState } from "~/shared/ui/EmptyState";
import { ErrorState } from "~/shared/ui/ErrorState";
import { VacancyRow } from "~/shared/vacancy/VacancyRow";
import { TELEGRAM_BOT, type CompanyTile, type Section, type VacancyCard } from "./data";
import { band, est, SectionHead, SeeAll } from "./SectionHead";

/** Retry for a section whose part of the loader failed: re-runs the loader, keeps the page. */
function useRetry() {
  const rv = useRevalidator();
  return { retry: () => rv.revalidate(), busy: rv.state === "loading" };
}

export function FreshVacancies({ data }: { data: Section<VacancyCard[]> }) {
  const { t } = useTranslation();
  const { retry, busy } = useRetry();
  const list = useSpotlight<HTMLUListElement>();
  return (
    <section aria-labelledby="home-fresh" className={band} style={est(80)}>
      <SectionHead
        id="home-fresh"
        title={t("homePage.fresh.title")}
        description={t("homePage.fresh.body")}
        action={<SeeAll to="/vacancies?sort=newest">{t("shell.footer.allVacancies")}</SeeAll>}
      />
      {!data.ok ? (
        <Card padding="none" aria-busy={busy || undefined} className="mt-6 md:mt-8">
          <ErrorState compact error={data.error} onRetry={retry} />
        </Card>
      ) : data.data.length === 0 ? (
        <Card padding="none" className="mt-6 md:mt-8">
          <EmptyState
            icon={<SearchX />}
            title={t("homePage.fresh.emptyTitle")}
            body={t("homePage.fresh.emptyBody")}
            action={<Button asChild variant="secondary"><LocalizedLink to="/employers">{t("nav.postVacancy")}</LocalizedLink></Button>}
          />
        </Card>
      ) : (
        // One column with four cards below lg, three full rows of two from lg (the cards lay
        // themselves out by their own width). No stagger and lazy logos: it's below the fold.
        <ul ref={list} className="mt-6 grid gap-3 md:mt-8 lg:grid-cols-2">
          {data.data.map((v, i) => (
            <li key={v.id} className={cn("min-w-0 lg:last:odd:col-span-2", i >= 4 && "hidden lg:block")}>
              <VacancyRow v={v} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TopCompanies({ data }: { data: Section<CompanyTile[]> }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const idx = useMemo(() => indexCatalog(catalog), [catalog]);
  const list = useSpotlight<HTMLUListElement>();
  const { retry, busy } = useRetry();
  if (data.ok && !data.data.length) return null; // no companies yet: nothing to show, no gap
  return (
    <section aria-labelledby="home-companies" className={band} style={est(56)}>
      <SectionHead
        id="home-companies"
        title={t("homePage.companies.title")}
        description={t("homePage.companies.body")}
        action={<SeeAll to="/companies">{t("homePage.companies.all")}</SeeAll>}
      />
      {!data.ok ? (
        <Card padding="none" aria-busy={busy || undefined} className="mt-6 md:mt-8">
          <ErrorState compact error={data.error} onRetry={retry} />
        </Card>
      ) : (
        <ul ref={list} className="mt-6 grid grid-cols-2 gap-3 md:mt-8 lg:grid-cols-4">
          {data.data.map((c, i) => {
            const meta = [
              nameOf(idx.categories.get(c.industry_id ?? -1)?.name, locale),
              nameOf(idx.regions.get(c.region_id ?? -1)?.name, locale),
            ].filter(Boolean).join(" · ");
            const open = c.open_vacancies ?? 0;
            return (
              // Six (three rows of two) below lg, eight (two rows of four) from lg.
              <li key={c.id} className={cn("min-w-0", i >= 6 && "hidden lg:block")}>
                <Card interactive padding="sm" className="spotlight flex h-full flex-col gap-3 md:p-5">
                  <Avatar name={c.name} src={c.logo_url} square size="lg" />
                  <div className="min-w-0">
                    <h3 className="flex min-w-0 items-start gap-1.5 text-md font-semibold text-ink">
                      <CardLink to={`/companies/${c.slug}`} prefetch="intent" className="line-clamp-2 min-w-0 break-words">
                        {c.name}
                      </CardLink>
                      {c.verified && (
                        // Same filled mark as on vacancy cards.
                        <>
                          <BadgeCheck aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 fill-firuza text-surface" />
                          <span className="sr-only">{t("common.verified")}</span>
                        </>
                      )}
                    </h3>
                    {meta && <p className="mt-0.5 truncate text-sm text-ink-2">{meta}</p>}
                  </div>
                  <p className={cn("num mt-auto text-sm font-medium", open ? "text-lapis-ink" : "text-ink-2")}>
                    {open ? t("homePage.companies.open", { count: open, n: groupDigits(open) }) : t("companies.noOpen")}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Step = { title: string; body: string };

function PathCard({ id, icon, eyebrow, title, body, steps, cta, aurora }: {
  id: string; icon: ReactNode; eyebrow: string; title: string; body: string; steps: Step[]; cta: ReactNode; aurora?: boolean;
}) {
  return (
    <Card as="article" aria-labelledby={id} padding="lg" className="relative isolate flex flex-col overflow-hidden">
      {/* The employer half sits on the brand light, which also carries its glass CTA. */}
      {aurora && <div aria-hidden="true" className="aurora-hero aurora-fade pointer-events-none absolute inset-0 -z-10" />}
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-caps text-ink-2">
        <span aria-hidden="true" className="text-lapis-ink [&_svg]:size-4">{icon}</span>
        {eyebrow}
      </p>
      <h3 id={id} className="mt-3 break-words font-display text-xl font-semibold tracking-heading text-ink">{title}</h3>
      <p className="mt-2 text-md text-ink-2">{body}</p>
      <ol className="mt-6 space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span aria-hidden="true" className="num grid size-9 shrink-0 place-items-center rounded-full bg-lapis-soft font-display text-md font-semibold text-lapis-ink">
              {i + 1}
            </span>
            <div className="min-w-0 pt-1">
              <p className="break-words text-md font-semibold text-ink">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-8 sm:justify-start">{cta}</div>
    </Card>
  );
}

const steps = (t: (k: string) => string, who: "seeker" | "employer"): Step[] =>
  [1, 2, 3].map((n) => ({ title: t(`homePage.paths.${who}.s${n}`), body: t(`homePage.paths.${who}.s${n}body`) }));

/** "I'm looking for a job" / "I'm hiring": three steps each and one CTA that fits the visitor. */
export function TwoPaths() {
  const { t } = useTranslation();
  const { user } = useSession();
  // Anonymous visitors (and the server render) get the sign-up paths; the CTA adapts once the
  // session is known. Labels stay the same where possible so buttons don't change width.
  const seeker = !user
    ? { to: "/register", label: t("homePage.paths.seeker.cta") }
    : user.role === "employer"
      ? { to: "/vacancies", label: t("homePage.paths.seeker.ctaBrowse") }
      : { to: "/me/resumes/new", label: t("homePage.paths.seeker.ctaResume") };
  const employer = !user ? "/register?role=employer" : user.role === "employer" ? "/employer/vacancies/new" : "/employers";
  return (
    <section aria-labelledby="home-paths" className={band} style={est(64)}>
      <SectionHead id="home-paths" title={t("homePage.paths.title")} description={t("homePage.paths.body")} />
      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2 md:gap-6">
        <PathCard
          id="home-path-seeker"
          icon={<UserRound />}
          eyebrow={t("homePage.paths.seeker.eyebrow")}
          title={t("homePage.paths.seeker.title")}
          body={t("homePage.paths.seeker.body")}
          steps={steps(t, "seeker")}
          cta={
            <Button asChild size="lg" shape="pill" className="w-full sm:w-auto">
              <LocalizedLink to={seeker.to}>{seeker.label}</LocalizedLink>
            </Button>
          }
        />
        <PathCard
          id="home-path-employer"
          aurora
          icon={<BriefcaseBusiness />}
          eyebrow={t("homePage.paths.employer.eyebrow")}
          title={t("homePage.paths.employer.title")}
          body={t("homePage.paths.employer.body")}
          steps={steps(t, "employer")}
          cta={
            <>
              <Button asChild size="lg" shape="pill" variant="glass" className="w-full sm:w-auto">
                <LocalizedLink to={employer}>{t("nav.postVacancy")}</LocalizedLink>
              </Button>
              {employer !== "/employers" && (
                <LocalizedLink
                  to="/employers"
                  prefetch="intent"
                  className="inline-flex min-h-11 items-center rounded-pill px-3 text-md font-medium text-lapis-ink hover:underline"
                >
                  {t("homePage.paths.employer.more")}
                </LocalizedLink>
              )}
            </>
          }
        />
      </div>
    </section>
  );
}

/** The 14 regions as chips into the filtered list (also the regional entry points for search engines). */
export function Regions() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { regions } = useCatalog();
  if (!regions.length) return null;
  return (
    <section aria-labelledby="home-regions" className={band} style={est(32)}>
      <SectionHead id="home-regions" title={t("homePage.regions.title")} description={t("homePage.regions.body")} />
      <ul className="mt-6 flex flex-wrap gap-2 md:mt-8">
        {regions.map((r) => (
          <li key={r.id} className="min-w-0">
            <LocalizedLink
              to={`/vacancies?region_id=${r.id}`}
              prefetch="intent"
              className="inline-flex min-h-11 max-w-full items-center rounded-pill border border-line bg-surface px-4 text-md font-medium text-ink-2 shadow-1 transition-colors hover:border-line-strong hover:text-ink active:scale-[0.97]"
            >
              <span className="truncate">{nameOf(r.name, locale)}</span>
            </LocalizedLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Closing band on the brand light: browse / post CTAs and the Telegram bot on a glass card. */
export function FinalCta() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="home-final" className={band} style={est(42)}>
      <Card radius="sheet" padding="none" className="relative isolate grid gap-8 overflow-hidden p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:p-12">
        <div aria-hidden="true" className="aurora-hero pointer-events-none absolute inset-0 -z-10" />
        <div className="min-w-0">
          <h2 id="home-final" className="reveal break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">
            {t("homePage.final.title")}
          </h2>
          <p className="mt-3 max-w-xl text-lead text-ink-2">{t("homePage.final.body")}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" shape="pill">
              <LocalizedLink to="/vacancies" prefetch="intent">{t("homePage.final.browse")}</LocalizedLink>
            </Button>
            <Button asChild size="lg" shape="pill" variant="glass">
              <LocalizedLink to="/employers" prefetch="intent">{t("nav.postVacancy")}</LocalizedLink>
            </Button>
          </div>
        </div>
        <div className="glass-panel min-w-0 rounded-panel p-5 md:p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis text-on-lapis shadow-2">
              <Send className="size-5" />
            </span>
            <h3 className="min-w-0 break-words text-lead font-semibold tracking-snug text-ink">{t("homePage.telegram.title")}</h3>
          </div>
          <p className="mt-3 text-md text-ink-2">{t("homePage.telegram.body")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Button asChild variant="secondary" shape="pill" icon={<ExternalLink className="size-4" />}>
              <a href={`https://t.me/${TELEGRAM_BOT}`} target="_blank" rel="noopener noreferrer">
                {t("homePage.telegram.open")}
                <span className="sr-only"> {t("shell.footer.newTab")}</span>
              </a>
            </Button>
            <LocalizedLink
              to="/me#notifications"
              className="inline-flex min-h-11 items-center rounded-pill px-3 text-md font-medium text-lapis-ink hover:underline"
            >
              {t("homePage.telegram.connect")}
            </LocalizedLink>
          </div>
        </div>
      </Card>
    </section>
  );
}
