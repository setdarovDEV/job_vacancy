import { ChevronLeft, ChevronRight, Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { LocalizedLink } from "../i18n/hooks";
import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";

/** 1 … 4 5 6 … 20: first, last, and the current page with one neighbour each side. */
export function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  // Near an edge show 5 numbers in a row so the bar keeps the same width everywhere.
  const from = Math.max(2, Math.min(page - 1, pageCount - 4));
  const to = Math.min(pageCount - 1, Math.max(page + 1, 5));
  // A gap that would hide a single page shows that page instead.
  if (from > 2) out.push(from === 3 ? 2 : "gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pageCount - 1) out.push(to === pageCount - 2 ? pageCount - 1 : "gap");
  out.push(pageCount);
  return out;
}

// Proportional digits: every slot is at least min-w-10 wide already, and Onest's tabular "1"
// carries side bearing that makes "12" read as "1 2".
const item =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-pill px-3 text-md font-medium transition-[background-color,color,scale] duration-150 pointer-coarse:h-11 pointer-coarse:min-w-11";

/** A link for an href from `hrefFor`: "?page=3" keeps the current path; "/path?page=3" is an app path. */
function PageLink({ href, className, children, ...props }: {
  href: string; className?: string; children: ReactNode; "aria-current"?: "page"; "aria-label"?: string; rel?: string;
}) {
  if (href.startsWith("/")) return <LocalizedLink to={href} prefetch="intent" className={className} {...props}>{children}</LocalizedLink>;
  return <Link to={href} prefetch="intent" className={className} {...props}>{children}</Link>;
}

/**
 * Numbered pagination for crawlable lists (/companies). Real links, so it works without JS
 * and search engines follow it. `hrefFor(page)` returns either a query string ("?page=3",
 * resolved against the current URL) or an app path ("/companies?page=3", localized here).
 * Phones show "‹ 3 / 12 ›"; from sm up the full numbered bar.
 */
export function Pagination({ page, pageCount, hrefFor, label, className }: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  /** Accessible name of the nav; defaults to t("states.pagination"). */
  label?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);

  const edge = (dir: "prev" | "next") => {
    const target = dir === "prev" ? current - 1 : current + 1;
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    const text = <span className="sr-only sm:not-sr-only">{t(`states.${dir}`)}</span>;
    const inner = dir === "prev" ? <><Icon aria-hidden="true" className="size-4.5" />{text}</> : <>{text}<Icon aria-hidden="true" className="size-4.5" /></>;
    const cls = cn(item, "text-ink-2", dir === "prev" ? "sm:pl-2" : "sm:pr-2");
    if (target < 1 || target > pageCount) {
      // Links can't be disabled; a plain span keeps the layout and says why it's inert.
      return <span aria-disabled="true" className={cn(cls, "opacity-40")}>{inner}</span>;
    }
    return (
      <PageLink href={hrefFor(target)} rel={dir} className={cn(cls, "hover:bg-sunken hover:text-ink active:scale-[0.97]")}>
        {inner}
      </PageLink>
    );
  };

  return (
    <nav aria-label={label ?? t("states.pagination")} className={cn("flex items-center justify-center gap-1", className)}>
      {edge("prev")}
      {/* Proportional digits: Onest's tabular "1" would open a gap in "12". */}
      <p className="num px-3 text-md text-ink-2 sm:hidden">
        <span aria-hidden="true"><span className="font-semibold text-ink">{current}</span> / {pageCount}</span>
        <span className="sr-only">{t("states.pageOf", { page: current, total: pageCount })}</span>
      </p>
      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(current, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="grid size-10 place-items-center text-ink-3">
              <Ellipsis className="size-4" />
            </li>
          ) : (
            <li key={p}>
              <PageLink
                href={hrefFor(p)}
                aria-current={p === current ? "page" : undefined}
                aria-label={t("states.page", { page: p })}
                className={cn(
                  item,
                  "num",
                  p === current
                    ? "bg-lapis text-on-lapis shadow-1"
                    : "text-ink-2 hover:bg-sunken hover:text-ink active:scale-[0.97]",
                )}
              >
                {p}
              </PageLink>
            </li>
          ),
        )}
      </ul>
      {edge("next")}
    </nav>
  );
}
