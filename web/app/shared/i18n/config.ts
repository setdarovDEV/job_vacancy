// Supported UI languages. Uzbek (Latin) is the default and lives at the site root;
// the others get a path prefix: /uz-cyrl/…, /ru/…, /en/….
export const locales = ["uz", "uz-Cyrl", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

const segments: Record<Locale, string | null> = { uz: null, "uz-Cyrl": "uz-cyrl", ru: "ru", en: "en" };

// BCP 47 tags for <html lang> and Intl formatters.
export const htmlLang: Record<Locale, string> = { uz: "uz-Latn", "uz-Cyrl": "uz-Cyrl", ru: "ru", en: "en" };

// Each language names itself.
export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha", "uz-Cyrl": "Ўзбекча", ru: "Русский", en: "English",
};

export function localeFromSegment(seg: string | undefined): Locale | null {
  if (!seg) return defaultLocale;
  const hit = (Object.keys(segments) as Locale[]).find((l) => segments[l] === seg.toLowerCase());
  return hit ?? null;
}

export function isLocaleSegment(seg: string | undefined): boolean {
  return !!seg && localeFromSegment(seg) !== defaultLocale && localeFromSegment(seg) !== null;
}

/** Prefixes an app path ("/vacancies") for a locale ("/ru/vacancies"). */
export function localizedPath(locale: Locale, path: string): string {
  const seg = segments[locale];
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!seg) return clean;
  return clean === "/" ? `/${seg}` : `/${seg}${clean}`;
}

/** Strips a locale prefix from a pathname ("/ru/vacancies" → "/vacancies"). */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if (isLocaleSegment(first)) return "/" + rest.join("/");
  return pathname || "/";
}

export function localeFromPath(pathname: string): Locale {
  const first = pathname.split("/")[1];
  return isLocaleSegment(first) ? (localeFromSegment(first) as Locale) : defaultLocale;
}
