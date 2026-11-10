// SITE_NOINDEX=1 hides the whole site from search engines (e.g. while it holds demo data):
// robots.txt disallows everything, every page gets a noindex meta tag and the sitemap is empty.
export const siteNoindex = process.env.SITE_NOINDEX === "1";
