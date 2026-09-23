import type { Schemas } from "../api/client";
import type { Locale } from "../i18n/config";
import { useRouteLoaderData } from "react-router";

export type Names = Schemas["Names"];
export type Category = Schemas["Category"];
export type Region = Schemas["Region"];
export type Catalog = { categories: Category[]; regions: Region[] };

export const nameOf = (n: Names | undefined, locale: Locale) => (n ? n[locale] || n.uz : "");

export function useCatalog(): Catalog {
  return (useRouteLoaderData("root") as { catalog?: Catalog } | undefined)?.catalog ?? { categories: [], regions: [] };
}

/** Lookup helpers built once per catalog. */
export function indexCatalog(c: Catalog) {
  const regions = new Map<number, Region>();
  for (const r of c.regions) {
    regions.set(r.id, r);
    for (const d of r.children ?? []) regions.set(d.id, d);
  }
  const categories = new Map<number, Category>();
  for (const cat of c.categories) {
    categories.set(cat.id, cat);
    for (const ch of cat.children ?? []) categories.set(ch.id, ch);
  }
  return { regions, categories };
}
