// Browser smoke test for the design system and shell (needs `pnpm dev` running).
//   pnpm add -D playwright-core  (once)
//   WEB=http://localhost:5180 CHROME=/usr/bin/google-chrome node test/browser-smoke.mjs
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

// desktop /ui
let p = await page({ viewport: { width: 1280, height: 900 } });
await p.goto(B + "/ui", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.getByRole("button", { name: "Dialog" }).click();
await p.waitForTimeout(400);
ok("dialog opens", await p.getByRole("dialog").isVisible());
await p.screenshot({ path: `${out}/dlg.png` });
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
ok("dialog closes on Escape", !(await p.getByRole("dialog").isVisible().catch(() => false)));
await p.getByRole("button", { name: "Menyu" }).click();
await p.waitForTimeout(300);
ok("menu opens", await p.getByRole("menu").isVisible());
await p.keyboard.press("ArrowDown");
await p.screenshot({ path: `${out}/menu.png` });
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Toast", exact: true }).click();
await p.waitForTimeout(600);
ok("toast shows", await p.getByRole("status").filter({ hasText: "Ariza yuborildi" }).isVisible());
await p.screenshot({ path: `${out}/toast.png` });
// tabs indicator moves
const tabs = p.getByRole("tab");
await tabs.nth(2).click();
await p.waitForTimeout(500);
ok("tab selected", (await tabs.nth(2).getAttribute("aria-selected")) === "true");
// chips toggle
const chip = p.getByRole("button", { name: "Gibrid" });
await chip.click();
ok("chip toggles", (await chip.getAttribute("aria-pressed")) === "true");

// theme: choose dark, then reload keeps it (cookie) without flash
await p.getByRole("button", { name: "Mavzu" }).click();
await p.waitForTimeout(250);
await p.screenshot({ path: `${out}/theme-popover.png` });
ok("theme popover opens", await p.getByRole("radiogroup", { name: "Mavzu" }).first().isVisible());
await p.getByRole("radio", { name: "Qorong'i" }).first().check({ force: true });
ok("theme applied", (await p.evaluate(() => document.documentElement.dataset.theme)) === "dark");
await p.reload({ waitUntil: "networkidle" });
const ssrTheme = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
ok("theme survives reload (SSR)", ssrTheme === "dark", `data-theme=${ssrTheme}`);

// language switch via menu keeps the path
await p.getByRole("button", { name: "Til" }).click();
await p.waitForTimeout(250);
const pop = await p.evaluate(() => { const el = document.querySelector("[popover]:popover-open"); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), right: Math.round(r.right), vw: innerWidth }; });
ok("language popover under its button, on screen", !!pop && pop.top > 50 && pop.right <= pop.vw, JSON.stringify(pop));
await p.keyboard.press("Escape");
ok("Escape closes popover", !(await p.evaluate(() => !!document.querySelector("[popover]:popover-open"))));
await p.getByRole("button", { name: "Til" }).click();
await p.getByRole("link", { name: "Русский" }).click();
await p.waitForURL("**/ru/ui");
await p.waitForTimeout(500);
ok("language switch → /ru/ui", p.url().endsWith("/ru/ui"));
ok("html lang ru", (await p.evaluate(() => document.documentElement.lang)) === "ru");
ok("nav translated", await p.getByRole("link", { name: "Вакансии" }).first().isVisible());

// keyboard: skip link is first focusable
await p.goto(B + "/", { waitUntil: "networkidle" });
await p.keyboard.press("Tab");
ok("skip link focused first", (await p.evaluate(() => document.activeElement?.getAttribute("href"))) === "#main");
await p.screenshot({ path: `${out}/skip.png` });

// mobile: menu sheet
p = await page({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await p.goto(B + "/", { waitUntil: "networkidle" });
const before = await p.evaluate(() => performance.getEntriesByType("resource").filter((r) => r.name.includes("MobileMenu")).length);
ok("mobile menu code not loaded upfront", before === 0);
await p.getByRole("button", { name: "Menyu" }).click();
await p.waitForTimeout(600);
ok("mobile menu sheet opens (lazy)", await p.getByRole("dialog").isVisible());
await p.getByRole("dialog").getByRole("link", { name: "Kompaniyalar" }).click();
await p.waitForTimeout(400);
ok("menu closes after navigating", !(await p.getByRole("dialog").isVisible().catch(() => false)));
await p.screenshot({ path: `${out}/mobile-menu.png` });

// search form submits to localized vacancies URL
await p.goto(B + "/en", { waitUntil: "networkidle" });
await p.getByRole("searchbox").fill("go developer");
await p.getByRole("combobox").first().click();
await p.getByRole("option").nth(1).click();
await p.getByRole("button", { name: "Search" }).click();
await p.waitForURL(/\/en\/vacancies\?/);
ok("search submits q + region to /en/vacancies", /\/en\/vacancies\?q=go\+developer&region_id=\d+/.test(p.url()), p.url().replace(B, ""));

console.log(results.join("\n"));
if (results.some((r) => r.startsWith("✘"))) process.exitCode = 1;
console.log(errors.length ? "\nconsole errors:\n" + [...new Set(errors)].join("\n") : "\nno console errors");
await browser.close();
