// Custom Select: looks, search, keyboard, forms, inside a modal sheet, mobile.
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
const watch = (p) => {
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`${p.url()} ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
};

// Dark desktop, signed-in seeker: resume form (grouped, long list → search field)
const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
watch(p);
await p.goto(B + "/login?next=/me/resumes/new", { waitUntil: "networkidle" });
await p.locator("input[type=email]").fill("seeker@demo.uz");
await p.locator("input[type=password]").fill("Secret123");
await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
await p.waitForURL(/\/me\/resumes\/new/);
const soha = p.getByRole("combobox", { name: "Soha" });
await soha.waitFor();
ok("native <select> gone", (await p.locator("select").count()) === 0);
await soha.click();
await p.waitForTimeout(250);
const list = p.getByRole("listbox");
ok("list opens", await list.isVisible());
ok("aria-expanded", (await soha.getAttribute("aria-expanded")) === "true");
const box = await p.locator("[popover]:popover-open").boundingBox();
const tb = await soha.boundingBox();
ok("list sits under the field, same width", Math.abs(box.x - tb.x) < 2 && box.width >= tb.width - 1 && box.y > tb.y + tb.height, JSON.stringify({ x: box.x, w: box.width, tx: tb.x, tw: tb.width }));
ok("search field focused", await p.getByRole("searchbox").evaluate((el) => el === document.activeElement));
await p.screenshot({ path: `${out}/sel-open-dark.png` });
await p.keyboard.type("front");
await p.waitForTimeout(150);
const n = await p.getByRole("option").count();
ok("filtering", n >= 1 && n < 5, `${n} options`);
await p.screenshot({ path: `${out}/sel-filter-dark.png` });
await p.keyboard.press("Enter");
await p.waitForTimeout(250);
ok("Enter picks + closes", (await soha.textContent()).includes("Frontend") && !(await list.isVisible()), await soha.textContent());
ok("focus back on field", await soha.evaluate((el) => el === document.activeElement));
// keyboard open, arrows, Escape
await p.keyboard.press("ArrowDown");
await p.waitForTimeout(200);
ok("ArrowDown opens", await list.isVisible());
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
ok("Escape closes", !(await list.isVisible()));
// outside click
const city = p.getByRole("combobox", { name: "Shahar yoki viloyat" });
await city.click();
await p.waitForTimeout(200);
await p.mouse.click(1300, 150);
await p.waitForTimeout(200);
ok("outside click closes", !(await p.getByRole("listbox").isVisible()));
// near the bottom of the viewport it opens upwards
await p.getByRole("combobox").last().scrollIntoViewIfNeeded();
await p.evaluate(() => window.scrollBy(0, -(window.innerHeight - 260 - document.querySelectorAll("[role=combobox]")[document.querySelectorAll("[role=combobox]").length - 1].getBoundingClientRect().bottom)));
const last = p.getByRole("combobox").last();
await last.click();
await p.waitForTimeout(250);
const lb = await p.locator("[popover]:popover-open").boundingBox();
const tl = await last.boundingBox();
ok("stays on screen", lb.y >= 0 && lb.y + lb.height <= 900, JSON.stringify({ y: Math.round(lb.y), h: Math.round(lb.height), trig: Math.round(tl.y) }));
await p.screenshot({ path: `${out}/sel-edge-dark.png` });
await p.keyboard.press("Escape");

// Light mobile: inside the filters sheet (Radix modal) and the hero form
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "light" });
const mp = await m.newPage();
watch(mp);
await mp.goto(B + "/vacancies", { waitUntil: "networkidle" });
await mp.getByRole("button", { name: "Filtrlar" }).click();
await mp.waitForTimeout(400);
await mp.getByRole("dialog").getByRole("combobox", { name: "Hudud" }).tap();
await mp.waitForTimeout(300);
await mp.screenshot({ path: `${out}/sel-sheet-mobile.png` });
ok("search not auto-focused on touch", !(await mp.getByRole("searchbox").evaluate((el) => el === document.activeElement).catch(() => false)));
await mp.getByRole("option", { name: "Samarqand viloyati" }).tap();
await mp.waitForTimeout(300);
ok("picked inside modal, sheet stays open", (await mp.getByRole("dialog").isVisible()) && (await mp.getByRole("dialog").getByRole("combobox", { name: "Hudud" }).textContent()).includes("Samarqand"));
await mp.getByRole("button", { name: "Natijalarni ko'rsatish" }).tap();
await mp.waitForURL(/region_id=/);
ok("filter applied", /region_id=\d+/.test(mp.url()));

await mp.goto(B + "/", { waitUntil: "networkidle" });
await mp.getByRole("combobox").first().tap();
await mp.waitForTimeout(300);
await mp.screenshot({ path: `${out}/sel-hero-mobile.png` });
await mp.getByRole("option", { name: "Toshkent shahri" }).tap();
await mp.getByRole("button", { name: "Qidirish" }).tap();
await mp.waitForURL(/\/vacancies\?/);
ok("hero form submits region", /region_id=\d+/.test(mp.url()), mp.url().replace(B, ""));
const w = await mp.evaluate(() => document.documentElement.scrollWidth);
ok("no horizontal scroll", w <= 390, String(w));

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
