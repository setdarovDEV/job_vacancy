import { ChevronRight } from "lucide-react";
import { useLocation } from "react-router";

import { localizedPath } from "../i18n/config";
import { LocalizedLink, useLocale } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { SITE } from "../seo/seo";

export type BreadcrumbItem = { label: string; to?: string };

/**
 * Trail for detail pages ("Vakansiyalar › IT › Frontend dasturchi"). `to` is an app path
 * ("/vacancies"), localized here. The last item is the current page. Also emits BreadcrumbList
 * JSON-LD with absolute URLs built from SITE — the same origin seo() uses for canonical links,
 * so structured data and canonicals always agree.
 */
export function Breadcrumbs({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { pathname } = useLocation();
  if (!items.length) return null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      item: SITE + (it.to ? localizedPath(locale, it.to) : pathname),
    })),
  };

  return (
    <nav aria-label={t("states.breadcrumbs")} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm text-ink-2">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li
              key={`${i}-${it.label}`}
              // Phones keep only "parent › current"; wider screens show the whole trail, every
              // crumb shrinking (truncated) in proportion so nothing overflows.
              className={cn("flex min-w-0 items-center gap-1", last && "grow", i < items.length - 2 && "max-sm:hidden")}
            >
              {last || !it.to ? (
                <span
                  aria-current={last ? "page" : undefined}
                  title={it.label}
                  className={cn("block min-w-0 truncate", last ? "font-medium text-ink" : "max-w-40 sm:max-w-56")}
                >
                  {it.label}
                </span>
              ) : (
                <LocalizedLink
                  to={it.to}
                  prefetch="intent"
                  title={it.label}
                  // Earlier crumbs cap their width so the current page keeps most of the row.
                  className="inline-flex min-h-8 min-w-0 max-w-40 items-center rounded-pill transition-colors duration-150 hover:text-ink pointer-coarse:min-h-11 sm:max-w-56"
                >
                  <span className="truncate">{it.label}</span>
                </LocalizedLink>
              )}
              {!last && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" />}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        // "<" escaped so a title containing "</script>" can't break out of the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />
    </nav>
  );
}
