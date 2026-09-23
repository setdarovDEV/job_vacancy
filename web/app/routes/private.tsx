import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import type { Route } from "./+types/private";
import { useSession } from "~/shared/auth/session";
import { localizedPath } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { QueryProvider } from "~/shared/query/query";
import { Spinner } from "~/shared/ui/Spinner";

export const meta: Route.MetaFunction = () => [{ name: "robots", content: "noindex" }];

/**
 * Signed-in areas. The access token lives only in browser memory, so these pages render
 * a placeholder on the server and load their data in the browser.
 */
export default function PrivateLayout() {
  const { status } = useSession();
  const navigate = useNavigate();
  const locale = useLocale();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (status === "anon") {
      navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(pathname + search)}`, { replace: true });
    }
  }, [status, navigate, locale, pathname, search]);

  if (status !== "authed") {
    return (
      <div className="grid min-h-[50vh] place-items-center text-ink-3">
        <Spinner />
      </div>
    );
  }
  return (
    <QueryProvider>
      <Outlet />
    </QueryProvider>
  );
}
