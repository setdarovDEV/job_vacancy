// Chat between the demo seeker and employer: realtime delivery, typing, read ticks, image upload.
import { chromium } from "playwright-core";
const out = process.env.SHOTS ?? "/tmp";
const B = process.env.WEB ?? "http://localhost:5180";
const IMG = process.env.IMG;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const errors = [];
const results = [];
const ok = (name, cond, extra = "") => results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`);
async function signIn(email, next) {
  const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(`[${email}] ${m.text().slice(0, 300)}`); });
  p.on("pageerror", (e) => errors.push(`[${email} pageerror] ${e.message}`));
  await p.goto(`${B}/login?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await p.locator("input[type=email]").fill(email);
  await p.locator("input[type=password]").fill("Secret123");
  await p.getByRole("button", { name: "Kirish", exact: true }).last().click();
  await p.waitForURL((u) => u.pathname.startsWith(next));
  return p;
}
const s = await signIn("seeker@demo.uz", "/chat");
await s.locator("a[href^='/chat/']").first().click();
await s.waitForURL(/\/chat\/.+/);
const chatPath = new URL(s.url()).pathname;
const h = await signIn("hr@demo.uz", chatPath);
await h.getByPlaceholder("Xabar yozing…").waitFor();
await s.waitForTimeout(1000);

// typing indicator reaches the employer
await s.getByPlaceholder("Xabar yozing…").pressSequentially("Salom", { delay: 40 });
await h.getByText("yozmoqda…").waitFor({ timeout: 5000 }).then(() => ok("typing indicator", true)).catch(() => ok("typing indicator", false));
const text = "Ertaga soat 11:00 da suhbatga kela olaman " + Date.now() % 1000;
await s.getByPlaceholder("Xabar yozing…").fill(text);
await s.keyboard.press("Enter");
const t0 = Date.now();
await h.getByText(text).waitFor({ timeout: 5000 }).then(() => ok("message delivered live", true, `${Date.now() - t0} ms`)).catch(() => ok("message delivered live", false));
// read tick on the seeker's side once the employer has the thread open
await s.locator(`[aria-label="O'qildi"]`).last().waitFor({ timeout: 5000 }).then(() => ok("read receipt", true)).catch(() => ok("read receipt", false));
await h.getByPlaceholder("Xabar yozing…").fill("Ajoyib, kutamiz! Manzil: Chilonzor, 9-kvartal.");
await h.keyboard.press("Enter");
await s.getByText("Ajoyib, kutamiz!").waitFor({ timeout: 5000 }).then(() => ok("reply delivered live", true)).catch(() => ok("reply delivered live", false));

if (IMG) {
  const [chooser] = await Promise.all([s.waitForEvent("filechooser"), s.getByRole("button", { name: "Fayl yoki rasm" }).click()]);
  await chooser.setFiles(IMG);
  await h.locator("img[alt='Rasm']").last().waitFor({ timeout: 10000 }).then(() => ok("image upload + delivery", true)).catch(() => ok("image upload + delivery", false));
}
await s.waitForTimeout(800);
await s.screenshot({ path: `${out}/f-chat-seeker.png` });
await h.screenshot({ path: `${out}/f-chat-employer.png` });

const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await s.context().storageState() });
const mp = await m.newPage();
await mp.goto(B + chatPath, { waitUntil: "networkidle" });
await mp.getByPlaceholder("Xabar yozing…").waitFor();
await mp.waitForTimeout(1500);
await mp.screenshot({ path: `${out}/f-chat-mobile.png` });

console.log(results.join("\n"));
console.log(errors.length ? "ERRORS:\n" + [...new Set(errors)].join("\n") : "no console errors");
await browser.close();
