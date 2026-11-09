// Admin panel screenshots and checks. Needs dev servers, bin/ctl built, and no Telegram
// gateway token (test mode: phone codes come back as dev_code).
//   node test/shots-g.mjs           (runs ../backend/bin/ctl; BACKEND=… to point elsewhere)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const API = process.env.API ?? "http://localhost:8090/api/v1";
const BACKEND = process.env.BACKEND ?? "../backend"; // ctl reads .env from its working dir
const results = [];
const errors = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);

// ---- fixtures through the API ----------------------------------------------------------
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
const register = async (email, role) => (await call("POST", "/auth/register", null, { email, password: "Secret123", full_name: `Test ${role} ${R}`, role })).access_token;
const login = async (email) => (await call("POST", "/auth/login", null, { email, password: "Secret123" })).access_token;

const boss = `gboss${R}@example.com`;
let tBoss = await register(boss, "employer");
const sent = await call("POST", "/auth/phone/send-code", tBoss, { phone: `+99890${String(R).padStart(7, "0")}` });
if (!sent.dev_code) throw new Error("needs test mode (no TELEGRAM_GATEWAY_TOKEN)");
await call("POST", "/auth/phone/verify", tBoss, { code: sent.dev_code });
const cats = await call("GET", "/catalog/categories");
const regions = await call("GET", "/catalog/regions");
const backend = cats.find((c) => c.slug === "it").children.find((c) => c.slug === "it-backend").id;
const tash = regions.find((r) => r.slug === "tashkent-city").id;
const company = await call("POST", "/companies", tBoss, { name: `Galaktika ${R}`, region_id: tash });
const vacancy = (title) => ({
  title, description: "Yuqori yuklamali backend tizimlarini loyihalash va ishlab chiqish. Go, PostgreSQL, Redis.",
  category_id: backend, region_id: tash, currency: "UZS", salary_min: 12000000, salary_max: 20000000,
  employment_type: "full_time", work_format: "hybrid", experience: "1_3", schedule: "full_day", skills: ["Go", "PostgreSQL"],
});
const vA = await call("POST", `/companies/${company.id}/vacancies`, tBoss, vacancy(`Go dasturchi ${R}`));
const vB = await call("POST", `/companies/${company.id}/vacancies`, tBoss, vacancy(`Python dasturchi ${R}`));
await call("POST", `/vacancies/${vA.id}/submit`, tBoss);
await call("POST", `/vacancies/${vB.id}/submit`, tBoss);
const admin = `gadmin${R}@example.com`;
await register(admin, "seeker");
execFileSync("./bin/ctl", ["set-role", admin, "admin"], { cwd: BACKEND });
await login(admin);

// ---- browser -------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
  const shot = (name) => p.screenshot({ path: `${out}/g-${name}-${scheme}.png` });

  await p.goto(B + "/login?next=/admin", { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(admin);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL(/\/admin$/);
  await p.getByText("Moderatsiyani kutmoqda").waitFor();
  await p.waitForTimeout(400);
  await shot("overview");
  if (scheme === "light") {
    ok("header shows Boshqaruv for admins", await p.getByRole("banner").getByRole("link", { name: "Boshqaruv" }).isVisible());
    ok("sidebar has admin sections", (await p.locator("nav[aria-label='Hisob menyusi'] a[href^='/admin']").count()) === 5);
  }

  await p.goto(B + "/admin/moderation", { waitUntil: "networkidle" });
  // The light pass approves/rejects ours, so the dark pass may see other rows or an empty queue.
  await p.locator("main li a[href^='/admin/moderation/'], main h3").first().waitFor();
  await p.waitForTimeout(300);
  await shot("moderation");

  if (scheme === "light") {
    // approve A
    await p.goto(B + `/admin/moderation/${vA.id}`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Tasdiqlash va e'lon qilish" }).waitFor();
    await p.waitForTimeout(300);
    await shot("review");
    await p.getByRole("button", { name: "Tasdiqlash va e'lon qilish" }).click();
    await p.waitForURL(/\/admin\/moderation$/);
    ok("approve returns to queue", true);
    ok("approved vacancy is published", (await call("GET", `/vacancies/${vA.id}`)).status === "published");

    // reject B
    await p.goto(B + `/admin/moderation/${vB.id}`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Rad etish" }).first().click();
    await p.getByRole("dialog").waitFor();
    const submit = p.getByRole("dialog").getByRole("button", { name: "Rad etish" });
    await p.getByRole("dialog").locator("textarea").fill("abc");
    ok("short reason keeps reject disabled", await submit.isDisabled());
    await p.getByRole("dialog").locator("textarea").fill("Maosh oralig'ini aniqlashtiring");
    await p.waitForTimeout(250);
    await shot("reject");
    await submit.click();
    await p.waitForURL(/\/admin\/moderation$/);
    const tAdmin = await login(admin);
    ok("rejected vacancy has the reason", (await call("GET", `/vacancies/${vB.id}`, tAdmin)).reject_reason === "Maosh oralig'ini aniqlashtiring");
  }

  await p.goto(B + `/admin/companies?q=${encodeURIComponent("Galaktika " + R)}`, { waitUntil: "networkidle" });
  const row = p.locator("li", { hasText: `Galaktika ${R}` });
  await row.waitFor();
  await p.waitForTimeout(300);
  await shot("companies");
  if (scheme === "light") {
    await p.getByRole("button", { name: "Tasdiqlanmagan" }).click();
    await p.waitForURL(/show=unverified/);
    await row.waitFor();
    ok("unverified chip → status=active&verified=false", await row.isVisible());
    await p.getByRole("button", { name: "Bloklangan" }).click();
    await p.waitForURL(/show=blocked/);
    const gone = await row.waitFor({ state: "hidden", timeout: 5000 }).then(() => true, () => false);
    ok("blocked chip hides the active company", gone);
    await p.getByRole("button", { name: "Hammasi" }).click();
    await row.waitFor();
    await row.getByRole("button", { name: "Bloklash" }).click();
    await p.getByRole("dialog").waitFor();
    await p.waitForTimeout(250);
    await shot("block-dialog");
    await p.getByRole("dialog").getByRole("button", { name: "Bloklash" }).click();
    await row.getByText("Bloklangan").waitFor();
    const hidden = await fetch(`${API}/vacancies/${vA.id}`).then((r) => r.status);
    ok("blocked company's vacancy is hidden", hidden === 404, `status ${hidden}`);
    await row.getByRole("button", { name: "Blokdan chiqarish" }).click();
    await row.getByRole("button", { name: "Bloklash" }).waitFor();
    const back = await fetch(`${API}/vacancies/${vA.id}`).then((r) => r.status);
    ok("unblocked: vacancy is back", back === 200, `status ${back}`);
    await row.getByRole("button", { name: "Tasdiqlash" }).click();
    await row.getByText("Tasdiqlangan").waitFor();
    ok("verify from the list", true);
  }

  await p.goto(B + `/admin/users?q=${R}`, { waitUntil: "networkidle" });
  await p.locator("li", { hasText: "Test employer" }).waitFor();
  await p.waitForTimeout(300);
  await shot("users");
  if (scheme === "light") {
    const self = p.locator("li", { hasText: "Siz" });
    ok("own row: block disabled", await self.getByRole("button", { name: "Bloklash" }).isDisabled());
    const bossRow = p.locator("li", { hasText: boss });
    await bossRow.getByRole("button", { name: "Bloklash" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Bloklash" }).click();
    await bossRow.getByText("Bloklangan").waitFor();
    const refused = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: boss, password: "Secret123" }) }).then((r) => r.status);
    ok("blocked user can't sign in", refused === 403, `status ${refused}`);
    await bossRow.getByRole("button", { name: "Blokdan chiqarish" }).click();
    await bossRow.getByRole("button", { name: "Bloklash" }).waitFor();
    ok("unblock user", true);
  }
  await ctx.close();
}

// A non-admin following an admin link gets an explanation, not a broken page.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
  await p.goto(B + "/login?next=/admin/users", { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(boss);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL(/\/admin\/users$/);
  await p.getByText("Bu bo'lim faqat administratorlar uchun.").waitFor();
  ok("non-admin sees the admins-only notice", true);
  await ctx.close();
}

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
process.exit(results.some((r) => r.startsWith("✘")) || errors.length ? 1 : 0);
