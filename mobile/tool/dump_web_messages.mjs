// Dumps the web app's message modules to JSON for tool/gen_l10n_from_web.py.
const dir = new URL("../../web/app/shared/i18n/messages", import.meta.url).pathname, out = process.argv[2];
import { writeFileSync } from "node:fs";
for (const l of ["uz", "uz-Cyrl", "ru", "en"]) {
  const m = (await import(`${dir}/${l}.ts`)).default;
  writeFileSync(`${out}/${l}.json`, JSON.stringify(m, null, 1));
}
