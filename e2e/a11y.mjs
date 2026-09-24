// Accessibility and locale smoke over a running stack (TZ QA-02, UI-08):
//   * axe-core (WCAG 2.0/2.1/2.2 A + AA) on the public pages in all 4 locales and on the
//     signed-in pages, each in the light AND the dark theme. Fails on any "serious" or
//     "critical" violation; "moderate"/"minor" are reported, not fatal.
//   * locale smoke per page: HTTP 200, <html lang>, a <title>, hreflang alternates, no
//     untranslated i18n keys on screen, no console errors / hydration warnings, and the
//     page text really changes between languages.
//
//   cd e2e && pnpm install --frozen-lockfile
//   WEB=http://localhost:8080 CHROME=/usr/bin/google-chrome node a11y.mjs
// Env: WEB (site, default http://localhost:8080), API (default $WEB/api/v1), CHROME,
//      OUT (report dir, default ./reports), PAGES=public|private|all (default all),
//      LOCALES (comma list, default uz,uz-Cyrl,ru,en), THEMES (default light,dark).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const WEB = (process.env.WEB ?? "http://localhost:8080").replace(/\/$/, "");
const API = process.env.API ?? `${WEB}/api/v1`;
const OUT = process.env.OUT ?? new URL("./reports/", import.meta.url).pathname;
const WHICH = process.env.PAGES ?? "all";
const THEMES = (process.env.THEMES ?? "light,dark").split(",");
const LOCALES = {
  uz: { prefix: "", lang: "uz-Latn" },
  "uz-Cyrl": { prefix: "/uz-cyrl", lang: "uz-Cyrl" },
  ru: { prefix: "/ru", lang: "ru" },
  en: { prefix: "/en", lang: "en" },
};
const locales = (process.env.LOCALES ?? Object.keys(LOCALES).join(",")).split(",");
const SERIOUS = new Set(["serious", "critical"]);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Top-level namespaces of the message catalogue: a visible "nav.vacancies" is a missing key.
const namespaces = [...readFileSync(new URL("../web/app/shared/i18n/messages/uz.ts", import.meta.url), "utf8")
  .matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map((m) => m[1]);
const rawKey = new RegExp(`(^|\\s)(${namespaces.join("|")})\\.[a-zA-Z0-9_.]+(\\s|$)`);

const json = async (path) => (await fetch(API + path)).json();
const vacancy = (await json("/vacancies?limit=1")).data?.[0]?.slug;
const company = (await json("/companies?limit=1")).data?.[0]?.slug;
const publicPages = ["/", "/vacancies", "/companies", "/employers", "/about", "/privacy", "/login", "/register"];
// Sign-in pages are noindex: no hreflang alternates expected there.
const noAlternates = new Set(["/login", "/register"]);
if (vacancy) publicPages.splice(2, 0, `/vacancies/${vacancy}`);
if (company) publicPages.push(`/companies/${company}`);
const privatePages = {
  "seeker@demo.uz": ["/me", "/me/resumes", "/me/applications", "/me/saved", "/me/notifications"],
  "hr@demo.uz": ["/employer", "/employer/company", "/employer/vacancies/new", "/employer/candidates"],
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox"],
});
mkdirSync(OUT, { recursive: true });
const results = [];
const failures = [];
const host = new URL(WEB).hostname;

async function newPage(theme) {
  const ctx = await browser.newContext({
    colorScheme: theme,
    reducedMotion: "reduce",   // no half-faded elements under the contrast check
    bypassCSP: true,           // axe is injected as a script
    viewport: { width: 1280, height: 900 },
  });
  // The SSR reads the theme cookie (FE-02), so the first paint is already in this theme.
  await ctx.addCookies([{ name: "jv_theme", value: theme, domain: host, path: "/" }]);
  const page = await ctx.newPage();
  page.jvErrors = [];
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" || (m.type() === "warning" && /hydrat/i.test(t))) page.jvErrors.push(t.slice(0, 200));
  });
  page.on("pageerror", (e) => page.jvErrors.push(`pageerror: ${e.message.slice(0, 200)}`));
  return page;
}

async function audit(page, path, { locale, theme, user, publicPage }) {
  page.jvErrors.length = 0;
  const res = await page.goto(WEB + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    theme: document.documentElement.dataset.theme ?? "",
    title: document.title,
    hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
    text: document.body.innerText,
  }));
  await page.evaluate(AXE);
  const axe = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.split("\n").slice(0, 3).join(" ") })),
      count: v.nodes.length,
    }));
  }, TAGS);

  const problems = [];
  const status = res?.status() ?? 0;
  if (status !== 200) problems.push(`HTTP ${status}`);
  if (info.lang !== LOCALES[locale].lang) problems.push(`html lang "${info.lang}", expected "${LOCALES[locale].lang}"`);
  if (info.theme !== theme) problems.push(`data-theme "${info.theme}", expected "${theme}" (jv_theme cookie ignored?)`);
  if (!info.title.trim()) problems.push("empty <title>");
  if (publicPage && info.hreflang < 4) problems.push(`${info.hreflang} hreflang alternates (< 4)`);
  const key = info.text.split("\n").map((l) => l.trim()).find((l) => rawKey.test(l));
  if (key) problems.push(`untranslated key on screen: "${key.slice(0, 80)}"`);
  if (page.jvErrors.length) problems.push(`console: ${[...new Set(page.jvErrors)].slice(0, 3).join(" | ")}`);
  const serious = axe.filter((v) => SERIOUS.has(v.impact));
  for (const v of serious) problems.push(`axe ${v.impact} ${v.id} ×${v.count}: ${v.help} [${v.nodes.map((n) => n.target).join(", ")}]`);

  const row = { path, locale, theme, user: user ?? "", status, lang: info.lang, axe, problems, text: info.text.slice(0, 4000) };
  results.push(row);
  const label = `${theme.padEnd(5)} ${locale.padEnd(7)} ${(user ? user.split("@")[0] + " " : "") + path}`;
  if (problems.length) {
    failures.push(row);
    const shot = `${OUT}/${[theme, locale, user?.split("@")[0], path].filter(Boolean).join("_").replace(/[^a-zA-Z0-9_-]+/g, "_")}.png`;
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`✘ ${label}\n    ${problems.join("\n    ")}`);
  } else {
    const minor = axe.filter((v) => !SERIOUS.has(v.impact)).map((v) => `${v.id}(${v.impact})`);
    console.log(`✔ ${label}${minor.length ? `  (moderate/minor: ${minor.join(", ")})` : ""}`);
  }
  return row;
}

async function signIn(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await page.locator("input[type=email]").fill(email);
  await page.locator("input[type=password]").fill("Secret123");
  await page.locator("input[type=password]").press("Enter");
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 15000 });
}

if (WHICH !== "private") {
  for (const theme of THEMES) {
    const page = await newPage(theme);
    for (const locale of locales) {
      for (const p of publicPages) await audit(page, LOCALES[locale].prefix + p, { locale, theme, publicPage: !noAlternates.has(p) });
    }
    await page.context().close();
  }
  // The same page must read differently in every language (catches a locale that silently
  // falls back to Uzbek).
  for (const theme of THEMES.slice(0, 1)) {
    for (const p of publicPages) {
      const texts = locales.map((l) => results.find((r) => r.theme === theme && r.locale === l && r.path === LOCALES[l].prefix + p)?.text);
      for (let i = 1; i < texts.length; i++) {
        if (texts[0] && texts[i] && texts[0] === texts[i]) {
          const row = { path: p, locale: locales[i], theme, problems: [`identical text to ${locales[0]}: not translated`] };
          failures.push(row);
          console.log(`✘ ${locales[i]} ${p}: identical text to ${locales[0]}`);
        }
      }
    }
  }
}

if (WHICH !== "public") {
  for (const theme of THEMES) {
    for (const [user, pages] of Object.entries(privatePages)) {
      const page = await newPage(theme);
      await signIn(page, user);
      for (const p of pages) await audit(page, p, { locale: "uz", theme, user, publicPage: false });
      await page.context().close();
    }
  }
}

await browser.close();
const worst = {};
for (const r of results) for (const v of r.axe) worst[`${v.impact} ${v.id}`] = (worst[`${v.impact} ${v.id}`] ?? 0) + 1;
writeFileSync(`${OUT}/a11y.json`, JSON.stringify({ web: WEB, pages: results.length, failures: failures.length,
  violationsByRule: worst, results: results.map(({ text, ...r }) => r) }, null, 2));
const seriousCount = results.reduce((n, r) => n + r.axe.filter((v) => SERIOUS.has(v.impact)).length, 0);
console.log(`\n${results.length} page checks (themes: ${THEMES.join(", ")}; public pages in ${locales.join(", ")}), ` +
  `${seriousCount} serious/critical axe violations, ${failures.length} failing checks. Report: ${OUT}a11y.json`);
if (Object.keys(worst).length) console.log("axe rules hit (pages):", worst);
process.exitCode = failures.length ? 1 : 0;
