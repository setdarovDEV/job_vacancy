// Settings the browser needs, read from the web container's environment at request time
// (not baked into the bundle), so one image serves every environment. Each is optional:
// unset means the integration stays off.
export const publicRuntime = {
  /** Cloudflare Turnstile site key; the API checks tokens with TURNSTILE_SECRET_KEY. */
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  /** Sentry DSN for browser errors (a separate Sentry project from the API's). */
  sentryDsn: process.env.SENTRY_DSN_WEB || null,
  /** Sentry environment / release tags (release = deployed image tag). */
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
  release: process.env.SENTRY_RELEASE || null,
  /** Google Analytics 4 measurement id (G-XXXX); loads only after "accept all" cookies. */
  ga4Id: process.env.GA4_ID || null,
};

export type PublicRuntime = typeof publicRuntime;
