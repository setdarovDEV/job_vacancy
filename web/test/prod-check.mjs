// Production build check: SSR status, hydration errors and Web Vitals for public pages.
//   pnpm build && PORT=5190 pnpm start, then: WEB=http://localhost:5190 node test/prod-check.mjs
import { chromium } from "playwright-core";
const B = process.env.WEB ?? "http://localhost:5190";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const slug = (await (await fetch("http://localhost:8090/api/v1/vacancies?limit=1")).json()).data[0].slug;
const pages = ["/", "/vacancies", "/vacancies?q=dasturchi", `/vacancies/${slug}`, "/companies", "/employers", "/ru", "/en/vacancies", "/uz-cyrl/about", "/login", "/register"];
let bad = 0;
for (const path of pages) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  p.on("pageerror", (e) => errors.push(e.message));
  // Simulated slow 4G, like Lighthouse's mobile profile.
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await p.addInitScript(() => {
    window.__v = { lcp: 0, cls: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__v.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  const res = await p.goto(B + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const v = await p.evaluate(() => ({ ...window.__v, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0, ttfb: performance.getEntriesByType("navigation")[0].responseStart }));
  const fail = res.status() !== 200 || errors.length || v.cls > 0.05 || v.lcp > 2000;
  if (fail) bad++;
  console.log(`${fail ? "✘" : "✔"} ${path.padEnd(28)} ${res.status()}  TTFB ${Math.round(v.ttfb)}ms  FCP ${Math.round(v.fcp)}ms  LCP ${Math.round(v.lcp)}ms  CLS ${v.cls.toFixed(3)}${errors.length ? "  ERR " + errors.join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
