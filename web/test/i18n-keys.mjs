// Lists t("…") keys used in app/ that are missing from the uz messages (source locale),
// and checks every other locale has exactly the same keys. Run: node test/i18n-keys.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../app/", import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mts)$/.test(f) && !p.includes("/messages/")) files.push(p);
  }
})(root);

const load = async (l) => (await import(join(root, `shared/i18n/messages/${l}.ts`))).default;
const flat = (o, pre = "", out = new Set()) => {
  for (const [k, v] of Object.entries(o)) typeof v === "object" ? flat(v, pre + k + ".", out) : out.add(pre + k);
  return out;
};
const uz = flat(await load("uz"));
const has = (k) => uz.has(k) || [...uz].some((x) => x.startsWith(k + "_") || x.startsWith(k + "."));
const missing = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_.]+)(\$\{)?/g)) {
    const key = m[1].replace(/\.$/, "");
    if (m[2]) { if (![...uz].some((x) => x.startsWith(key))) missing.set(key + "*", f); continue; }
    if (!has(key)) missing.set(key, f.replace(root, ""));
  }
  for (const m of src.matchAll(/key: "([a-zA-Z0-9_.]+)"/g)) if (!has(m[1])) missing.set(m[1], f.replace(root, ""));
}
console.log(missing.size ? [...missing].map(([k, f]) => `${k}  (${f})`).join("\n") : "all keys present in uz");
for (const l of ["uz-Cyrl", "ru", "en"]) {
  const o = flat(await load(l));
  const extra = [...o].filter((k) => !uz.has(k) && !k.startsWith("time.")); // time: per-locale plural forms
  const lack = [...uz].filter((k) => !o.has(k));
  if (extra.length || lack.length) console.log(`${l}: missing ${lack.join(", ") || "-"}; extra ${extra.join(", ") || "-"}`);
}
