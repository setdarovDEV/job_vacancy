// Admin statistics: overview charts, period filter, tooltip, keyboard. Needs dev servers
// and bin/ctl built (makes the admin).   node test/shots-j.mjs   (BACKEND=… to point elsewhere)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const API = process.env.API ?? "http://localhost:8090/api/v1";
const BACKEND = process.env.BACKEND ?? "../backend";
const results = [];
const errors = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);

const R = Date.now() % 100000;
const call = async (method, path, token, body) => {
  const res = await fetch(API + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
};
const admin = `jadmin${R}@example.com`;
await call("POST", "/auth/register", null, { email: admin, password: "Secret123", full_name: `Test admin ${R}`, role: "seeker" });
execFileSync("./bin/ctl", ["set-role", admin, "admin"], { cwd: BACKEND });

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
  const shot = (name, opts = {}) => p.screenshot({ path: `${out}/j-${name}-${scheme}.png`, ...opts });

  await p.goto(B + "/login?next=/admin", { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(admin);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL(/\/admin$/);
  const stats = p.locator("section[aria-labelledby=stats-title]");
  await stats.getByRole("img").first().waitFor();
  await p.waitForTimeout(500);
  await stats.scrollIntoViewIfNeeded();
  await shot("stats", { fullPage: true });

  if (scheme === "light") {
    ok("five daily charts", (await stats.getByRole("img").count()) === 5);
    ok("default period 30 days selected", (await stats.getByRole("button", { name: "30 kun" }).getAttribute("aria-pressed")) === "true");
    const label = await stats.getByRole("img").first().getAttribute("aria-label");
    ok("chart has a summary label", /jami \d/.test(label ?? ""), label ?? "");
    ok("hidden data table has 30 rows", (await stats.locator("table").first().locator("tbody tr").count()) === 30);

    // hover → tooltip with a value and a date
    const svg = stats.getByRole("img").nth(2);
    const box = await svg.boundingBox();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4);
    await p.waitForTimeout(150);
    const tip = stats.locator(".glass-float").first();
    ok("hover shows a tooltip", await tip.isVisible());
    ok("tooltip has a value and a date", /^\d[\d\s]*\d*-?\w+/.test(((await tip.innerText()) || "").replace(/\n/g, "")), await tip.innerText());
    await shot("tooltip", { clip: { x: box.x - 40, y: box.y - 120, width: box.width + 80, height: box.height + 160 } });
    await p.mouse.move(0, 0);

    // keyboard: focus → today, ArrowLeft → yesterday
    await svg.focus();
    const today = await tip.innerText();
    await p.keyboard.press("ArrowLeft");
    const before = await tip.innerText();
    ok("keyboard moves the crosshair", today !== before, `${today.replace("\n", " ")} → ${before.replace("\n", " ")}`);
    await p.keyboard.press("Escape");

    // period switch keeps the frame and updates URL + bucket count
    await stats.getByRole("button", { name: "7 kun" }).click();
    await p.waitForURL(/days=7/);
    await p.waitForFunction(() => document.querySelector("section[aria-labelledby=stats-title] table tbody")?.children.length === 7);
    ok("7 days → 7 rows, URL ?days=7", true);
    await stats.getByRole("button", { name: "90 kun" }).click();
    await p.waitForFunction(() => document.querySelector("section[aria-labelledby=stats-title] table tbody")?.children.length === 90);
    ok("90 days → 90 rows", true);
    await shot("stats-90", { fullPage: true });
    await stats.getByRole("button", { name: "30 kun" }).click();
    await p.waitForURL((u) => !u.search.includes("days="));
    ok("30 days is the default (no param)", true);

    ok("top categories panel", await stats.getByRole("region", { name: "Eng faol sohalar" }).isVisible());
    ok("funnel lists four stages", (await stats.getByRole("list", { name: "Arizalar voronkasi" }).locator("li").count()) === 4
      || await stats.getByText("Bu davrda ma'lumot yo'q").first().isVisible());
  }
  await ctx.close();
}

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
process.exit(results.some((r) => r.startsWith("✘")) || errors.length ? 1 : 0);
