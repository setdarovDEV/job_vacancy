// URL ⇄ API query mapping for /vacancies. The URL is the single source of truth for
// filters, so every state is linkable, shareable and restored by the back button.

export const MULTI = ["work_format", "employment_type", "experience", "schedule"] as const;
export const SINGLE = ["q", "category_id", "region_id", "district_id", "company_id", "salary_from", "with_salary", "sort"] as const;
export type FilterKey = (typeof MULTI)[number] | (typeof SINGLE)[number];

const isMulti = (k: string) => (MULTI as readonly string[]).includes(k);

/** Clean values for the API: no empty strings, no "all", comma lists for multi-value keys. */
export function apiQuery(sp: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of [...SINGLE, ...MULTI]) {
    const vals = sp
      .getAll(k)
      .flatMap((v) => (isMulti(k) ? v.split(",") : [v]))
      .map((v) => v.trim())
      .filter((v) => v && v !== "all");
    if (vals.length) out[k] = isMulti(k) ? [...new Set(vals)].join(",") : vals[0];
  }
  if (out.with_salary && out.with_salary !== "true") delete out.with_salary;
  return out;
}

/** Canonical URL search string (sorted keys) — also the saved-search `params`. */
export function canonicalSearch(q: Record<string, string>, omit: string[] = []): string {
  const sp = new URLSearchParams();
  for (const k of Object.keys(q).sort()) if (!omit.includes(k)) sp.set(k, q[k]);
  return sp.toString();
}

export function multiValues(q: Record<string, string>, k: string): string[] {
  return q[k] ? q[k].split(",") : [];
}

export function withValue(q: Record<string, string>, k: string, v: string | null): Record<string, string> {
  const next = { ...q };
  if (v == null || v === "") delete next[k];
  else next[k] = v;
  if (k === "region_id") delete next.district_id;
  return next;
}

export function toggleMulti(q: Record<string, string>, k: string, v: string): Record<string, string> {
  const cur = multiValues(q, k);
  const vals = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
  return withValue(q, k, vals.join(","));
}

/** Number of active filters, for the mobile "Filters (3)" button. q and sort don't count. */
export function activeCount(q: Record<string, string>): number {
  let n = 0;
  for (const k of Object.keys(q)) {
    if (k === "q" || k === "sort" || k === "district_id") continue;
    n += isMulti(k) ? multiValues(q, k).length : 1;
  }
  return n;
}
