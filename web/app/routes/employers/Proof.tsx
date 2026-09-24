import { BadgeCheck, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import type { Schemas } from "~/shared/api/client";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { groupDigits } from "~/shared/lib/format";
import { Avatar } from "~/shared/ui/Avatar";
import { IconButton } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { est } from "./parts";

export type ProofCompany = Pick<Schemas["Company"], "id" | "name" | "slug" | "logo_url" | "verified">;
export type ProofStats = { vacancies: { n: number; capped: boolean } | null; companies: number | null };

/** Up to 12 companies for the logo row: the API's order (verified first), hiring ones preferred. */
export function pickLogos(items: Schemas["Company"][]): ProofCompany[] {
  const hiring = items.filter((c) => (c.open_vacancies ?? 0) > 0);
  return (hiring.length >= 6 ? hiring : items)
    .slice(0, 12)
    .map(({ id, name, slug, logo_url, verified }) => ({ id, name, slug, logo_url, verified }));
}

/**
 * Proof strip under the hero: live platform numbers and the companies hiring here. Both come
 * from the loader's soft calls; whatever failed simply isn't shown (it's a sales page, not data
 * the visitor came for), and the strip disappears when nothing real is left to show.
 */
export function Proof({ companies, stats }: { companies: ProofCompany[]; stats: ProofStats }) {
  const { t } = useTranslation();
  const tiles: { id: string; label: string; to: number; suffix?: string }[] = [];
  if (stats.vacancies && stats.vacancies.n > 0) {
    tiles.push({ id: "vacancies", label: t("employersPage.proof.vacancies"), to: stats.vacancies.n, suffix: stats.vacancies.capped ? "+" : "" });
  }
  if (stats.companies) tiles.push({ id: "companies", label: t("employersPage.proof.companies"), to: stats.companies });
  if (!tiles.length && !companies.length) return null;
  // A fact rather than data: the four interface and search languages.
  tiles.push({ id: "languages", label: t("employersPage.proof.languages"), to: 4 });
  const cols: CSSProperties = { gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` };

  return (
    // No top padding: the hero's own bottom padding (room for the floating toast) is the gap.
    <section aria-labelledby="employers-proof" className="container-page defer-paint pb-8 md:pb-12" style={est(18)}>
      <h2 id="employers-proof" className="sr-only">{t("employersPage.proof.label")}</h2>
      <Card as="dl" padding="none" className="mx-auto grid max-w-3xl divide-x divide-line py-4 text-center md:py-6" style={cols}>
        {tiles.map((s) => (
          // column-reverse keeps dt before dd in the DOM; justify-end packs both at the top so the numbers line up.
          <div key={s.id} className="flex min-w-0 flex-col-reverse justify-end px-2 md:px-4">
            <dt className="mt-1 text-xs text-ink-2 md:text-sm">{s.label}</dt>
            <dd className="font-display text-xl font-semibold tracking-heading text-ink md:text-3xl">
              <CountUp to={s.to} suffix={s.suffix} />
            </dd>
          </div>
        ))}
      </Card>
      {companies.length > 0 && (
        <div className="mt-8 md:mt-10">
          <p className="text-center text-sm font-medium text-ink-2">{t("employersPage.proof.title")}</p>
          <LogoRow companies={companies} />
        </div>
      )}
    </section>
  );
}

/**
 * Counts up once when a stat scrolls into view (never above the fold: those keep the server
 * text). The server HTML already holds the final value (SEO, no JS, screen readers get it from
 * the sr-only copy); the width is reserved so the digits never push the layout.
 */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = groupDigits(to) + suffix;
  useEffect(() => {
    const el = ref.current;
    if (!el || to < 10 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.textContent = groupDigits(0) + suffix;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 700);
        el.textContent = groupDigits(to * (1 - (1 - p) ** 4)) + suffix;
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = final;
    };
  }, [to, suffix, final]);
  return (
    <>
      <span ref={ref} aria-hidden="true" className="num inline-block" style={{ minWidth: `${final.length}ch` }}>{final}</span>
      <span className="sr-only">{final}</span>
    </>
  );
}

/**
 * "Hiring here" logos. Six or more drift slowly in a marquee (compositor-only, with a visible
 * pause button: pausing on hover/focus alone isn't enough for WCAG 2.2.2); fewer sit still.
 * Under reduced motion app.css turns the marquee into one static, wrapped list.
 */
function LogoRow({ companies }: { companies: ProofCompany[] }) {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const list = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex flex-wrap justify-center gap-x-12 gap-y-2">
      {companies.map((c) => (
        <li key={c.id} className="min-w-0">
          <LocalizedLink
            to={`/companies/${c.slug}`}
            prefetch="intent"
            tabIndex={copy ? -1 : undefined}
            className="flex min-h-11 items-center gap-2.5 rounded-pill text-md font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            <Avatar name={c.name} src={c.logo_url} square size="sm" />
            <span className="max-w-xs truncate">{c.name}</span>
            {c.verified && (
              <>
                <BadgeCheck aria-hidden="true" className="size-4 shrink-0 fill-firuza text-surface" />
                {!copy && <span className="sr-only">{t("common.verified")}</span>}
              </>
            )}
          </LocalizedLink>
        </li>
      ))}
    </ul>
  );

  if (companies.length < 6) return <div className="mt-4">{list(false)}</div>;
  return (
    <div className="mt-4 flex items-center gap-2">
      {/* py-1: room for the links' focus rings inside the clipping host. */}
      <div className="marquee-host edge-mask-x min-w-0 flex-1 overflow-hidden py-1 motion-reduce:mask-none" data-paused={paused || undefined}>
        <div className="marquee">
          {list(false)}
          {list(true)}
        </div>
      </div>
      <IconButton
        label={t("employersPage.proof.pause")}
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
        variant="secondary"
        shape="pill"
        size="sm"
        className="shrink-0 motion-reduce:hidden"
      >
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </IconButton>
    </div>
  );
}
