import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import type { Route } from "./+types/private";
import { refresh, useSession } from "~/shared/auth/session";
import { localizedPath, stripLocale } from "~/shared/i18n/config";
import { useLocale } from "~/shared/i18n/hooks";
import { useTranslation } from "~/shared/i18n/i18n";
import { QueryProvider } from "~/shared/query/query";
import { ErrorState } from "~/shared/ui/ErrorState";
import { Skeleton, SkeletonText } from "~/shared/ui/Skeleton";

export const meta: Route.MetaFunction = () => [{ name: "robots", content: "noindex" }];

/**
 * Signed-in areas. The access token lives only in browser memory, so these pages render
 * a placeholder on the server and load their data in the browser. The placeholder has the
 * shape of the page that follows (cabinet with sidebar, chat, resume), so restoring the
 * session doesn't make the layout jump. When the session can't be restored because the network
 * is down, it says so and retries (by hand, or when the connection returns) instead of sending a
 * signed-in person to the login page.
 */
export default function PrivateLayout() {
  const { status, offline } = useSession();
  const navigate = useNavigate();
  const locale = useLocale();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (status === "anon" && !offline) {
      navigate(`${localizedPath(locale, "/login")}?next=${encodeURIComponent(pathname + search)}`, { replace: true });
    }
  }, [status, offline, navigate, locale, pathname, search]);

  // App pages fill at least the first screen, so the footer starts below the fold: lists that
  // arrive shorter or longer than their skeleton never drag it across the viewport (CLS).
  return (
    <div className="min-h-[calc(100dvh-var(--header-h))]">
      {status === "authed" ? (
        <QueryProvider>
          <Outlet />
        </QueryProvider>
      ) : status === "anon" && offline ? (
        <div className="container-page py-10 md:py-16">
          <div className="surface-card mx-auto max-w-xl">
            {/* A TypeError is what fetch throws offline: ErrorState words it as a network problem. */}
            <ErrorState error={new TypeError("offline")} headingAs="h1" onRetry={() => refresh()} />
          </div>
        </div>
      ) : (
        <PrivateSkeleton path={stripLocale(pathname)} />
      )}
    </div>
  );
}

function PrivateSkeleton({ path }: { path: string }) {
  const { t } = useTranslation();
  const shape = path === "/chat" || path.startsWith("/chat/") ? <ChatShape /> : path.startsWith("/resumes/") ? <DocumentShape /> : <CabinetShape />;
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      {/* Held back 150 ms so a quick session restore never flashes it. */}
      <div aria-hidden="true" className="anim-delayed">{shape}</div>
    </div>
  );
}

// Cabinet (account + employer): section nav as a sidebar from lg, a scrolling strip on phones;
// page header, then content cards.
function CabinetShape() {
  return (
    <div className="container-page pb-16 pt-6 md:pb-24 md:pt-10">
      <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-10">
        <div className="-mx-4 flex gap-2 overflow-hidden px-4 lg:hidden">
          {[28, 24, 30, 22, 26].map((w, i) => (
            <Skeleton key={i} className="h-11 shrink-0" style={{ width: `${w * 0.25}rem` }} />
          ))}
        </div>
        <div className="hidden flex-col gap-1 lg:flex">
          <div className="mb-4 flex items-center gap-3 px-1">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-control" style={{ width: `${[92, 80, 86, 74, 88, 70, 82][i]}%` }} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-3 md:mb-8">
            <Skeleton className="h-8 w-56 max-w-full md:h-10 md:w-72" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface-card flex gap-4 p-5 md:p-6">
                <Skeleton className="size-14 shrink-0 rounded-control" />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Chat: conversation list beside the thread (list only on phones).
function ChatShape() {
  return (
    <div className="container-page h-app py-0 md:py-5">
      <div className="flex h-full overflow-hidden border-line bg-surface md:rounded-sheet md:border">
        <div className="flex w-full shrink-0 flex-col gap-1 border-line p-3 md:w-80 md:border-r">
          <Skeleton className="mb-2 h-11 rounded-control" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <div className="flex items-center gap-3 border-b border-line p-4">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3 p-6">
            <Skeleton className="h-10 w-1/2 rounded-panel" />
            <Skeleton className="ml-auto h-10 w-2/5 rounded-panel" />
            <Skeleton className="h-16 w-3/5 rounded-panel" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Resume view: back link, then one document-like card.
function DocumentShape() {
  return (
    <div className="container-page max-w-4xl pb-16 pt-6 md:pb-24 md:pt-8">
      <Skeleton className="h-5 w-20" />
      <div className="mt-5 rounded-sheet border border-line bg-surface p-6 shadow-1 md:p-10">
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <SkeletonText lines={4} className="mt-8" />
        <SkeletonText lines={5} className="mt-8" />
      </div>
    </div>
  );
}
