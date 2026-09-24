#!/usr/bin/env node
// Samarkand Glass guard for jobvacancy.uz web code.
//
// Hook mode (PostToolUse on Edit|Write|MultiEdit): reads the hook JSON from stdin, checks the edited
// file if it lives under web/app, and exits 2 with the violations on stderr so Claude fixes them.
//   JV_UI_CHECK=warn  → report as context only (never blocks)      JV_UI_CHECK=off → disabled
// Scan mode: node check-ui.mjs --scan web/app [more paths]  → report, exit 1 if violations.

import fs from "node:fs";
import path from "node:path";

const RULES = [
  { id: "raw-color", re: /(?<![\w-])(?:bg|text|border|fill|stroke|ring|outline|decoration|from|via|to|shadow|caret|accent|divide|placeholder)(?:-[a-z]+)?-\[(?:#|rgb|hsl|oklch|oklab|lab\()/,
    msg: "arbitrary color value — use a semantic token (bg-surface, text-ink-2, …) or add one to app.css" },
  { id: "hex", re: /(?<![&\w])#[0-9a-fA-F]{3,8}\b(?![\w-])/, skipIf: /theme-color|href=|to=|id=|#main|url\(#/,
    msg: "hex color in component code — use tokens (currentColor / var(--token) in SVG)" },
  { id: "color-mix-raw", re: /color-mix\([^)]*(?:#|rgb\(|hsl\()/, msg: "color-mix with raw colors — mix tokens only (var(--…))" },
  { id: "white-black", re: /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|fill|stroke|ring|from|via|to)-(?:white|black)(?:\/\d+)?(?![\w-])/,
    msg: "text/bg-white|black — use on-lapis / on-anor / on-scrim / surface / scrim tokens" },
  { id: "dark-variant", re: /(?:^|[\s"'`{(])dark:[\w[]/, msg: "`dark:` variant — themes live in app.css via light-dark() tokens" },
  { id: "font-size", re: /(?<![\w-])(?:[a-z-]+:)*text-\[\d/, msg: "arbitrary font size — use text-2xs|xs|sm|md|base|lead|lg|xl|2xl…5xl" },
  { id: "tracking", re: /(?<![\w-])tracking-\[/, msg: "arbitrary letter-spacing — use tracking-display|heading|snug|caps" },
  { id: "radius", re: /(?<![\w-])(?:[a-z-]+:)*rounded(?:-[trblse]{1,2})?-(?:sm|md|lg|xl|2xl|3xl|\[(?!inherit))/,
    msg: "off-system radius — use rounded-control|panel|sheet|pill|full" },
  { id: "shadow", re: /(?<![\w-])(?:[a-z-]+:)*shadow-(?:sm|md|lg|xl|2xl|\[)/, msg: "off-system shadow — use shadow-1|2|3|4|ring|pop" },
  { id: "raw-blur", re: /(?<![\w-])(?:[a-z-]+:)*backdrop-(?:blur|saturate)/, msg: "raw backdrop blur — use glass-bar|chrome|panel|sheet utilities" },
];
const WARN_RULES = [
  { id: "outline-none", re: /(?<![\w-])outline-none/, okIf: /focus-visible:|focus-within:|field-shell|focus:shadow|focus:ring|peer/,
    msg: "outline-none without a visible replacement on this element — make sure a parent shows focus (field-shell / focus-within:shadow-ring)" },
  { id: "hover-only", re: /opacity-0[^"'`]*group-hover:opacity-100/, okIf: /focus-visible:opacity-100|group-focus-within:opacity-100/,
    msg: "hover-only affordance — also reveal on focus (group-focus-within:opacity-100) and provide a touch path" },
];

const CODE_EXT = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs"]);
const isWebApp = (f) => /(?:^|[\\/])web[\\/]app[\\/]/.test(f);
const skipFile = (f) => /[\\/](?:i18n[\\/]messages|test)[\\/]|\.server\.ts$|schema\.d\.ts$/.test(f);

function checkCode(file, text) {
  const errors = [], warnings = [];
  const lines = text.split("\n");
  let inBlock = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlock) { if (t.includes("*/")) inBlock = false; return; }
    if (t.startsWith("/*")) { if (!t.includes("*/")) inBlock = true; return; }
    if (t.startsWith("//") || t.startsWith("*")) return;
    if (/jv-ui-ignore/.test(line)) return;
    for (const r of RULES) {
      if (r.skipIf && r.skipIf.test(line)) continue;
      const m = line.match(r.re);
      if (m) errors.push(`${file}:${i + 1}  [${r.id}] ${r.msg}\n      → ${t.slice(0, 160)}`);
    }
    for (const r of WARN_RULES) {
      if (r.re.test(line) && !(r.okIf && r.okIf.test(line))) warnings.push(`${file}:${i + 1}  [${r.id}] ${r.msg}`);
    }
  });
  return { errors, warnings };
}

// app.css: every light-dark() token in :root must also exist in the @supports fallback block.
function checkTokens(file, text) {
  const errors = [];
  const rootStart = text.indexOf(":root {");
  const rootEnd = text.indexOf("\n}", rootStart);
  const fbStart = text.indexOf("@supports not (color: light-dark(");
  if (rootStart < 0 || fbStart < 0) return { errors, warnings: [] };
  const fbEnd = text.indexOf("\n}", fbStart);
  const ld = new Set([...text.slice(rootStart, rootEnd).matchAll(/(--[\w-]+):\s*light-dark\(/g)].map((m) => m[1]));
  const fb = new Set([...text.slice(fbStart, fbEnd).matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
  const missing = [...ld].filter((k) => !fb.has(k));
  if (missing.length) errors.push(`${file}  [token-fallback] light-dark() tokens missing from the @supports fallback block: ${missing.join(", ")}`);
  const themeInline = text.slice(text.indexOf("@theme inline"), text.indexOf("}", text.indexOf("@theme inline")));
  const colorish = [...ld].filter((k) => !/^--(glass|aurora|shadow|skeleton|pattern)/.test(k));
  const unmapped = colorish.filter((k) => !themeInline.includes(`var(${k})`));
  if (unmapped.length) errors.push(`${file}  [token-theme] tokens not exposed in @theme inline (no utility class): ${unmapped.join(", ")}`);
  return { errors, warnings: [] };
}

function checkFile(file) {
  if (!fs.existsSync(file) || !isWebApp(path.resolve(file)) || skipFile(file)) return { errors: [], warnings: [] };
  const ext = path.extname(file);
  const text = fs.readFileSync(file, "utf8");
  if (ext === ".css") return /[\\/]styles[\\/]app\.css$/.test(file) ? checkTokens(file, text) : checkCode(file, text);
  if (CODE_EXT.has(ext)) return checkCode(file, text);
  return { errors: [], warnings: [] };
}

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const st = fs.statSync(p);
  if (st.isFile()) out.push(p);
  else for (const e of fs.readdirSync(p)) if (!["node_modules", "build", ".react-router"].includes(e)) walk(path.join(p, e), out);
  return out;
}

const args = process.argv.slice(2);
if (args[0] === "--scan") {
  const files = args.slice(1).flatMap((p) => walk(p));
  let errs = 0, warns = 0; const byRule = {};
  for (const f of files) {
    const { errors, warnings } = checkFile(f);
    for (const e of errors) { const id = e.match(/\[([\w-]+)\]/)?.[1]; byRule[id] = (byRule[id] || 0) + 1; }
    for (const w of warnings) { const id = w.match(/\[([\w-]+)\]/)?.[1]; byRule[id + " (warn)"] = (byRule[id + " (warn)"] || 0) + 1; }
    if (errors.length || warnings.length) console.log([...errors, ...warnings.map((w) => "  warn " + w)].join("\n"));
    errs += errors.length; warns += warnings.length;
  }
  console.log(`\n${files.length} files · ${errs} violations · ${warns} warnings`);
  console.log(Object.entries(byRule).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join("\n"));
  process.exit(errs ? 1 : 0);
}

// Hook mode
const mode = (process.env.JV_UI_CHECK || "block").toLowerCase();
if (mode === "off") process.exit(0);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let file;
  try { file = JSON.parse(input)?.tool_input?.file_path; } catch { process.exit(0); }
  if (!file) process.exit(0);
  const { errors, warnings } = checkFile(file);
  if (!errors.length && !warnings.length) process.exit(0);
  const report = [
    "Samarkand Glass check (jobvacancy plugin) found issues in " + path.basename(file) + ":",
    ...errors, ...warnings.map((w) => "warn " + w),
    "Fix them per skills/premium-ui (tokens, glass rules). Add `jv-ui-ignore` on a line only for a justified exception.",
  ].join("\n");
  if (errors.length && mode === "block") { process.stderr.write(report + "\n"); process.exit(2); }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: report } }));
  process.exit(0);
});
