// Seeker area screenshots and checks. Needs dev servers + `backend/test/e2e/seed_demo.sh`.
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));

await p.goto(B + "/me/applications", { waitUntil: "networkidle" });
ok("anon is sent to login", p.url().includes("/login?next="), p.url());
await p.locator("input[type=email]").fill("seeker@demo.uz");
await p.locator("input[type=password]").fill("Secret123");
await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
await p.waitForURL(/\/me\/applications/);
await p.waitForLoadState("networkidle");
ok("login returns to next", p.url().endsWith("/me/applications"));
await p.screenshot({ path: `${out}/d-applications.png` });

await p.locator("a[href*='/me/applications/']").first().click();
await p.getByText("Holat tarixi").waitFor();
await p.screenshot({ path: `${out}/d-application.png`, fullPage: true });
ok("application detail", true);

for (const [path, name] of [["/me", "settings"], ["/me/resumes", "resumes"], ["/me/saved", "saved"], ["/me/searches", "searches"], ["/me/notifications", "notifications"]]) {
  await p.goto(B + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/d-${name}.png`, fullPage: true });
}
await p.goto(B + "/me/resumes", { waitUntil: "networkidle" });
await p.getByRole("link", { name: "Tahrirlash" }).first().click();
await p.waitForLoadState("networkidle");
await p.screenshot({ path: `${out}/d-resume-edit.png`, fullPage: true });
const skills = p.getByRole("combobox", { name: "Ko'nikmalar" });
await skills.fill("Kube");
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/d-skill-suggest.png` });
await skills.press("Enter");
await p.getByRole("button", { name: "Saqlash" }).click();
await p.waitForURL(/\/me\/resumes$/);
ok("resume saves", true);
await p.getByRole("link", { name: "Ochish" }).first().click();
await p.getByRole("heading", { level: 1 }).filter({ hasText: "Go dasturchi" }).waitFor();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/d-resume-view.png`, fullPage: true });

// vacancy save toggle from list
await p.goto(B + "/vacancies", { waitUntil: "networkidle" });
const heart = p.locator("article button[aria-pressed]").first();
const before = await heart.getAttribute("aria-pressed");
await heart.click();
await p.waitForTimeout(500);
ok("save toggles", (await heart.getAttribute("aria-pressed")) !== before);
await heart.click();

// mobile account nav
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
const mp = await m.newPage();
await mp.goto(B + "/me", { waitUntil: "networkidle" });
await mp.waitForTimeout(800);
await mp.screenshot({ path: `${out}/d-m-settings.png` });
ok("no horizontal scroll (mobile /me)", (await mp.evaluate(() => document.documentElement.scrollWidth)) <= 390);

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
