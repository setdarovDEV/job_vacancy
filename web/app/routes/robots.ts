import { siteNoindex } from "~/shared/seo/indexing.server";
import { SITE } from "~/shared/seo/seo";

export function loader() {
  const body = siteNoindex
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE}/sitemap.xml\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
