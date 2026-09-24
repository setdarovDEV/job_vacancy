import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { Skeleton } from "./Skeleton";

export type DataTableSort = { key: string; dir: "asc" | "desc" };

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "start" | "end";
  /** Applied to the header and body cells (widths, nowrap…). */
  className?: string;
};

/**
 * Tabular data (candidates, sessions, moderation). From md up: a real <table> on a solid card,
 * sticky header under the site header, sortable columns with aria-sort. Below md every row is
 * a card: `mobileCard(row)` or an automatic label/value list. Cells wrap instead of scrolling
 * sideways, so the page never gets a horizontal scrollbar.
 */
export function DataTable<T>({
  rows, rowKey, columns, sort, onSortChange, caption, mobileCard, loading, empty, className,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: DataTableColumn<T>[];
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  /** Accessible name of the table (visually hidden). */
  caption?: string;
  mobileCard?: (row: T) => ReactNode;
  /** No rows yet → skeleton rows; rows present → dimmed while refetching. */
  loading?: boolean;
  /** Shown instead of the table when there are no rows (usually an EmptyState). */
  empty?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const initial = loading && rows.length === 0;
  if (!initial && rows.length === 0 && empty) return <div className={cn("surface-card", className)}>{empty}</div>;

  const align = (c: DataTableColumn<T>) => (c.align === "end" ? "text-end" : "text-start");

  const header = (c: DataTableColumn<T>) => {
    const active = sort?.key === c.key;
    if (!c.sortable || !onSortChange) return c.header;
    const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
    return (
      <button
        type="button"
        onClick={() => onSortChange({ key: c.key, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        className={cn(
          "-mx-2 inline-flex min-h-9 items-center gap-1 rounded-control px-2 font-medium transition-colors duration-150 hover:bg-sunken hover:text-ink",
          active && "text-ink",
          c.align === "end" && "flex-row-reverse",
        )}
      >
        {c.header}
        <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", !active && "opacity-60")} />
      </button>
    );
  };

  const ariaSort = (c: DataTableColumn<T>) => {
    if (!c.sortable || !onSortChange) return undefined;
    if (sort?.key !== c.key) return "none" as const;
    return sort.dir === "asc" ? ("ascending" as const) : ("descending" as const);
  };

  return (
    <div className={cn("min-w-0", className)} aria-busy={loading || undefined}>
      {/* md+: table. overflow-clip (not auto) keeps the rounded corners without creating a
          scroll container, so the header can stick to the page scroll. */}
      <div className="surface-card hidden overflow-clip md:block">
        <table className={cn("w-full border-separate border-spacing-0 text-md transition-opacity duration-200", loading && !initial && "opacity-60")}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort(c)}
                  className={cn(
                    "sticky top-16 z-10 border-b border-line bg-raised px-4 py-2.5 align-middle text-sm font-medium text-ink-2 first:pl-5 last:pr-5",
                    align(c),
                    c.className,
                  )}
                >
                  {header(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initial
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} aria-hidden="true">
                    {columns.map((c) => (
                      <td key={c.key} className="border-b border-line px-4 py-4 first:pl-5 last:pr-5 [tr:last-child>&]:border-b-0">
                        <Skeleton className={cn("h-4", c.align === "end" ? "ml-auto w-16" : "w-3/4")} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={rowKey(r)} className="transition-colors duration-150 hover:bg-sunken/60">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "border-b border-line px-4 py-3 align-middle text-ink wrap-anywhere first:pl-5 last:pr-5 [tr:last-child>&]:border-b-0",
                          align(c),
                          c.className,
                        )}
                      >
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Below md: one card per row. */}
      {initial ? (
        <div role="status" className="flex flex-col gap-3 md:hidden">
          <span className="sr-only">{t("common.loading")}</span>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} aria-hidden="true" className="surface-card flex flex-col gap-3 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <ul aria-label={caption} className={cn("flex flex-col gap-3 transition-opacity duration-200 md:hidden", loading && "opacity-60")}>
          {rows.map((r) => (
            <li key={rowKey(r)} className="surface-card min-w-0 break-words p-4">
              {mobileCard ? mobileCard(r) : (
                <dl className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-md">
                  {columns.map((c) =>
                    c.header ? (
                      <div key={c.key} className="contents">
                        <dt className="text-sm text-ink-2">{c.header}</dt>
                        <dd className="min-w-0 text-ink wrap-anywhere">{c.cell(r)}</dd>
                      </div>
                    ) : (
                      // Header-less columns (row actions) span the full card width.
                      <div key={c.key} className="col-span-2 min-w-0">{c.cell(r)}</div>
                    ),
                  )}
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
