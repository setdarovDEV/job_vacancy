import { groupDigits } from "~/shared/lib/format";

export type BarRow = { id: string | number; label: string; value: number; note?: string };

/**
 * Horizontal bars on one baseline in the accent hue: thin (10px), square at the
 * baseline, 4px rounded at the data end, the value at the end of its label row. Rows keep the given
 * order (ranked lists pass them largest first, the funnel passes stages in order).
 * Every value is printed, so there's nothing to gate behind a tooltip; the list is
 * real markup, so screen readers read it as is.
 */
export function RankedBars({ rows, label, max }: { rows: BarRow[]; label: string; max?: number }) {
  const top = Math.max(1, max ?? Math.max(0, ...rows.map((r) => r.value)));
  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.id} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-2">{r.label}</span>
            <span className="shrink-0">
              <span className="num font-semibold text-ink">{groupDigits(r.value)}</span>
              {r.note && <span className="num ml-1.5 text-xs text-ink-3">{r.note}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-r bg-sunken">
            <div
              className="h-full rounded-r bg-lapis transition-[width,opacity] duration-500 ease-[var(--ease-out-quint)] group-hover:opacity-85"
              style={{ width: `${(r.value / top) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
