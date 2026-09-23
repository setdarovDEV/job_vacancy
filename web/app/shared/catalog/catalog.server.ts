import { api } from "../api/client";
import type { Catalog } from "./catalog";

// Categories and regions change rarely; keep one copy per server process for 5 minutes
// instead of asking the API on every page render.
let cached: { at: number; value: Catalog } | null = null;
const TTL = 5 * 60_000;

export async function getCatalog(): Promise<Catalog> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  try {
    const [c, r] = await Promise.all([api.GET("/catalog/categories"), api.GET("/catalog/regions")]);
    const value = { categories: c.data?.data ?? [], regions: r.data?.data ?? [] } as Catalog;
    if (value.categories.length && value.regions.length) cached = { at: Date.now(), value };
    return value;
  } catch {
    return cached?.value ?? { categories: [], regions: [] };
  }
}
