import { htmlLang, localeFromPath, localizedPath, locales, stripLocale } from "../i18n/config";

export const SITE: string = import.meta.env.VITE_SITE_URL ?? "https://jobvacancy.uz";

/**
 * Standard head tags for a public page: title, description, canonical URL, hreflang
 * alternates for every language version, and Open Graph.
 */
export function seo({ title, description, path, image, noindex }: {
  title: string; description?: string; path: string; image?: string | null; noindex?: boolean;
}) {
  const locale = localeFromPath(path);
  const base = stripLocale(path);
  const tags: Record<string, string>[] = [
    { title },
    { property: "og:title", content: title },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Job Vacancy" },
    { property: "og:locale", content: htmlLang[locale].replace("-", "_") },
    { tagName: "link", rel: "canonical", href: SITE + path },
    ...locales.map((l) => ({ tagName: "link", rel: "alternate", hrefLang: htmlLang[l], href: SITE + localizedPath(l, base) })),
    { tagName: "link", rel: "alternate", hrefLang: "x-default", href: SITE + base },
  ];
  if (description) {
    tags.push({ name: "description", content: description }, { property: "og:description", content: description });
  }
  if (image) tags.push({ property: "og:image", content: image });
  if (noindex) tags.push({ name: "robots", content: "noindex" });
  return tags;
}

/** Headers that let the API see the real visitor (view counts, rate limits, language). */
export function forwardHeaders(request: Request): Record<string, string> {
  const h: Record<string, string> = {};
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) h["X-Real-IP"] = ip;
  const lang = request.headers.get("accept-language");
  if (lang) h["Accept-Language"] = lang;
  return h;
}
