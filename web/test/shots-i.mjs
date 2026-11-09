// Skills catalog: the admin reviews new skills — verifies one in bulk, renames one, merges
// a duplicate into it and deletes another — and the vacancy page shows the result.
// Needs dev servers (API + worker), bin/ctl built, and test mode (no TELEGRAM_GATEWAY_TOKEN).
//   node test/shots-i.mjs           (runs ../backend/bin/ctl; BACKEND=… to point elsewhere)
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
const W = String(R).replace(/\d/g, (d) => "abcdefghij"[d]); // letters only
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

const TGT = `Vue${W}`, DUP = `Vue${W}.js`, TYPO = `Rect${W}`, FIXED = `React${W}`, JUNK = `Asdf${W}`;
const boss = `iboss${R}@example.com`;
const tBoss = await register(boss, "employer");
const sent = await call("POST", "/auth/phone/send-code", tBoss, { phone: `+99892${String(R).padStart(7, "0")}` });
if (!sent.dev_code) throw new Error("needs test mode (no TELEGRAM_GATEWAY_TOKEN)");
await call("POST", "/auth/phone/verify", tBoss, { code: sent.dev_code });
const cats = await call("GET", "/catalog/categories");
const regions = await call("GET", "/catalog/regions");
const backend = cats.find((c) => c.slug === "it").children.find((c) => c.slug === "it-backend").id;
const tash = regions.find((r) => r.slug === "tashkent-city").id;
const company = await call("POST", "/companies", tBoss, { name: `Skillset ${R}`, region_id: tash });
const vacancy = await call("POST", `/companies/${company.id}/vacancies`, tBoss, {
  title: `Frontend ${R}`, description: "Foydalanuvchi interfeyslarini yaratish va qo'llab-quvvatlash, dizaynerlar bilan ishlash.",
  category_id: backend, region_id: tash, currency: "UZS", employment_type: "full_time", work_format: "office",
  experience: "1_3", schedule: "full_day", skills: [TGT, DUP, TYPO, JUNK],
});
const admin = `iadmin${R}@example.com`;
await register(admin, "seeker");
execFileSync("./bin/ctl", ["set-role", admin, "admin"], { cwd: BACKEND });
const tAdmin = await login(admin);
await call("POST", `/vacancies/${vacancy.id}/submit`, tBoss);
await call("POST", `/admin/vacancies/${vacancy.id}/approve`, tAdmin);
const skillNames = async () => (await call("GET", `/vacancies/${vacancy.slug}`, null)).skills.map((s) => s.name).sort();

// ---- browser -------------------------------------------------------------------------
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const open = async (scheme) => {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${m.type()}] ${p.url()} ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${p.url()} ${e.message}`));
  return { ctx, p, shot: (name) => p.screenshot({ path: `${out}/i-${name}-${scheme}.png` }) };
};
const signIn = async (p, email, next) => {
  await p.goto(B + `/login?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(email);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL((u) => u.pathname === next);
  await p.waitForLoadState("networkidle");
};
const row = (p, name) => p.locator("li").filter({ has: p.getByText(name, { exact: true }) });
const appears = (loc) => loc.waitFor({ timeout: 10000 }).then(() => true, () => false);
const disappears = (loc) => loc.waitFor({ state: "detached", timeout: 10000 }).then(() => true, () => false);

{
  const { ctx, p, shot } = await open("light");
  await signIn(p, admin, "/admin");
  ok("overview has a new-skills card", await appears(p.locator("main a[href='/admin/skills']").filter({ hasText: "Yangi ko'nikmalar" })));
  ok("sidebar links the skills page", await appears(p.locator("nav[aria-label='Hisob menyusi'] a[href='/admin/skills']")));

  await p.goto(B + `/admin/skills?q=${W}`, { waitUntil: "networkidle" });
  await row(p, TGT).waitFor();
  const names = [TGT, DUP, TYPO, JUNK];
  ok("review queue lists the new skills", (await Promise.all(names.map((n) => appears(row(p, n))))).every(Boolean));
  ok("usage shown", await row(p, DUP).getByText("Ishlatilmoqda: vakansiya 1 · rezyume 0").isVisible());
  await shot("queue");

  // bulk verify the target
  await row(p, TGT).getByRole("checkbox").click();
  await p.getByRole("button", { name: "Tanlanganlarni tasdiqlash" }).click();
  await p.getByText("1 ta ko'nikma tasdiqlandi").waitFor();
  await p.waitForLoadState("networkidle");
  ok("verified skill leaves the review queue", await disappears(row(p, TGT)));

  // rename the typo
  await row(p, TYPO).getByRole("button", { name: "Qayta nomlash" }).click();
  const input = p.getByRole("dialog").getByLabel("Yangi nom");
  await input.fill(FIXED);
  await p.waitForTimeout(150);
  await shot("rename");
  await p.getByRole("dialog").getByRole("button", { name: "Qayta nomlash" }).click();
  await p.getByText("Ko'nikma qayta nomlandi").waitFor();
  await row(p, FIXED).waitFor();
  ok("renamed row keeps the old name as an alias", await row(p, FIXED).getByText(`Boshqa nomlari: rect${W}`).isVisible());

  // merge the duplicate into the verified target
  await row(p, DUP).getByRole("button", { name: "Birlashtirish" }).click();
  const dlg = p.getByRole("dialog");
  await dlg.getByLabel("Qaysi ko'nikmaga").fill(TGT);
  await dlg.getByRole("radio", { name: new RegExp(TGT) }).first().click();
  await p.waitForTimeout(150);
  await shot("merge");
  await dlg.getByRole("button", { name: "Birlashtirish" }).last().click();
  await p.getByText("Ko'nikmalar birlashtirildi").waitFor();
  await p.waitForLoadState("networkidle");
  ok("duplicate is gone", await disappears(row(p, DUP)));

  // delete the junk skill
  await row(p, JUNK).getByRole("button", { name: "O'chirish" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "O'chirish" }).click();
  await p.getByText("Ko'nikma o'chirildi").waitFor();
  await p.waitForLoadState("networkidle");
  ok("deleted skill is gone", await disappears(row(p, JUNK)));

  ok("vacancy shows the cleaned-up skills", JSON.stringify(await skillNames()) === JSON.stringify([FIXED, TGT].sort()), (await skillNames()).join(","));
  await p.goto(B + `/vacancies/${vacancy.slug}`, { waitUntil: "networkidle" });
  ok("public page renders the merged skill", await p.getByText(TGT, { exact: true }).first().isVisible());
  await ctx.close();
}

{
  const { ctx, p, shot } = await open("dark");
  await signIn(p, admin, "/admin/skills");
  await p.goto(B + `/admin/skills?q=${W}&show=all&sort=in_use`, { waitUntil: "networkidle" });
  await row(p, TGT).waitFor();
  ok("all + in_use sort lists the verified target", await row(p, TGT).getByText("Tasdiqlangan").first().isVisible());
  await shot("all");
  await ctx.close();
}

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
process.exit(results.some((r) => r.startsWith("✘")) || errors.length ? 1 : 0);
