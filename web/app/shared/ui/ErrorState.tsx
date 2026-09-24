import { CloudOff, RotateCw, TriangleAlert, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ApiError } from "../api/client";
import { errorText } from "../api/errors";
import { LocalizedLink } from "../i18n/hooks";
import { useTranslation, type TFunction } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Button } from "./Button";

function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && typeof (e as ApiError).code === "string";
}

/**
 * Title + sentence for anything a query, loader or action can throw: an ApiError envelope,
 * an ApiFailure (`.error` + `.status`), a route error response (`.status`), or a plain Error.
 */
function describe(error: unknown, t: TFunction): { title: string; body: string; notFound: boolean } {
  const generic = { title: t("states.errorTitle"), body: t("errors.internal_error"), notFound: false };
  if (error == null) return generic;
  const wrapped = (error as { error?: unknown }).error;
  const api = isApiError(error) ? error : isApiError(wrapped) ? wrapped : null;
  const status = (error as { status?: unknown }).status;
  if (status === 404 || api?.code === "not_found") {
    return { title: t("errors.not_found"), body: t("errors.notFoundBody"), notFound: true };
  }
  if (api) return { ...generic, body: errorText(t, api) };
  // fetch() rejects with a TypeError when the network or the API is unreachable.
  if (error instanceof TypeError) return { ...generic, body: t("errors.network") };
  return generic;
}

/**
 * Error view for a failed list/detail/widget: translated reason, Retry, optional home link and
 * request id for support. Switches to an offline variant while the browser reports no network
 * and retries by itself when the connection comes back. Never use EmptyState for errors.
 */
export function ErrorState({
  error, title, onRetry, compact, homeLink, requestId, headingAs: Heading = "h2", className,
}: {
  error?: ApiError | Error | unknown;
  /** Overrides the derived title. */
  title?: ReactNode;
  /** Retry; return the promise (refetch(), revalidate()) to show a spinner until it settles. */
  onRetry?: () => void | Promise<unknown>;
  /** One-line inline variant for page sections that failed on their own. */
  compact?: boolean;
  /** Adds a "Go home" link. */
  homeLink?: boolean;
  /** X-Request-ID of the failed call, shown small and selectable for support. */
  requestId?: string;
  /** Heading level that fits the page outline (full variant). */
  headingAs?: "h1" | "h2" | "h3" | "p";
  className?: string;
}) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  // navigator.onLine doesn't exist on the server: decide after mount so hydration matches.
  const [offline, setOffline] = useState(false);
  const alive = useRef(true);

  const retry = () => {
    if (!onRetry || retrying) return;
    const out = onRetry();
    if (out && typeof (out as Promise<unknown>).finally === "function") {
      setRetrying(true);
      void (out as Promise<unknown>).catch(() => {}).finally(() => { if (alive.current) setRetrying(false); });
    }
  };
  // The online listener is registered once; it must call the latest retry closure.
  const latestRetry = useRef(retry);
  useEffect(() => { latestRetry.current = retry; });

  useEffect(() => {
    alive.current = true;
    const sync = () => setOffline(!navigator.onLine);
    const back = () => { setOffline(false); latestRetry.current(); };
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", back);
    return () => {
      alive.current = false;
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", back);
    };
  }, []);

  const d = describe(error, t);
  const heading = offline ? t("states.offlineTitle") : (title ?? d.title);
  const body = offline ? t("states.offlineBody") : d.body;
  const Icon = offline ? WifiOff : d.notFound ? CloudOff : TriangleAlert;

  const retryButton = onRetry && (
    <Button
      variant={compact ? "secondary" : "primary"}
      size={compact ? "sm" : "md"}
      loading={retrying}
      icon={<RotateCw className="size-4" />}
      onClick={retry}
    >
      {t("common.retry")}
    </Button>
  );
  const idLine = requestId && (
    <p className="mt-3 text-xs text-ink-3">
      {t("states.requestId")}: <code className="num select-all break-all font-mono text-ink-2">{requestId}</code>
    </p>
  );

  if (compact) {
    return (
      <div role="alert" className={cn("flex flex-wrap items-center gap-3 p-4", className)}>
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-anor-soft text-anor-ink">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="break-words text-md font-medium text-ink">{heading}</p>
          <p className="break-words text-sm text-ink-2">{body}</p>
          {idLine}
        </div>
        {retryButton}
      </div>
    );
  }

  return (
    <div role="alert" className={cn("anim-fade flex flex-col items-center px-6 py-12 text-center md:py-14", className)}>
      <div aria-hidden="true" className="mb-4 grid size-14 place-items-center rounded-panel bg-anor-soft text-anor-ink">
        <Icon className="size-6" />
      </div>
      <Heading className="max-w-md break-words text-lead font-semibold tracking-snug text-ink">{heading}</Heading>
      <p className="mt-1.5 max-w-sm break-words text-md text-ink-2">{body}</p>
      {(retryButton || homeLink) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {retryButton}
          {homeLink && (
            <Button asChild variant={onRetry ? "ghost" : "secondary"}>
              <LocalizedLink to="/">{t("errors.toHome")}</LocalizedLink>
            </Button>
          )}
        </div>
      )}
      {idLine}
    </div>
  );
}
