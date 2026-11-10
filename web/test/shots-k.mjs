// Launch readiness: admin 2FA (enroll in settings, recovery codes, sign in with a code),
// feedback (footer dialog → admin queue → handled), cookie settings reopening the banner.
// Needs dev servers and bin/ctl built.   node test/shots-k.mjs   (~1 min: waits for a fresh TOTP window)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const API = process.env.API ?? "http://localhost:8090/api/v1";
const BACKEND = process.env.BACKEND ?? "../backend";
const results = [];
const errors = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
const totp = (secret) => execFileSync("./bin/ctl", ["totp", secret], { cwd: BACKEND }).toString().trim();
const nextWindow = () => new Promise((r) => setTimeout(r, (31 - (Math.floor(Date.now() / 1000) % 30)) * 1000));

const R = Date.now() % 100000;
const admin = `kadmin${R}@example.com`;
await fetch(API + "/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: admin, password: "Secret123", full_name: `Test admin ${R}`, role: "seeker" }),
});
execFileSync("./bin/ctl", ["set-role", admin, "admin"], { cwd: BACKEND });

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
const shot = (name) => p.screenshot({ path: `${out}/k-${name}.png`, fullPage: true });
const login = async () => {
  await p.goto(B + "/login?next=/admin", { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(admin);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
};

// ---- feedback as a visitor
await p.goto(B + "/", { waitUntil: "networkidle" });
const cookieBanner = p.getByRole("region", { name: /cookie/i });
if (await cookieBanner.isVisible()) await cookieBanner.getByRole("button").first().click();
await p.getByRole("button", { name: "Fikr bildirish" }).click();
const dlg = p.getByRole("dialog");
await dlg.waitFor();
await dlg.getByText("Xato", { exact: true }).click();
await dlg.locator("textarea").fill(`Browser test feedback ${R}`);
await dlg.locator("input").last().fill("tester@example.com");
await shot("feedback-dialog");
await dlg.getByRole("button", { name: "Yuborish" }).click();
await dlg.getByText("Rahmat!").waitFor();
ok("feedback sent", true);
await dlg.getByRole("button", { name: "Yopish" }).last().click();

await p.getByRole("button", { name: "Cookie sozlamalari" }).click();
ok("cookie settings bring the banner back", await cookieBanner.isVisible());
await cookieBanner.getByRole("button").first().click();

// ---- admin: enroll 2FA in settings
await login();
await p.waitForURL((u) => u.pathname === "/admin");
const card = p.getByRole("link", { name: /Yangi fikrlar/ });
await card.waitFor({ timeout: 10000 }).catch(() => {});
ok("feedback card on overview", await card.isVisible());
await p.goto(B + "/me", { waitUntil: "networkidle" });
const section = p.locator("#two-factor");
await section.getByRole("button", { name: "Yoqish" }).click();
await section.getByRole("button", { name: "Yoqish" }).click(); // start → setup
const secretEl = section.getByTestId("totp-secret");
await secretEl.waitFor();
await section.locator("svg").first().waitFor();
ok("QR code rendered", (await section.locator("[role=img] svg").count()) === 1);
const secret = (await secretEl.innerText()).trim();
await shot("2fa-enroll");
await section.locator("input[inputmode=numeric]").fill(totp(secret));
const codes = section.getByTestId("recovery-codes");
await codes.waitFor();
ok("10 recovery codes shown", (await codes.locator("li").count()) === 10);
await shot("2fa-codes");
await section.getByRole("button", { name: "Saqladim" }).click();
await section.getByText("Yoqilgan").waitFor();
ok("status: on", true, await section.getByText(/zaxira kod qoldi/).innerText());

// ---- sign out, sign in with a code
await ctx.clearCookies();
await p.evaluate(() => localStorage.clear());
await nextWindow();
await login();
const step = p.getByText("Tasdiqlash kodi");
await step.waitFor();
ok("password alone asks for a code", true);
await shot("2fa-login");
await p.locator("input[inputmode=numeric]").fill(totp(secret));
await p.waitForURL((u) => u.pathname === "/admin");
ok("code signs in", true);

// ---- admin feedback queue
await p.goto(B + "/admin/feedback", { waitUntil: "networkidle" });
const row = p.locator("li", { hasText: `Browser test feedback ${R}` });
await row.waitFor();
ok("feedback in the queue with contact", (await row.innerText()).includes("tester@example.com"));
await shot("admin-feedback");
await row.getByRole("button", { name: "Ko'rib chiqildi" }).click();
await row.waitFor({ state: "detached" });
ok("marked handled leaves the open list", true);

await browser.close();
console.log(results.join("\n"));
if (errors.length) console.log("console errors:\n" + errors.join("\n"));
process.exit(results.some((r) => r.startsWith("✘")) || errors.length ? 1 : 0);
