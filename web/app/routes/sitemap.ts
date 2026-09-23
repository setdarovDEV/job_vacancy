import { api } from "~/shared/api/client";
import { htmlLang, localizedPath, locales } from "~/shared/i18n/config";
import { SITE } from "~/shared/seo/seo";

// sitemap.xml with every language version as hreflang alternates. Covers the newest
// ~1000 vacancies and the company directory; switch to a sitemap index past that.
const MAX_PAGES = 20;

async function vacancySlugs(): Promise<{ slug: string; updated: string }[]> {
  const out: { slug: string; updated: string }[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await api.GET("/vacancies", { params: { query: { sort: "newest", limit: 50, cursor } } });
    for (const v of res.data?.data ?? []) out.push({ slug: v.slug, updated: v.published_at ?? v.created_at });
    cursor = res.data?.meta?.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

async function companySlugs(): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page && page <= MAX_PAGES; ) {
    const res = await api.GET("/companies", { params: { query: { page } } });
    for (const c of res.data?.data ?? []) out.push(c.slug);
    page = res.data?.meta?.next_page ?? 0;
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function entry(path: string, lastmod?: string) {
  const alts = locales.map((l) => `<xhtml:link rel="alternate" hreflang="${htmlLang[l]}" href="${esc(SITE + localizedPath(l, path))}"/>`).join("");
  return locales
    .map((l) => `<url><loc>${esc(SITE + localizedPath(l, path))}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ""}${alts}</url>`)
    .join("\n");
}

export async function loader() {
  const [vacancies, companies] = await Promise.all([vacancySlugs().catch(() => []), companySlugs().catch(() => [])]);
  const paths = ["/", "/vacancies", "/companies", "/employers", "/about", "/contacts", "/privacy", "/terms"];
  const body = [
    ...paths.map((p) => entry(p)),
    ...vacancies.map((v) => entry(`/vacancies/${v.slug}`, v.updated)),
    ...companies.map((c) => entry(`/companies/${c}`)),
  ].join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
