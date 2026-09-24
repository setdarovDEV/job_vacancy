// URL ⇄ API query mapping for /vacancies. The URL is the single source of truth for
// filters, so every state is linkable, shareable and restored by the back button.

export const MULTI = ["work_format", "employment_type", "experience", "schedule"] as const;
export const SINGLE = ["q", "category_id", "region_id", "district_id", "company_id", "salary_from", "with_salary", "sort"] as const;
export type FilterKey = (typeof MULTI)[number] | (typeof SINGLE)[number];
export type Query = Record<string, string>;

const isMulti = (k: string) => (MULTI as readonly string[]).includes(k);

/** Clean values for the API: no empty strings, no "all", comma lists for multi-value keys. */
export function apiQuery(sp: URLSearchParams): Query {
  const out: Query = {};
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
export function canonicalSearch(q: Query, omit: string[] = []): string {
  const sp = new URLSearchParams();
  for (const k of Object.keys(q).sort()) if (!omit.includes(k)) sp.set(k, q[k]);
  return sp.toString();
}

export function multiValues(q: Query, k: string): string[] {
  return q[k] ? q[k].split(",") : [];
}

export function withValue(q: Query, k: string, v: string | null): Query {
  const next = { ...q };
  if (v == null || v === "") delete next[k];
  else next[k] = v;
  if (k === "region_id") delete next.district_id;
  return next;
}

export function toggleMulti(q: Query, k: string, v: string): Query {
  const cur = multiValues(q, k);
  const vals = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
  return withValue(q, k, vals.join(","));
}

/** Number of active filters, for the mobile "Filters (3)" button. q and sort don't count. */
export function activeCount(q: Query): number {
  let n = 0;
  for (const k of Object.keys(q)) {
    if (k === "q" || k === "sort" || k === "district_id") continue;
    n += isMulti(k) ? multiValues(q, k).length : 1;
  }
  return n;
}

/** One removable unit of the filter state: a single key, or one value of a multi-value key. */
export type Applied = { key: FilterKey; value: string };

// Chip order: where and what first, then money, then the enum facets.
const CHIP_ORDER = ["category_id", "region_id", "district_id", "company_id", "salary_from", "with_salary"] as const;

/** Every applied filter (q and sort excluded), for the chip row and the empty-state suggestions. */
export function appliedFilters(q: Query): Applied[] {
  const out: Applied[] = [];
  for (const k of CHIP_ORDER) if (q[k]) out.push({ key: k, value: q[k] });
  for (const k of MULTI) for (const v of multiValues(q, k)) out.push({ key: k, value: v });
  return out;
}

export function hasFilter(q: Query, a: Applied): boolean {
  return isMulti(a.key) ? multiValues(q, a.key).includes(a.value) : q[a.key] === a.value;
}

export function addFilter(q: Query, a: Applied): Query {
  if (hasFilter(q, a)) return q;
  return isMulti(a.key) ? toggleMulti(q, a.key, a.value) : withValue(q, a.key, a.value);
}

export function removeFilter(q: Query, a: Applied): Query {
  return isMulti(a.key) ? toggleMulti(q, a.key, a.value) : withValue(q, a.key, null);
}

/** "Clear all": drops every filter and the sort, keeps the search words. */
export function clearFilters(q: Query): Query {
  return q.q ? { q: q.q } : {};
}

/** One-tap filters people use most, offered as chips on phones (the full set is in the sheet). */
export const QUICK: readonly Applied[] = (
  [["work_format", "remote"], ["experience", "none"], ["with_salary", "true"], ["employment_type", "part_time"], ["schedule", "flexible"]] as const
).map(([k, value]) => ({ key: k, value }));
