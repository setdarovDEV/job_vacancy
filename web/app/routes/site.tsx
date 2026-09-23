import { SearchX } from "lucide-react";
import { useTranslation } from "~/shared/i18n/i18n";
import { data, isRouteErrorResponse, Outlet, redirect, useMatches } from "react-router";

import type { Route } from "./+types/site";
import { isLocaleSegment } from "~/shared/i18n/config";
import { LocalizedLink } from "~/shared/i18n/hooks";
import { SiteFooter } from "~/shared/layout/SiteFooter";
import { SiteHeader } from "~/shared/layout/SiteHeader";
import { Button } from "~/shared/ui/Button";
import { EmptyState } from "~/shared/ui/EmptyState";

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

export default function Site() {
  // Full-height app screens (chat) set handle.bare and get no footer.
  const bare = useMatches().some((m) => (m.handle as { bare?: boolean } | undefined)?.bare);
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {!bare && <SiteFooter />}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="container-page flex-1 py-16">
        <EmptyState
          icon={<SearchX className="size-6" />}
          title={notFound ? t("errors.not_found") : t("errors.internal_error")}
          body={notFound ? t("errors.notFoundBody") : undefined}
          action={<Button asChild><LocalizedLink to="/">{t("errors.toHome")}</LocalizedLink></Button>}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
