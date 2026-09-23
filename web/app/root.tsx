import { useEffect } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from "react-router";

import type { Route } from "./+types/root";
import { defaultLocale, htmlLang, localeFromPath } from "./shared/i18n/config";
import { bootstrapSession } from "./shared/auth/session";
import { getCatalog } from "./shared/catalog/catalog.server";
import { createT, I18nProvider } from "./shared/i18n/i18n";
import { messagesFor } from "./shared/i18n/messages.server";
import { parseTheme } from "./shared/theme/theme";
import { Toaster } from "./shared/ui/Toast";
import "./styles/app.css";

export async function loader({ request }: Route.LoaderArgs) {
  const locale = localeFromPath(new URL(request.url).pathname);
  const cookie = request.headers.get("Cookie");
  return {
    catalog: await getCatalog(),
    locale,
    theme: parseTheme(cookie),
    // Readable marker set by the client after sign-in: render the signed-in header shell.
    hasSession: /(?:^|;\s*)jv_auth=1/.test(cookie ?? ""),
    messages: messagesFor(locale),
  };
}

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const locale = data?.locale ?? defaultLocale;
  const theme = data?.theme ?? "system";
  return (
    <html lang={htmlLang[locale]} data-theme={theme === "system" ? undefined : theme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f5f7fb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d1226" media="(prefers-color-scheme: dark)" />
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
      <h1 className="font-display text-2xl font-semibold">Job Vacancy</h1>
      <p className="text-ink-2">Xatolik yuz berdi · Произошла ошибка · Something went wrong</p>
      <a className="text-lapis-ink underline" href="/">jobvacancy.uz</a>
    </main>
  );
}
