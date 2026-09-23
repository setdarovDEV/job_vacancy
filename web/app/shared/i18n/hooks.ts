import { forwardRef } from "react";
import { createElement } from "react";
import { Link, useLocation, useRouteLoaderData, type LinkProps } from "react-router";

import { localizedPath, stripLocale, defaultLocale, type Locale } from "./config";
import type { Theme } from "../theme/theme";

type RootData = { locale: Locale; theme: Theme; hasSession: boolean };

export function useRootData(): RootData {
  return (useRouteLoaderData("root") as RootData | undefined) ?? { locale: defaultLocale, theme: "system", hasSession: false };
}

export function useLocale(): Locale {
  return useRootData().locale;
}

/** The current URL in another language (keeps path and query). */
export function useSwitchLocaleHref() {
  const { pathname, search } = useLocation();
  // Re-encode: the server and the browser escape "/" in the query differently, which
  // would otherwise be a hydration mismatch.
  const q = new URLSearchParams(search).toString();
  return (to: Locale) => localizedPath(to, stripLocale(pathname)) + (q ? `?${q}` : "");
}

/** <Link> that keeps the current language prefix. Pass app paths: to="/vacancies". */
export const LocalizedLink = forwardRef<HTMLAnchorElement, LinkProps & { to: string }>(function LocalizedLink(
  { to, ...props },
  ref,
) {
  const locale = useLocale();
  return createElement(Link, { ref, to: localizedPath(locale, to), ...props });
});
