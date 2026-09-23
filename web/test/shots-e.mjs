// Employer area screenshots and checks. Needs dev servers + `backend/test/e2e/seed_demo.sh`.
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));

await p.goto(B + "/login?next=/employer", { waitUntil: "networkidle" });
await p.locator("input[type=email]").fill("hr@demo.uz");
await p.locator("input[type=password]").fill("Secret123");
await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
await p.waitForURL(/\/employer$/);
await p.getByText("Demo Texnologiyalari").first().waitFor();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/e-dashboard.png` });
ok("dashboard lists vacancies", (await p.locator("li a[href*='/applications']").count()) > 0);

await p.goto(B + "/employer/company", { waitUntil: "networkidle" });
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/e-company.png`, fullPage: true });

// new vacancy → publish (verified company → published at once)
await p.goto(B + "/employer/vacancies/new", { waitUntil: "networkidle" });
await p.getByLabel("Lavozim nomi").fill("Omborxona mudiri " + Date.now() % 10000);
await p.getByRole("combobox", { name: "Soha" }).click();
await p.getByRole("option").first().click();
await p.locator("#vac-desc").fill("Omborni boshqarish, kirim-chiqimni hisobga olish, 1C bilan ishlash.\n\n- Inventarizatsiya\n- Hisobotlar");
await p.getByText("Ofisda").click();
await p.getByRole("combobox", { name: "Hudud" }).click();
await p.getByRole("option").first().click();
await p.screenshot({ path: `${out}/e-vacancy-form.png`, fullPage: true });
await p.getByRole("button", { name: "E'lon qilish" }).click();
await p.waitForURL(/\/employer$/);
await p.waitForTimeout(600);
ok("vacancy published", await p.getByText("Omborxona mudiri").first().isVisible());

// kanban: drag the demo application to "Suhbat"
await p.goto(B + "/employer", { waitUntil: "networkidle" });
await p.getByRole("link", { name: "Go backend dasturchi" }).first().click();
await p.locator("article[draggable=true]").first().waitFor();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}/e-kanban.png` });
const card = p.locator("article[draggable=true]").first();
const target = p.locator("section[aria-label='Suhbat']");
// Real pointer moves (dragTo doesn't start an HTML5 drag through the card's link overlay).
const b = await card.boundingBox();
const tb = await target.boundingBox();
await p.mouse.move(b.x + 20, b.y + b.height - 10);
await p.mouse.down();
for (let i = 1; i <= 10; i++) await p.mouse.move(b.x + 20 + ((tb.x + 60 - b.x - 20) * i) / 10, b.y + 40, { steps: 2 });
await p.mouse.up();
await p.waitForTimeout(1200);
ok("drag moves card", (await target.locator("article").count()) > 0);
await p.screenshot({ path: `${out}/e-kanban-moved.png` });
await target.locator("article a").first().click();
await p.getByText("Ichki izoh").waitFor();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/e-application.png`, fullPage: true });
// move back to "Ko'rildi" via the stage select so the demo stays reusable
await p.getByRole("combobox", { name: "Bosqichga o'tkazish" }).click();
await p.getByRole("option", { name: "Ko'rildi" }).click();
await p.waitForTimeout(600);

await p.goto(B + "/employer/candidates", { waitUntil: "networkidle" });
await p.locator("ul li").first().waitFor();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/e-candidates.png` });
await p.getByRole("button", { name: "Taklif yuborish" }).first().click();
await p.getByRole("dialog").waitFor();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/e-invite.png` });
ok("invite dialog opens", await p.getByRole("dialog").isVisible());

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
