import { apiError, type ApiError, type Schemas } from "~/shared/api/client";
import type { Locale } from "~/shared/i18n/config";

export type VacancyCard = Schemas["VacancyCard"];
/** The fields the company cards need (the directory entry also carries `about`, contacts…). */
export type CompanyTile = Pick<
  Schemas["Company"],
  "id" | "name" | "slug" | "logo_url" | "verified" | "industry_id" | "region_id" | "open_vacancies"
>;

type PageMeta = { total?: number; total_capped?: boolean; next_cursor?: string | null };

/** One home section's data: its payload, or the API error (null = the API was unreachable). */
export type Section<T> = { ok: true; data: T } | { ok: false; error: ApiError | null };

/** A count shown to people; `capped` renders as "N+". */
export type Count = { n: number; capped: boolean };

/**
 * Like soft(), but keeps the envelope's `meta` (totals) and tells a failure from an empty list,
 * so every home section can pick its own error / empty / hidden state independently.
 */
export async function settle<T>(req: Promise<unknown>): Promise<Section<{ items: T; meta: PageMeta }>> {
  try {
    const res = (await req) as { data?: { data?: T; meta?: PageMeta }; error?: unknown };
    if (res.data?.data !== undefined) return { ok: true, data: { items: res.data.data, meta: res.data.meta ?? {} } };
    return { ok: false, error: apiError(res) };
  } catch {
    return { ok: false, error: null };
  }
}

/** Newest vacancies fetched for the home page: enough to count the last 24 hours honestly. */
export const LATEST_WINDOW = 50;
const DAY = 24 * 60 * 60 * 1000;

/** Vacancies published in the last 24 hours among the newest page ("50+" when all of it is). */
export function lastDay(items: VacancyCard[], meta: PageMeta, now: number): Count {
  const n = items.filter((v) => v.published_at && now - Date.parse(v.published_at) < DAY).length;
  return { n, capped: n === items.length && Boolean(meta.next_cursor) };
}

/** Six cards for "fresh vacancies": up to three featured (TOP) first, then the newest. */
export function pickFresh(items: VacancyCard[]): VacancyCard[] {
  const top = items.filter((v) => v.is_featured).slice(0, 3);
  return [...top, ...items.filter((v) => !top.includes(v))].slice(0, 6);
}

/** Eight companies, verified first (the API's order), preferring those that are hiring now. */
export function pickCompanies(items: Schemas["Company"][]): CompanyTile[] {
  const hiring = items.filter((c) => (c.open_vacancies ?? 0) > 0);
  return (hiring.length >= 4 ? hiring : items).slice(0, 8).map((c) => ({
    id: c.id, name: c.name, slug: c.slug, logo_url: c.logo_url, verified: c.verified,
    industry_id: c.industry_id, region_id: c.region_id, open_vacancies: c.open_vacancies,
  }));
}

const cyrillic = /[Ѐ-ӿ]/;

/**
 * Popular searches in the page's script (Latin pages don't show Cyrillic queries and
 * vice versa), capitalized, topped up with curated examples so the row is never sparse.
 */
export function popularFor(popular: string[], locale: Locale, examples: string): string[] {
  const wantCyrillic = locale === "ru" || locale === "uz-Cyrl";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of [...popular, ...examples.split(",")]) {
    const v = q.trim();
    if (!v || cyrillic.test(v) !== wantCyrillic || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v[0].toUpperCase() + v.slice(1));
    if (out.length === 6) break;
  }
  return out;
}

// Same bot the API sends notifications from (TELEGRAM_BOT_USERNAME, default jobvacancy_uz_bot);
// the footer reads the same variable.
export const TELEGRAM_BOT: string = import.meta.env.VITE_TELEGRAM_BOT ?? "jobvacancy_uz_bot";
