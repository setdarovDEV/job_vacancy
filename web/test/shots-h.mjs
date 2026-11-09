// Reports: a seeker reports a vacancy and a company, the admin takes the vacancy down
// (closing its reports as resolved) and dismisses the company's; the reporter is notified.
// Needs dev servers, bin/ctl built, and test mode (no TELEGRAM_GATEWAY_TOKEN).
//   node test/shots-h.mjs           (runs ../backend/bin/ctl; BACKEND=… to point elsewhere)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const API = process.env.API ?? "http://localhost:8090/api/v1";
const BACKEND = process.env.BACKEND ?? "../backend";
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

const boss = `hboss${R}@example.com`;
const tBoss = await register(boss, "employer");
const sent = await call("POST", "/auth/phone/send-code", tBoss, { phone: `+99891${String(R).padStart(7, "0")}` });
if (!sent.dev_code) throw new Error("needs test mode (no TELEGRAM_GATEWAY_TOKEN)");
await call("POST", "/auth/phone/verify", tBoss, { code: sent.dev_code });
const cats = await call("GET", "/catalog/categories");
const regions = await call("GET", "/catalog/regions");
const sales = cats.find((c) => c.slug === "it").children.find((c) => c.slug === "it-backend").id;
const tash = regions.find((r) => r.slug === "tashkent-city").id;
const company = await call("POST", "/companies", tBoss, { name: `Shubhali ${R}`, region_id: tash });
const vacancy = await call("POST", `/companies/${company.id}/vacancies`, tBoss, {
  title: `Uydan ishlash ${R}`, description: "Kuniga 2 soat ishlab, oyiga 20 million so'm. Ro'yxatdan o'tish uchun oldindan to'lov.",
  category_id: sales, region_id: tash, currency: "UZS", salary_min: 20000000,
  employment_type: "part_time", work_format: "remote", experience: "none", schedule: "flexible", skills: [],
});
await call("POST", `/vacancies/${vacancy.id}/submit`, tBoss);
const admin = `hadmin${R}@example.com`;
await register(admin, "seeker");
execFileSync("./bin/ctl", ["set-role", admin, "admin"], { cwd: BACKEND });
const tAdmin = await login(admin);
await call("POST", `/admin/vacancies/${vacancy.id}/approve`, tAdmin);
const seeker = `hseek${R}@example.com`;
await register(seeker, "seeker");

// ---- browser -------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const open = async (scheme) => {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() !== "error" && !/hydrat/i.test(m.text())) return;
    // The second report on the same target is answered 409 on purpose (shown as "already reported").
    if (/status of 409/.test(m.text())) return;
    errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`);
  });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
  return { ctx, p, shot: (name) => p.screenshot({ path: `${out}/h-${name}-${scheme}.png` }) };
};
const signIn = async (p, email, next) => {
  await p.goto(B + `/login?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(email);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL((u) => u.pathname === next);
  await p.waitForLoadState("networkidle");
};

// anonymous visitor: sign-in prompt
{
  const { ctx, p } = await open("light");
  await p.goto(B + `/vacancies/${vacancy.slug}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Shikoyat qilish" }).click();
  await p.getByRole("dialog").getByText("Shikoyat qilish uchun tizimga kiring.").waitFor();
  ok("anon: report asks to sign in", true);
  await ctx.close();
}

// the company's own employer doesn't see the button
{
  const { ctx, p } = await open("light");
  await signIn(p, boss, `/vacancies/${vacancy.slug}`);
  await p.getByRole("heading", { name: vacancy.title }).waitFor();
  ok("own team: no report button", (await p.getByRole("button", { name: "Shikoyat qilish" }).count()) === 0);
  await ctx.close();
}

// seeker reports the vacancy (fraud) and the company (other, comment required)
for (const scheme of ["light", "dark"]) {
  const { ctx, p, shot } = await open(scheme);
  await signIn(p, seeker, `/vacancies/${vacancy.slug}`);
  await p.getByRole("button", { name: "Shikoyat qilish" }).click();
  const dlg = p.getByRole("dialog");
  await dlg.getByText("Firibgarlik").click();
  await dlg.locator("textarea").fill("Ishga olish uchun oldindan 300 ming so'm so'rashdi");
  await p.waitForTimeout(250);
  await shot("report-dialog");
  await dlg.getByRole("button", { name: "Yuborish" }).click();
  if (scheme === "light") {
    await dlg.getByText("Rahmat! Shikoyatingiz yuborildi").waitFor();
    ok("vacancy reported", true);
    await dlg.getByRole("button", { name: "Yopish" }).last().click();
    // company page: "other" needs a comment
    await p.goto(B + `/companies/${company.slug}`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Shikoyat qilish" }).click();
    await dlg.getByText("Boshqa", { exact: true }).click();
    ok("other without a comment can't be sent", await dlg.getByRole("button", { name: "Yuborish" }).isDisabled());
    await dlg.locator("textarea").fill("Bir xil firibgarlik e'lonlarini har kuni joylaydi");
    await dlg.getByRole("button", { name: "Yuborish" }).click();
    await dlg.getByText("Rahmat! Shikoyatingiz yuborildi").waitFor();
    ok("company reported", true);
  } else {
    // Same reporter, same target, still open: shown as "already reported".
    await dlg.getByText("Siz bunga allaqachon shikoyat qilgansiz").waitFor();
    await p.waitForTimeout(250);
    await shot("report-already");
    ok("second report shows 'already reported'", true);
  }
  await ctx.close();
}

// admin: overview card, queue, takedown + resolve, dismiss
for (const scheme of ["light", "dark"]) {
  const { ctx, p, shot } = await open(scheme);
  await signIn(p, admin, "/admin");
  if (scheme === "light") {
    const card = p.getByRole("link", { name: /Shikoyat qilinganlar/ });
    await card.waitFor();
    ok("overview has a reports card", await card.isVisible());
    ok("sidebar links the reports queue", await p.locator("nav[aria-label='Hisob menyusi'] a[href='/admin/reports']").isVisible());
  }
  await p.goto(B + "/admin/reports" + (scheme === "dark" ? "?status=resolved" : ""), { waitUntil: "networkidle" });
  const vRow = p.locator("main li", { hasText: vacancy.title });
  await vRow.waitFor();
  await p.waitForTimeout(300);
  await shot("queue");
  if (scheme === "light") {
    ok("vacancy row shows the comment", await vRow.getByText("oldindan 300 ming").isVisible());
    ok("reason chip with count", await vRow.getByText("Firibgarlik · 1").isVisible());
    await vRow.getByRole("button", { name: "Vakansiyani olib tashlash" }).click();
    const dlg = p.getByRole("dialog");
    await dlg.locator("textarea").fill("Firibgarlik: ishga olish uchun pul so'ralgan");
    await p.waitForTimeout(250);
    await shot("takedown");
    await dlg.getByRole("button", { name: "Vakansiyani olib tashlash" }).click();
    await vRow.waitFor({ state: "hidden" });
    const status = await fetch(`${API}/vacancies/${vacancy.id}`).then((r) => r.status);
    ok("taken down: public page 404", status === 404, `status ${status}`);
    ok("takedown also resolved the reports", (await call("GET", `/admin/reports?status=resolved&target_type=vacancy&limit=100`, tAdmin)).some((r) => r.target_id === vacancy.id));

    const cRow = p.locator("main li", { hasText: `Shubhali ${R}` });
    await cRow.getByRole("button", { name: "Asossiz" }).click();
    await p.getByRole("dialog").getByRole("button", { name: "Asossiz" }).click();
    await cRow.waitFor({ state: "hidden" });
    ok("company reports dismissed", (await call("GET", `/admin/reports?status=dismissed&target_type=company&limit=100`, tAdmin)).some((r) => r.target_id === company.id));
    await p.getByRole("button", { name: "Hal qilingan" }).click();
    await p.waitForURL(/status=resolved/);
    await vRow.waitFor();
    ok("resolved filter shows the vacancy", true);
  }
  await ctx.close();
}

// the reporter sees both outcomes
{
  const { ctx, p, shot } = await open("light");
  await signIn(p, seeker, "/me/notifications");
  await p.getByText(`Shikoyatingiz bo'yicha choralar ko'rildi: «${vacancy.title}»`).waitFor();
  await p.getByText(`qoidabuzarlik topilmadi: «Shubhali ${R}»`).waitFor();
  await p.waitForTimeout(250);
  await shot("notifications");
  ok("reporter notified of both outcomes", true);
  await ctx.close();
}

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
process.exit(results.some((r) => r.startsWith("✘")) || errors.length ? 1 : 0);
