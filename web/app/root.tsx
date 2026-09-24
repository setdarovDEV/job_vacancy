import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData, type ShouldRevalidateFunctionArgs } from "react-router";

import type { Route } from "./+types/root";
import { defaultLocale, htmlLang, localeFromPath } from "./shared/i18n/config";
import { bootstrapSession } from "./shared/auth/session";
import { getCatalog } from "./shared/catalog/catalog.server";
import { createT, I18nProvider } from "./shared/i18n/i18n";
import { messagesFor } from "./shared/i18n/messages.server";
import { glassBootScript, parseGlass, parseTheme, themeColorFor } from "./shared/theme/theme";
import { Toaster } from "./shared/ui/Toast";
import "./styles/app.css";
// Latin subsets are what nearly every first view needs; preload them so text paints in the
// brand fonts without a late swap. Other subsets load on demand via unicode-range.
import onestLatin from "@fontsource-variable/onest/files/onest-latin-wght-normal.woff2?url";
import unboundedLatin from "./styles/fonts/unbounded-latin-wght-500-600.woff2?url";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = localeFromPath(new URL(request.url).pathname);
  const cookie = request.headers.get("Cookie");
  return {
    catalog: await getCatalog(),
    locale,
    theme: parseTheme(cookie),
    glass: parseGlass(cookie),
    // Readable marker set by the client after sign-in: render the signed-in header shell.
    hasSession: /(?:^|;\s*)jv_auth=1/.test(cookie ?? ""),
    messages: messagesFor(locale),
  };
}

// Catalog and translations only change with the language (or after a mutation). Filter
// clicks, pagination and in-app navigation must not refetch them (TZ FE-01).
export function shouldRevalidate({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
  if (currentUrl.href === nextUrl.href) return defaultShouldRevalidate; // explicit revalidate()
  return localeFromPath(currentUrl.pathname) !== localeFromPath(nextUrl.pathname);
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preload", href: onestLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: unboundedLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const locale = data?.locale ?? defaultLocale;
  const theme = data?.theme ?? "system";
  const glass = data?.glass ?? "auto";
  return (
    <html
      lang={htmlLang[locale]}
      data-theme={theme === "system" ? undefined : theme}
      // The boot script may lower the tier before paint; React must accept that difference.
      data-glass={glass === "auto" ? "full" : glass}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {themeColorFor(theme).map((c) => (
          <meta key={c.media ?? "all"} name="theme-color" content={c.color} media={c.media} />
        ))}
        <script dangerouslySetInnerHTML={{ __html: glassBootScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Only what every page needs lives here. Data-heavy areas (dashboards, chat) bring their
// own providers, so the public pages stay light.
export default function App({ loaderData }: Route.ComponentProps) {
  const { locale, messages } = loaderData;
  useEffect(() => bootstrapSession(), []);
  return (
    <I18nProvider messages={messages} locale={locale}>
      <Outlet />
      <Toaster closeLabel={createT(messages, locale)("common.close")} />
    </I18nProvider>
  );
}

// Last resort (e.g. the root loader itself failed): no translations are available here.
export function ErrorBoundary() {
  return (
    <main className="container-page grid min-h-dvh place-content-center gap-3 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-heading">Job Vacancy</h1>
      <p className="text-ink-2">Xatolik yuz berdi · Произошла ошибка · Something went wrong</p>
      <a className="text-lapis-ink underline" href="/">jobvacancy.uz</a>
    </main>
  );
}
