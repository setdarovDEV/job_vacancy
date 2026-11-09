import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { DEFAULT_STATS_PERIOD, STATS_PERIODS, STATS_STALE_MS } from "./charts/period";
import { RankedBars } from "./charts/RankedBars";
import { TrendCard } from "./charts/TrendCard";
import { useUrlFilters } from "./admin-ui";
import { adminKeys } from "./keys";
import { api, type Schemas } from "~/shared/api/client";
import { nameOf } from "~/shared/catalog/catalog";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { authed } from "~/shared/query/query";
import { Chip } from "~/shared/ui/Chip";
import { Skeleton } from "~/shared/ui/Skeleton";

type Activity = Schemas["AdminActivity"];
type Breakdown = Schemas["AdminBreakdown"];
type Series = keyof Activity["totals"];

// Reports are the one series where more is bad news.
const SERIES: { series: Series; label: string; upIsGood: boolean }[] = [
  { series: "signups_seeker", label: "admin.charts.signupsSeeker", upIsGood: true },
  { series: "signups_employer", label: "admin.charts.signupsEmployer", upIsGood: true },
  { series: "vacancies_published", label: "admin.charts.vacanciesPublished", upIsGood: true },
  { series: "applications_sent", label: "admin.charts.applicationsSent", upIsGood: true },
  { series: "reports_filed", label: "admin.charts.reportsFiled", upIsGood: false },
];

/**
 * The overview's statistics: one period filter (in the URL) above everything it scopes,
 * a daily trend per series, where vacancies were published, and the application funnel.
 * While another period loads, the previous one stays on screen, dimmed.
 */
export function StatsSection() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { values, set } = useUrlFilters(["days"] as const);
  const days = STATS_PERIODS.find((p) => String(p) === values.days) ?? DEFAULT_STATS_PERIOD;
  const activity = useQuery({
    queryKey: adminKeys.activity(days),
    queryFn: () => authed<Activity>(() => api.GET("/admin/stats/activity", { params: { query: { days } } })),
    placeholderData: keepPreviousData,
    staleTime: STATS_STALE_MS,
  });
  const breakdown = useQuery({
    queryKey: adminKeys.breakdown(days),
    queryFn: () => authed<Breakdown>(() => api.GET("/admin/stats/breakdown", { params: { query: { days } } })),
    placeholderData: keepPreviousData,
    staleTime: STATS_STALE_MS,
  });
  const a = activity.data;
  const b = breakdown.data;
  const stale = activity.isPlaceholderData || breakdown.isPlaceholderData;
  const f = b?.funnel;
  const share = (n: number) => (f && f.sent ? `${Math.round((n / f.sent) * 100)}%` : "");

  return (
    <section aria-labelledby="stats-title" className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="stats-title" className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{t("admin.charts.title")}</h2>
          <p className="text-sm text-ink-3">{t("admin.charts.hint")}</p>
        </div>
        <div role="group" aria-label={t("admin.charts.period")} className="flex gap-2">
          {STATS_PERIODS.map((p) => (
            <Chip key={p} selected={p === days} onClick={() => set("days", p === DEFAULT_STATS_PERIOD ? "" : String(p))}>
              {t("admin.charts.days", { n: p })}
            </Chip>
          ))}
        </div>
      </div>

      <div className={cn("transition-opacity duration-200", stale && "opacity-60")} aria-busy={stale || undefined}>
        {!a ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SERIES.map((s) => <Skeleton key={s.series} className="h-64 rounded-panel" />)}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SERIES.map((s) => (
              <TrendCard
                key={s.series}
                label={t(s.label)}
                upIsGood={s.upIsGood}
                days={a.period.days}
                current={a.totals[s.series].current}
                previous={a.totals[s.series].previous}
                points={a.daily.map((d) => ({ date: d.date, value: d[s.series] }))}
              />
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {!b ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-panel" />)
          ) : (
            <>
              <Panel title={t("admin.charts.topCategories")} hint={t("admin.charts.byVacancies")}>
                {b.top_categories.length ? (
                  <RankedBars label={t("admin.charts.topCategories")}
                    rows={b.top_categories.map((c) => ({ id: c.id, label: nameOf(c.name, locale), value: c.vacancies_published }))} />
                ) : <Empty />}
              </Panel>
              <Panel title={t("admin.charts.topRegions")} hint={t("admin.charts.byVacancies")}>
                {b.top_regions.length ? (
                  <RankedBars label={t("admin.charts.topRegions")}
                    rows={b.top_regions.map((r) => ({ id: r.id, label: nameOf(r.name, locale), value: r.vacancies_published }))} />
                ) : <Empty />}
              </Panel>
              <Panel title={t("admin.charts.funnel")} hint={t("admin.charts.funnelHint")}>
                {f && f.sent ? (
                  <RankedBars label={t("admin.charts.funnel")} max={f.sent} rows={[
                    { id: "sent", label: t("admin.charts.stage.sent"), value: f.sent },
                    { id: "viewed", label: t("admin.charts.stage.viewed"), value: f.viewed, note: share(f.viewed) },
                    { id: "invited", label: t("admin.charts.stage.invited"), value: f.invited, note: share(f.invited) },
                    { id: "hired", label: t("admin.charts.stage.hired"), value: f.hired, note: share(f.hired) },
                  ]} />
                ) : <Empty />}
              </Panel>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-5" aria-label={title}>
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mb-4 mt-0.5 text-xs text-ink-3">{hint}</p>
      {children}
    </section>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <p className="py-8 text-center text-sm text-ink-3">{t("admin.charts.empty")}</p>;
}
