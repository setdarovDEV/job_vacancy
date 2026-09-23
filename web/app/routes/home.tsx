import { MapPin, Search } from "lucide-react";
import { useTranslation } from "~/shared/i18n/i18n";
import { Form } from "react-router";

import type { Route } from "./+types/home";
import { api, soft } from "~/shared/api/client";
import { GirihPattern } from "~/shared/brand/GirihPattern";
import { nameOf, useCatalog } from "~/shared/catalog/catalog";
import { localizedPath, type Locale } from "~/shared/i18n/config";
import { LocalizedLink, useLocale } from "~/shared/i18n/hooks";
import type { Messages } from "~/shared/i18n/messages/uz";
import { Button } from "~/shared/ui/Button";
import { Select } from "~/shared/ui/Select";

export async function loader() {
  return { popular: await soft<string[]>(api.GET("/search/popular") as never, []) };
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches[0]?.loaderData as { messages: Messages } | undefined;
  const m = root?.messages;
  return [
    { title: m ? `${m.brand.name}: ${m.hero.title}` : "Job Vacancy" },
    { name: "description", content: m?.hero.subtitle ?? "" },
  ];
}

const cyrillic = /[\u0400-\u04ff]/;

/**
 * Popular searches in the page's script (Latin pages don't show Cyrillic queries and
 * vice versa), capitalized, topped up with curated examples so the row is never sparse.
 */
function popularFor(popular: string[], locale: Locale, examples: string): string[] {
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const suggestions = popularFor(loaderData.popular, locale, t("search.examples"));
  const catalog = useCatalog();
  const regionOptions = catalog.regions.map((r) => ({ value: String(r.id), label: nameOf(r.name, locale) }));

  return (
    <section className="relative isolate overflow-hidden">
      <GirihPattern className="-z-10" focus="ellipse 55% 75% at 85% 30%" />
      <div className="container-page pb-20 pt-14 md:pb-28 md:pt-24">
        <h1 className="max-w-[16ch] text-balance font-display text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.035em] text-ink sm:text-4xl md:text-5xl">
          {t("hero.title")}
        </h1>
        <p className="mt-5 max-w-[38rem] text-lg text-ink-2">{t("hero.subtitle")}</p>

        <Form
          method="get"
          action={localizedPath(locale, "/vacancies")}
          role="search"
          className="mt-10 flex max-w-4xl flex-col gap-2 rounded-panel border border-line-strong bg-surface p-2 shadow-pop md:flex-row md:items-center md:gap-0"
        >
          <label className="flex flex-1 items-center gap-3 px-3">
            <Search className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
            <span className="sr-only">{t("search.what")}</span>
            <input
              name="q"
              type="search"
              autoComplete="off"
              placeholder={t("search.what")}
              className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          <div className="hidden h-8 w-px bg-line md:block" aria-hidden="true" />
          <div className="flex items-center gap-2 px-3 md:w-64">
            <MapPin className="size-5 shrink-0 text-ink-3" aria-hidden="true" />
            <Select
              name="region_id"
              aria-label={t("search.where")}
              options={regionOptions}
              placeholder={t("search.anywhere")}
              variant="bare"
              className="h-12 flex-1"
            />
          </div>
          <Button type="submit" size="lg" className="md:ml-1">
            {t("search.submit")}
          </Button>
        </Form>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-ink-3">{t("search.popular")}</span>
          {suggestions.map((q) => (
            <LocalizedLink
              key={q}
              to={`/vacancies?q=${encodeURIComponent(q)}`}
              className="inline-flex h-9 items-center rounded-full border border-line-strong bg-surface/70 px-3.5 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
            >
              {q}
            </LocalizedLink>
          ))}
        </div>
      </div>
    </section>
  );
}
