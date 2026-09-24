import { Send } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { LogoMark } from "../brand/Logo";
import { nameOf, useCatalog } from "../catalog/catalog";
import { localeNames, locales } from "../i18n/config";
import { LocalizedLink, useLocale, useSwitchLocaleHref } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";

// Same bot the API sends notifications from (TELEGRAM_BOT_USERNAME, default jobvacancy_uz_bot).
const TELEGRAM_BOT: string = import.meta.env.VITE_TELEGRAM_BOT ?? "jobvacancy_uz_bot";

// Compact rows on desktop, 44px tall targets on touch screens.
const linkClass =
  "inline-flex min-h-8 items-center break-words py-1 text-md text-ink-2 transition-colors hover:text-ink pointer-coarse:min-h-11";

function Column({ id, title, children, className }: { id: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <nav aria-labelledby={id} className={cn("min-w-0", className)}>
      <h2 id={id} className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <ul className="flex flex-col">{children}</ul>
    </nav>
  );
}

/**
 * Site footer: solid surface, rendered lazily by the browser (defer-paint). Crawlable links to
 * the vacancy list by category and by region (the SEO landing pages the vacancies route keeps
 * indexable), employer entry points, legal pages, the Telegram bot and every language version.
 * Phones get a compact two-column grid; nothing is hidden behind accordions.
 */
export function SiteFooter({ className }: { className?: string } = {}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const switchHref = useSwitchLocaleHref();
  const { categories, regions } = useCatalog();

  const topCategories = categories.slice(0, 8);
  const topRegions = regions.slice(0, 8);
  const legal = [
    { to: "/about", key: "footer.about" },
    { to: "/contacts", key: "footer.contacts" },
    { to: "/privacy", key: "footer.privacy" },
    { to: "/terms", key: "footer.terms" },
  ] as const;
  const employers = [
    { to: "/employers", key: "nav.postVacancy" },
    { to: "/employer/candidates", key: "shell.footer.candidates" },
    { to: "/companies", key: "nav.companies" },
    { to: "/employer", key: "shell.footer.cabinet" },
  ] as const;

  return (
    <footer className={cn("defer-paint mt-16 border-t border-line bg-surface md:mt-24", className)}>
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4 md:gap-y-10 md:py-16 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:gap-x-8">
        <div className="col-span-2 flex min-w-0 flex-col items-start gap-4 md:col-span-4 lg:col-span-1">
          <LocalizedLink to="/" aria-label={t("brand.name")} className="-ml-1 flex items-center gap-2.5 rounded-control p-1">
            <LogoMark className="size-7" />
            <span aria-hidden="true" className="font-display text-lead font-semibold leading-none tracking-heading text-ink">
              {t("brand.name")}
            </span>
          </LocalizedLink>
          <p className="max-w-xs text-md text-ink-2">{t("brand.tagline")}</p>
          <a
            href={`https://t.me/${TELEGRAM_BOT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-pill border border-line-strong bg-surface px-4 text-md font-medium text-ink transition-[background-color,border-color,scale] duration-150 ease-spring hover:border-ink-3 hover:bg-sunken active:scale-[0.97]"
          >
            <Send className="size-4.5 text-lapis" aria-hidden="true" />
            {t("shell.footer.telegram")}
            <span className="sr-only">{t("shell.footer.newTab")}</span>
          </a>
        </div>

        {topCategories.length > 0 && (
          <Column id="footer-categories" title={t("shell.footer.byCategory")}>
            {topCategories.map((c, i) => (
              // Phones list six per column: 44px rows add up fast.
              <li key={c.id} className={i >= 6 ? "max-md:hidden" : undefined}>
                <LocalizedLink to={`/vacancies?category_id=${c.id}`} className={linkClass}>{nameOf(c.name, locale)}</LocalizedLink>
              </li>
            ))}
            <li>
              <LocalizedLink to="/vacancies" className={cn(linkClass, "font-medium text-lapis-ink hover:text-lapis-hover")}>
                {t("shell.footer.allVacancies")}
              </LocalizedLink>
            </li>
          </Column>
        )}

        {topRegions.length > 0 && (
          <Column id="footer-regions" title={t("shell.footer.byRegion")}>
            {topRegions.map((r, i) => (
              <li key={r.id} className={i >= 6 ? "max-md:hidden" : undefined}>
                <LocalizedLink to={`/vacancies?region_id=${r.id}`} className={linkClass}>{nameOf(r.name, locale)}</LocalizedLink>
              </li>
            ))}
          </Column>
        )}

        <Column id="footer-employers" title={t("nav.forEmployers")}>
          {employers.map((l) => (
            <li key={l.to}>
              <LocalizedLink to={l.to} className={linkClass}>{t(l.key)}</LocalizedLink>
            </li>
          ))}
        </Column>

        <Column id="footer-about" title={t("brand.name")}>
          {legal.map((l) => (
            <li key={l.to}>
              <LocalizedLink to={l.to} className={linkClass}>{t(l.key)}</LocalizedLink>
            </li>
          ))}
        </Column>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-ink-2">{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <nav aria-label={t("language.label")}>
            <ul className="-mx-2 flex flex-wrap">
              {locales.map((l) => (
                <li key={l}>
                  {/* Real links to this page in every language (the hreflang set, for people and crawlers). */}
                  <Link
                    to={switchHref(l)}
                    hrefLang={l}
                    lang={l}
                    aria-current={l === locale ? "true" : undefined}
                    className={cn(
                      "inline-flex min-h-8 items-center rounded-pill px-2 text-sm transition-colors pointer-coarse:min-h-11",
                      l === locale ? "font-semibold text-ink" : "text-ink-2 hover:text-ink",
                    )}
                  >
                    {localeNames[l]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
