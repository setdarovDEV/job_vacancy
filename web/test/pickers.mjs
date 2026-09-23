// Month/year pickers and selects in the resume form, in Chromium and Firefox.
//   BROWSER=firefox node test/pickers.mjs   (default: chromium)
import { chromium, firefox } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const kind = process.env.BROWSER ?? "chromium";
const browser = kind === "firefox"
  ? await firefox.launch(process.env.FIREFOX ? { executablePath: process.env.FIREFOX } : {})
  : await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} [${kind}] ${name}${extra ? " — " + extra : ""}`);
const ctx = await browser.newContext({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
// timeStamp entries are React dev-build perf markers ("Hydrated"), not problems.
p.on("console", (m) => { if (m.type() === "error" || (m.type() !== "timeStamp" && /hydrat/i.test(m.text()))) errors.push(m.text().slice(0, 200)); });
p.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

await p.goto(B + "/login?next=/me/resumes/new", { waitUntil: "networkidle" });
await p.locator("input[type=email]").fill("seeker@demo.uz");
await p.locator("input[type=password]").fill("Secret123");
await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
await p.waitForURL(/\/me\/resumes\/new/);
await p.getByLabel("Qaysi lavozimda ishlamoqchisiz").fill("Full Stack Engineer");
await p.getByRole("button", { name: "Ish joyi qo'shish" }).click();
ok("no native month inputs", (await p.locator("input[type=month], input[type=number]").count()) === 0);
await p.getByLabel("Kompaniya", { exact: true }).fill("Protouch");
await p.getByLabel("Lavozim", { exact: true }).fill("Full Stack dasturchi");

// start month: open, go back a year with the arrow, pick March
const start = p.getByRole("button", { name: "Boshlagan oy" });
await start.click();
await p.waitForTimeout(250);
const dlg = p.getByRole("dialog", { name: "Oyni tanlang" });
ok("month grid opens", await dlg.isVisible());
ok("future months disabled", (await dlg.getByRole("button", { name: /Dekabr/ }).isDisabled()));
await p.screenshot({ path: `${out}/pick-month-${kind}.png` });
await dlg.getByRole("button", { name: "Oldingi yil" }).click();
await dlg.getByRole("button", { name: /^Mart/ }).click();
await p.waitForTimeout(200);
const y = new Date().getFullYear() - 1;
ok("month picked", (await start.textContent()).includes(`Mart ${y}`), await start.textContent());

// jump by years: click the year title, pick 2019, then June
await start.click();
await p.waitForTimeout(200);
await dlg.getByRole("button", { name: "Yilni tanlash" }).click();
await p.screenshot({ path: `${out}/pick-years-${kind}.png` });
// 12-year pages: step back until 2019 is on the page
for (let i = 0; i < 5 && !(await dlg.getByRole("button", { name: "2019", exact: true }).isVisible()); i++) await dlg.getByRole("button", { name: "Oldingi yillar" }).click();
await dlg.getByRole("button", { name: "2019", exact: true }).click();
await dlg.getByRole("button", { name: /^Iyun/ }).click();
ok("year jump", (await start.textContent()).includes("Iyun 2019"), await start.textContent());

// keyboard: open, arrow right, Enter → July 2019
await start.focus();
await p.keyboard.press("Enter");
await p.waitForTimeout(200);
await p.keyboard.press("ArrowRight");
await p.keyboard.press("Enter");
await p.waitForTimeout(200);
ok("keyboard pick", (await start.textContent()).includes("Iyul 2019"), await start.textContent());

// end month: disabled while "I work here now"; after unchecking it can't precede the start
const end = p.getByRole("button", { name: "Tugagan oy" });
ok("end disabled while current", await end.isDisabled());
await p.getByLabel("Hozir shu yerda ishlayman").click();
await end.click();
await p.waitForTimeout(200);
const endDlg = p.getByRole("dialog", { name: "Oyni tanlang" });
for (let i = 0; i < 10 && (await endDlg.getByRole("button", { name: "Yilni tanlash" }).textContent()) !== "2019"; i++) await endDlg.getByRole("button", { name: "Oldingi yil" }).click();
ok("months before start disabled", await endDlg.getByRole("button", { name: /^Iyun/ }).isDisabled());
await endDlg.getByRole("button", { name: "Keyingi yil" }).click();
await endDlg.getByRole("button", { name: /^Fevral/ }).click();
ok("end picked", (await end.textContent()).includes("Fevral 2020"), await end.textContent());

// education years
await p.getByRole("button", { name: "Ta'lim qo'shish" }).click();
await p.getByLabel("O'quv yurti").fill("TATU");
const sy = p.getByRole("button", { name: "Boshlagan yili" });
await sy.click();
await p.waitForTimeout(200);
const yd = p.getByRole("dialog", { name: "Yilni tanlang" });
for (let i = 0; i < 5 && !(await yd.getByRole("button", { name: "2015", exact: true }).isVisible()); i++) await yd.getByRole("button", { name: "Oldingi yillar" }).click();
await yd.getByRole("button", { name: "2015", exact: true }).click();
ok("start year", (await sy.textContent()).trim() === "2015", await sy.textContent());
const ey = p.getByRole("button", { name: "Tugatgan yili" });
await ey.click();
await p.waitForTimeout(200);
ok("end year before start disabled", await yd.getByRole("button", { name: "2014", exact: true }).isDisabled().catch(() => true));
await yd.getByRole("button", { name: "2019", exact: true }).click();
await p.screenshot({ path: `${out}/pick-form-${kind}.png` });

// save and check what the API stored
const [resp] = await Promise.all([
  p.waitForResponse((r) => r.url().endsWith("/api/v1/resumes") && r.request().method() === "POST"),
  p.getByRole("button", { name: "Saqlash" }).click(),
]);
const body = await resp.json();
const e = body.data?.experiences?.[0];
ok("saved to API", resp.status() === 201 && e?.start === "2019-07" && e?.end === "2020-02" && body.data?.educations?.[0]?.start_year === 2015, `${resp.status()} ${e?.start}..${e?.end}`);

// Clean up so repeated runs don't hit the 5-resume limit.
if (body.data?.id) {
  const API = "http://localhost:8090/api/v1";
  const login = await (await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "seeker@demo.uz", password: "Secret123" }) })).json();
  await fetch(`${API}/resumes/${body.data.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${login.data.access_token}` } });
}

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
