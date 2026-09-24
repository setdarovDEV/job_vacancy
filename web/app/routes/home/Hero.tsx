import { ArrowRight } from "lucide-react";
import { Fragment, useMemo, type CSSProperties } from "react";

import { GirihPattern } from "~/shared/brand/GirihPattern";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { cn } from "~/shared/lib/cn";
import { groupDigits } from "~/shared/lib/format";
import { SearchBar } from "~/shared/ui/SearchBar";
import { StatCard } from "~/shared/ui/StatCard";
import { popularFor, type Count } from "./data";

export type HeroStats = { total: Count | null; remote: number | null; withSalary: number | null; lastDay: Count | null };

const shown = (c: Count) => `${groupDigits(c.n)}${c.capped ? "+" : ""}`;

/** "Best *work* is here" → the starred word in lapis. The whole sentence stays one translation. */
function accent(text: string) {
  return text.split("*").map((part, i) => (
    <Fragment key={i}>{i % 2 ? <span className="text-lapis">{part}</span> : part}</Fragment>
  ));
}

/**
 * Home hero: aurora + girih, live "new in 24 hours" pill, H1, the glass search with region and
 * suggestions, popular searches and three honest stats. The H1, lead and search never fade in
 * (they are the LCP); only the decorative layers animate.
 */
export function Hero({ popular, stats }: { popular: string[]; stats: HeroStats }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog();
  const regions = useMemo(
    () => catalog.regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) })),
    [catalog, locale],
  );

  return (
    <section aria-labelledby="home-title" className="relative isolate">
      {/* The aurora runs up under the header, which is clear at rest, so the page starts in colour. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade anim-fade pointer-events-none absolute inset-x-0 -top-(--header-h) bottom-0 -z-10"
        style={{ animationDuration: "var(--dur-4)" }}
      />
      <GirihPattern className="-z-10" focus="ellipse 70% 70% at 50% 35%" />
      <div className="container-page pb-10 pt-8 text-center sm:pt-14 md:pb-16 md:pt-24">
        {stats.lastDay && stats.lastDay.n > 0 && <LastDayPill count={stats.lastDay} />}
        <h1
          id="home-title"
          className="mx-auto max-w-4xl break-words font-display text-2xl font-semibold tracking-display text-ink sm:text-4xl md:text-5xl"
        >
          {accent(t("homePage.title"))}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lead text-ink-2 md:mt-5">{t("homePage.lead")}</p>
        <SearchBar
          action="/vacancies"
          size="lg"
          material="glass"
          regions={regions}
          suggest
          recent
          className="mx-auto mt-7 max-w-3xl text-left md:mt-10"
        />
        <PopularSearches items={popularFor(popular, locale, t("search.examples"))} />
        <Stats stats={stats} />
      </div>
    </section>
  );
}

/** Glass pill above the H1: vacancies of the last 24 hours, linking to the newest first. */
function LastDayPill({ count }: { count: Count }) {
  const { t } = useTranslation();
  // One translated sentence; the number is set bold where the sentence puts it.
  const [before, after] = t("homePage.lastDay", { count: count.n, n: "\u0000" }).split("\u0000");
  return (
    // The link is 44px tall for touch; the glass pill inside stays compact.
    <LocalizedLink
      to="/vacancies?sort=newest"
      prefetch="intent"
      className="mx-auto mb-3 flex w-fit max-w-full rounded-pill py-1.5 md:mb-5"
    >
      <span className="glass-panel glass-interactive flex min-w-0 items-center gap-2 rounded-pill px-3.5 py-1.5 text-sm font-medium text-ink-2">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-firuza" />
        <span className="min-w-0">
          {before}
          <b className="num font-semibold text-ink">{shown(count)}</b>
          {after}
        </span>
        <ArrowRight aria-hidden="true" className="size-3.5 shrink-0" />
      </span>
    </LocalizedLink>
  );
}

const pill = "inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-3.5 text-sm font-medium text-ink-2";

function PopularSearches({ items }: { items: string[] }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  const label = <span aria-hidden="true" className="shrink-0 text-sm text-ink-2">{t("search.popular")}:</span>;
  const links = (className: string) =>
    items.map((q) => (
      <li key={q} className="shrink-0">
        <LocalizedLink to={`/vacancies?q=${encodeURIComponent(q)}`} prefetch="intent" className={cn(pill, className)}>
          {q}
        </LocalizedLink>
      </li>
    ));
  return (
    <nav aria-label={t("search.popular")} className="mt-4 md:mt-6">
      {/* Phones: one solid row that scrolls sideways (no blur inside a scroller), 44px targets. */}
      <div className="scrollbar-none edge-mask-x -mx-4 flex items-center gap-2 overflow-x-auto overscroll-x-contain px-4 md:hidden">
        {label}
        <ul className="flex gap-2">
          {links("h-11 border border-line bg-surface shadow-1 transition-transform active:scale-[0.97]")}
        </ul>
      </div>
      {/* md+: glass pills resting on the aurora, wrapped and centred. */}
      <div className="mx-auto hidden max-w-3xl flex-wrap items-center justify-center gap-2 md:flex">
        {label}
        <ul className="flex flex-wrap justify-center gap-2">{links("glass-panel glass-interactive h-9 pointer-coarse:h-11")}</ul>
      </div>
    </nav>
  );
}

type Tile = { id: string; label: string; value: string; tone?: "firuza" };

function Stats({ stats }: { stats: HeroStats }) {
  const { t } = useTranslation();
  const tiles: Tile[] = [];
  if (stats.total) tiles.push({ id: "total", label: t("homePage.stats.vacancies"), value: shown(stats.total) });
  if (stats.remote != null) tiles.push({ id: "remote", label: t("homePage.stats.remote"), value: groupDigits(stats.remote) });
  if (stats.withSalary != null) {
    // Firuza is the money colour: this stat is about salaries being shown.
    tiles.push({ id: "salary", label: t("homePage.stats.withSalary"), value: groupDigits(stats.withSalary), tone: "firuza" });
  }
  // Nothing to show, or a brand-new site with no vacancies yet: zeros sell nothing.
  if (!tiles.length || stats.total?.n === 0) return null;
  const cols: CSSProperties = { gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` };
  return (
    <>
      {/* Phones: one glass panel instead of three tiles (one blur layer, ~90px shorter). */}
      <dl
        className="glass-panel mx-auto mt-6 grid max-w-md divide-x divide-line rounded-panel py-3 md:hidden"
        style={cols}
      >
        {tiles.map((s) => (
          <div key={s.id} className="min-w-0 px-2">
            <dt className="truncate text-xs text-ink-2">{s.label}</dt>
            <dd className={cn("num mt-0.5 font-display text-lg font-semibold tracking-heading", s.tone ? "text-firuza-ink" : "text-ink")}>
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mx-auto mt-10 hidden max-w-3xl gap-3 md:grid" style={cols}>
        {tiles.map((s, i) => (
          // Staggered once on first paint (the tiles aren't the LCP; the H1 is).
          <div key={s.id} className="anim-enter min-w-0" style={{ "--i": i } as CSSProperties}>
            <StatCard size="sm" material="glass" label={s.label} value={s.value} tone={s.tone ?? "ink"} />
          </div>
        ))}
      </div>
    </>
  );
}
