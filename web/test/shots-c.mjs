// Screenshots + checks for the public pages (step C). Needs `pnpm dev` and the API running.
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
async function page(opts = {}) {
  const ctx = await browser.newContext({ colorScheme: "light", ...opts });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
  return p;
}
const slug = (await (await fetch("http://localhost:8090/api/v1/vacancies?limit=1")).json()).data[0].slug;
const comp = (await (await fetch("http://localhost:8090/api/v1/companies")).json()).data[0].slug;

let p = await page({ viewport: { width: 1280, height: 900 } });
await p.goto(B + "/vacancies", { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-list.png` });
const before = await p.locator("article").count();
ok("list renders rows", before > 0, `${before}`);
const more = p.getByRole("button", { name: "Yana ko'rsatish" });
if (await more.isVisible()) {
  await more.click();
  await p.waitForTimeout(1200);
  const after = await p.locator("article").count();
  ok("load more appends", after > before, `${before}→${after}`);
}
await p.getByRole("button", { name: "Masofaviy" }).first().click();
await p.waitForURL(/work_format=remote/);
// The URL changes first; React renders the new results in a transition right after.
await p.locator("form[role=search] input[name=work_format]").waitFor({ state: "attached" });
ok("chip filter updates URL", p.url().includes("work_format=remote"));
await p.screenshot({ path: `${out}/c-list-filtered.png` });
await p.locator("input[name=q]").fill("dasturchi");
await p.keyboard.press("Enter");
await p.waitForURL(/q=dasturchi/);
await p.waitForLoadState("networkidle");
ok("search keeps filters", p.url().includes("work_format=remote"));
await p.screenshot({ path: `${out}/c-search.png` });

await p.goto(B + "/vacancies/" + slug, { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-detail.png`, fullPage: true });
ok("detail has h1", (await p.locator("h1").count()) === 1);
await p.getByRole("button", { name: "Ariza yuborish" }).first().click();
await p.waitForTimeout(800);
ok("apply dialog (anon) asks to sign in", await p.getByRole("dialog").getByText("tizimga kiring").isVisible());
await p.screenshot({ path: `${out}/c-apply-anon.png` });
await p.keyboard.press("Escape");

await p.goto(B + "/companies", { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-companies.png` });
await p.goto(B + "/companies/" + comp, { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-company.png`, fullPage: true });
await p.goto(B + "/employers", { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-employers.png`, fullPage: true });

// mobile
p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.goto(B + "/vacancies", { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-m-list.png` });
await p.getByRole("button", { name: "Filtrlar" }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/c-m-filters.png` });
await p.getByRole("dialog").getByRole("button", { name: "Ofisda" }).click();
await p.getByRole("button", { name: "Natijalarni ko'rsatish" }).click();
await p.waitForURL(/work_format=office/);
ok("mobile sheet applies filters", true);
await p.goto(B + "/vacancies/" + slug, { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-m-detail.png` });
const w = await p.evaluate(() => document.documentElement.scrollWidth);
ok("no horizontal scroll on mobile", w <= 390, `${w}`);

// dark
p = await page({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
await p.goto(B + "/vacancies/" + slug, { waitUntil: "networkidle" });
await p.screenshot({ path: `${out}/c-detail-dark.png` });

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
