import { cn } from "../lib/cn";

const tones = { lapis: "bg-lapis", firuza: "bg-firuza", zafaron: "bg-zafaron", anor: "bg-anor" } as const;
const sizes = { sm: "h-1.5", md: "h-2" } as const;

/**
 * Progress bar for uploads and profile completeness. `value` 0–100; leave it undefined while
 * the total is unknown (indeterminate stripe). The fill moves with transform only.
 */
export function Progress({ value, label, tone = "lapis", size = "md", showValue, className }: {
  value?: number;
  /** Accessible name; also shown above the bar with `showValue`. */
  label: string;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
  /** Shows the label and the percentage above the bar. */
  showValue?: boolean;
  className?: string;
}) {
  const known = typeof value === "number" && Number.isFinite(value);
  const pct = known ? Math.round(Math.min(100, Math.max(0, value))) : undefined;
  const bar = (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={pct === undefined ? undefined : `${pct}%`}
      className={cn("relative w-full overflow-hidden rounded-pill bg-line/70", sizes[size], !showValue && className)}
    >
      {pct === undefined ? (
        // Reduced motion freezes the sweep; a dim full bar still says "working".
        <div className={cn("h-full w-full origin-left rounded-pill anim-progress motion-reduce:animate-none motion-reduce:opacity-40", tones[tone])} />
      ) : (
        // A full-width fill slid left keeps its rounded end at every value (scaleX would squash it).
        <div
          className={cn("h-full w-full rounded-pill transition-transform duration-500 ease-out-quint", tones[tone])}
          style={{ transform: `translateX(${pct - 100}%)` }}
        />
      )}
    </div>
  );
  if (!showValue) return bar;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div aria-hidden="true" className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-ink-2">{label}</span>
        {pct !== undefined && <span className="num shrink-0 font-semibold text-ink">{pct}%</span>}
      </div>
      {bar}
    </div>
  );
}
