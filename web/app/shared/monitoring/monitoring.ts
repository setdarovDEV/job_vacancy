import type { PublicRuntime } from "../runtime/runtime.server";

type Sentry = typeof import("@sentry/browser");
let sentry: Sentry | null = null;

/**
 * Browser error tracking, only when SENTRY_DSN_WEB is set: the SDK is a separate chunk
 * fetched after the page is interactive, so the entry bundle stays as it was. No request
 * data, cookies or user details are sent.
 */
export function startMonitoring(rt: PublicRuntime) {
  if (!rt.sentryDsn || sentry) return;
  void import("@sentry/browser").then((s) => {
    s.init({
      dsn: rt.sentryDsn!,
      environment: rt.environment,
      release: rt.release ?? undefined,
      sendDefaultPii: false,
      sampleRate: 1,
      beforeSend(event) {
        delete event.request?.cookies;
        delete event.request?.headers;
        if (event.request?.url) event.request.url = event.request.url.split("?")[0];
        delete event.user;
        return event;
      },
    });
    sentry = s;
  }).catch(() => {});
}

/** Report an error caught by an error boundary (uncaught ones are picked up automatically). */
export function reportError(error: unknown) {
  sentry?.captureException(error);
}
