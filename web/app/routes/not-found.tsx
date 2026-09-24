import { Briefcase, Building2, ChevronRight, Compass, House } from "lucide-react";
import { data } from "react-router";

import type { Route } from "./+types/not-found";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { useSpotlight } from "~/shared/lib/spotlight";
import { metaT } from "~/shared/seo/meta";
import { Card, CardLink } from "~/shared/ui/Card";
import { SearchBar } from "~/shared/ui/SearchBar";

// Rendered by this route (not thrown to the shell's error boundary) so the page carries its own
// head tags; the response status stays 404.
export function loader() {
  return data(null, { status: 404 });
}

export function meta({ matches }: Route.MetaArgs) {
  const { t } = metaT(matches);
  return [{ title: `${t("errors.not_found")} | ${t("brand.name")}` }, { name: "robots", content: "noindex" }];
}

const LINKS = [
  { to: "/vacancies", key: "nav.vacancies", hint: "staticPage.notFound.vacanciesHint", Icon: Briefcase },
  { to: "/companies", key: "nav.companies", hint: "staticPage.notFound.companiesHint", Icon: Building2 },
  { to: "/", key: "shell.palette.home", hint: "staticPage.notFound.homeHint", Icon: House },
] as const;

/** Friendly 404: say what happened, then offer a search and the main ways back in. */
export default function NotFound() {
  const { t } = useTranslation();
  const list = useSpotlight<HTMLUListElement>();
  return (
    <div className="relative isolate">
      {/* Brand light under the (clear at rest) header, fading out before the links. */}
      <div
        aria-hidden="true"
        className="aurora-hero aurora-fade pointer-events-none absolute inset-x-0 -top-(--header-h) -z-10 h-96"
      />
      {/* Tilework around the tile only; the ellipse ends before the header so no hard top edge. */}
      <GirihPattern className="-z-10" focus="ellipse 40% 22% at 50% 18%" />
      <div className="container-page flex flex-col items-center pb-16 pt-10 text-center md:pb-24 md:pt-20">
        <LostTile />
        <h1 className="mt-8 max-w-xl break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">
          {t("errors.not_found")}
        </h1>
        <p className="mt-3 max-w-md text-base text-ink-2">{t("shell.notFoundBody")}</p>
        <SearchBar action="/vacancies" size="lg" material="glass" suggest recent className="mt-8 w-full max-w-2xl" />
        <nav aria-label={t("shell.notFoundLinks")} className="mt-10 w-full max-w-3xl">
          {/* Solid cards: the header, the glass search and the tab bar are already the blur budget. */}
          <ul ref={list} className="grid gap-3 text-left md:grid-cols-3">
            {LINKS.map(({ to, key, hint, Icon }) => (
              <li key={to} className="flex">
                {/* Rows on phones; three upright tiles from md, so long ru / uz-Cyrl hints keep their width. */}
                <Card interactive padding="sm" className="spotlight flex flex-1 items-center gap-4 md:flex-col md:items-start md:gap-3 md:p-5">
                  <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-control bg-lapis-soft text-lapis">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <CardLink to={to} prefetch="intent" className="block break-words text-md font-semibold text-ink">
                      {t(key)}
                    </CardLink>
                    <span className="mt-0.5 block break-words text-sm text-ink-2">{t(hint)}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-3 md:hidden" />
                </Card>
              </li>
            ))}
          </ul>
        </nav>
        <p className="mt-6 text-sm text-ink-2">
          {t("staticPage.notFound.help")}{" "}
          <LocalizedLink
            to="/contacts"
            prefetch="intent"
            className="inline-flex min-h-11 items-center font-medium text-lapis-ink underline underline-offset-4 hover:text-ink"
          >
            {t("staticPage.notFound.report")}
          </LocalizedLink>
        </p>
      </div>
    </div>
  );
}

/**
 * The illustration: a compass tile on the girih tilework with the 404 tag pinned to its corner.
 * Tokens and one inline SVG pattern, so it follows the theme and costs no image request.
 */
function LostTile() {
  return (
    <div aria-hidden="true" className="anim-enter relative">
      <div className="relative grid size-20 place-items-center rounded-sheet border border-line bg-surface text-lapis shadow-3 md:size-24">
        <Compass className="size-9 md:size-10" strokeWidth={1.5} />
      </div>
      <span className="num absolute -right-3 -top-3 rounded-pill bg-lapis px-2.5 py-1 font-display text-sm font-semibold text-on-lapis shadow-2">
        404
      </span>
    </div>
  );
}
