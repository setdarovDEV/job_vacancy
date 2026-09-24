import { Briefcase, Building2, House } from "lucide-react";
import type { ReactNode } from "react";
import { data, isRouteErrorResponse, Outlet, redirect, useMatches, useRevalidator, type UIMatch } from "react-router";

import type { Route } from "./+types/site";
import { isLocaleSegment } from "~/shared/i18n/config";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { MobileTabBar } from "~/shared/layout/MobileTabBar";
import { NavigationProgress } from "~/shared/layout/NavigationProgress";
import { RouteAnnouncer } from "~/shared/layout/RouteAnnouncer";
import { SiteFooter } from "~/shared/layout/SiteFooter";
import { SiteHeader } from "~/shared/layout/SiteHeader";
import { Button } from "~/shared/ui/Button";
import { ErrorState } from "~/shared/ui/ErrorState";
import { SearchBar } from "~/shared/ui/SearchBar";

/*
 * Route handle contract — the shell reads these from `export const handle = { … }` in any route
 * (the deepest route that sets a key wins, so a layout can set it for all its children):
 *
 *   bare?: boolean
 *     No footer: full-height app screens (chat). Bare screens get no bottom padding either:
 *     size them with the `h-app` utility (100dvh − --header-h − --tabbar-reserve), or add
 *     `pb-tabbar` yourself if the screen scrolls like a normal page.
 *   tabBar?: boolean | ((m: UIMatch) => boolean)
 *     false hides the floating mobile tab bar (< md): auth pages, the vacancy page with its own
 *     sticky Apply bar, the chat thread. A function receives the route match ({ params,
 *     pathname, data, … }) and returns whether to show it, e.g. ({ params }) => !params.id.
 *   mobileHeader?: boolean | ((m: UIMatch) => boolean)
 *     false hides the site header below md (a chat thread with its own glass-bar top bar).
 *   autoHideHeader?: boolean | ((m: UIMatch) => boolean)
 *     true on long list routes (vacancies, companies, candidates): below md the header slides away
 *     while scrolling down and returns on scroll up (app.css `autohide`, Chrome 144+; elsewhere it
 *     stays). A sticky bar right under the header adds `autohide-follow` to dock with it.
 *
 * While the tab bar shows, the footer carries `pb-tabbar`, so the page end is never under the
 * bar and the footer surface runs on beneath it, and an `edge-fade-b` scrim fades content into
 * paper under the bar (z-30, no pointer events; fixed bottom bars sit at z-40 like the tab bar, or
 * z-30 inside <main>, which comes after it). app.css derives from the bar's presence:
 *   --tabbar-space   distance from the bottom edge the bar covers (safe-area inset when hidden)
 *                    → toasts; floating sticky bars use the `bottom-above-tabbar` utility.
 *   --tabbar-reserve the same, but 0 when there's no bar (for height calculations).
 *   --header-h       header height incl. the notch inset (0 below md when mobileHeader is false).
 */
export type ShellHandle = {
  bare?: boolean;
  tabBar?: boolean | ((m: UIMatch) => boolean);
  mobileHeader?: boolean | ((m: UIMatch) => boolean);
  autoHideHeader?: boolean | ((m: UIMatch) => boolean);
};

function useShellFlags() {
  const matches = useMatches();
  const pick = (flag: "tabBar" | "mobileHeader" | "autoHideHeader", fallback: boolean): boolean => {
    for (let i = matches.length - 1; i >= 0; i--) {
      const v = (matches[i].handle as ShellHandle | undefined)?.[flag];
      if (v === undefined) continue;
      return typeof v === "function" ? v(matches[i]) : v;
    }
    return fallback;
  };
  const bare = matches.some((m) => (m.handle as ShellHandle | undefined)?.bare);
  return { bare, tabBar: pick("tabBar", true), mobileHeader: pick("mobileHeader", true), autoHideHeader: pick("autoHideHeader", false) };
}

export function loader({ params, request }: Route.LoaderArgs) {
  if (params.lang === "uz") {
    // Uzbek (Latin) is the unprefixed default; keep one URL per page.
    const url = new URL(request.url);
    throw redirect((url.pathname.replace(/^\/uz(?=\/|$)/, "") || "/") + url.search, 301);
  }
  if (params.lang && !isLocaleSegment(params.lang)) {
    throw data(null, { status: 404 });
  }
  return null;
}

function Shell({
  children, bare = false, tabBar = true, mobileHeader = true, autoHideHeader = false,
}: { children: ReactNode; bare?: boolean; tabBar?: boolean; mobileHeader?: boolean; autoHideHeader?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <NavigationProgress />
      <RouteAnnouncer />
      <SiteHeader mobileHidden={!mobileHeader} autoHide={autoHideHeader} />
      {/* Before <main>: fixed bars a page renders at the same z-index still paint above it. */}
      {tabBar && <div aria-hidden="true" className="edge-fade-b md:hidden" />}
      {/* tabIndex -1: the skip link, RouteAnnouncer and the palette move focus here. */}
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 outline-none" // jv-ui-ignore: programmatic focus target, a ring around the whole page would only confuse
      >
        {children}
      </main>
      {!bare && <SiteFooter className={tabBar ? "pb-tabbar" : undefined} />}
      {tabBar && <MobileTabBar />}
    </div>
  );
}

export default function Site() {
  const flags = useShellFlags();
  return (
    <Shell {...flags}>
      <Outlet />
    </Shell>
  );
}

/** X-Request-ID of a failed call, when the thrown error carries one. */
function requestIdOf(error: unknown): string | undefined {
  const body = isRouteErrorResponse(error) ? (error.data as unknown) : error;
  if (!body || typeof body !== "object") return undefined;
  const b = body as { request_id?: unknown; requestId?: unknown; error?: { request_id?: unknown } };
  const id = b.request_id ?? b.requestId ?? b.error?.request_id;
  return typeof id === "string" && id ? id : undefined;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  const revalidator = useRevalidator();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <Shell>
      <title>{`${notFound ? t("errors.not_found") : t("states.errorTitle")} | ${t("brand.name")}`}</title>
      <meta name="robots" content="noindex" />
      {notFound ? (
        <NotFound />
      ) : (
        <div className="container-page py-10 md:py-16">
          <div className="surface-card mx-auto max-w-xl">
            <ErrorState
              error={error}
              headingAs="h1"
              onRetry={() => revalidator.revalidate()}
              homeLink
              requestId={requestIdOf(error)}
            />
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Friendly 404: say what happened, then offer a search and the main ways back in. */
function NotFound() {
  const { t } = useTranslation();
  const links = [
    { to: "/vacancies", key: "nav.vacancies", icon: Briefcase },
    { to: "/companies", key: "nav.companies", icon: Building2 },
    { to: "/", key: "errors.toHome", icon: House },
  ] as const;
  return (
    <section className="relative isolate overflow-hidden">
      {/* Fades out at the bottom so the colour never ends in a hard edge. */}
      <div aria-hidden="true" className="aurora-hero aurora-fade pointer-events-none absolute inset-0 -z-10" />
      <div className="container-page flex flex-col items-center pb-16 pt-12 text-center md:pb-24 md:pt-20">
        <p aria-hidden="true" className="num font-display text-5xl font-semibold tracking-display text-lapis">404</p>
        <h1 className="mt-4 max-w-xl break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">
          {t("errors.not_found")}
        </h1>
        <p className="mt-3 max-w-md text-base text-ink-2">{t("shell.notFoundBody")}</p>
        <SearchBar action="/vacancies" size="lg" material="glass" suggest recent className="mt-8 w-full max-w-2xl" />
        <nav aria-label={t("shell.notFoundLinks")} className="mt-6">
          <ul className="flex flex-wrap justify-center gap-2">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <li key={l.to}>
                  {/* Solid: the header, the glass search and the tab bar are already three blur layers. */}
                  <Button asChild variant="secondary" shape="pill" icon={<Icon className="size-4.5" />}>
                    <LocalizedLink to={l.to} prefetch="intent">{t(l.key)}</LocalizedLink>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </section>
  );
}
