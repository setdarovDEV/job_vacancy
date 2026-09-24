import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";

/**
 * Placeholder block with a soft shimmer (static when reduced motion is on). Pill-shaped by
 * default; pass `rounded-control` / `rounded-panel` for tiles and blocks. Shape it exactly like
 * the content it stands in for, so nothing moves when data arrives.
 */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cn("skeleton", className)} />;
}

// Ragged right edge reads as text; the last line is always the shortest.
const lineWidths = ["100%", "94%", "86%", "97%", "78%"];

/** A paragraph of `lines` text lines (text-md rhythm). */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5 py-1", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-3.5" style={{ width: i === lines - 1 && lines > 1 ? "62%" : lineWidths[i % lineWidths.length] }} />
      ))}
    </div>
  );
}

/**
 * List rows while a list loads: separate surface cards (default) or rows divided inside one
 * card (`divided`), each with an optional avatar tile — the shape of VacancyCard-like rows.
 */
export function SkeletonRows({
  count = 3, avatar = true, divided, className,
}: { count?: number; avatar?: boolean; divided?: boolean; className?: string }) {
  const { t } = useTranslation();
  const rows = Array.from({ length: count }, (_, i) => (
    <div key={i} className={cn("flex gap-4 p-5 md:p-6", !divided && "surface-card")}>
      {avatar && <Skeleton className="size-14 shrink-0 rounded-control" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  ));
  return (
    <div role="status" aria-busy="true" className={cn(divided && "surface-card overflow-hidden", className)}>
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className={divided ? "divide-y divide-line" : "flex flex-col gap-3"}>{rows}</div>
    </div>
  );
}

/**
 * Holds loading UI back for 150 ms and then fades it in, so fast responses never flash a
 * skeleton. Pure CSS (anim-delayed). Pair it with useSkeletonHold so that, once visible, it also
 * stays long enough to read as a state rather than a flicker.
 */
export function SkeletonDelay({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("anim-delayed", className)}>{children}</div>;
}

const SHOW_AFTER = 150; // SkeletonDelay's CSS delay (anim-delayed)
const MIN_VISIBLE = 300;

/**
 * Loading-state timing: a skeleton that became visible (150 ms into the wait) stays at least
 * 300 ms, so an answer at 170 ms doesn't flash it for a frame; one that never showed goes at once.
 * Returns whether to keep rendering the loading UI:
 *   const loading = useSkeletonHold(q.isPending);
 *   if (loading) return <SkeletonDelay><SkeletonRows /></SkeletonDelay>;
 */
export function useSkeletonHold(pending: boolean): boolean {
  const since = useRef<number | null>(null);
  const [held, setHeld] = useState(pending);
  // Layout effect: the verdict lands before paint, so data never shows for a frame and then
  // flips back to the skeleton.
  useLayoutEffect(() => {
    if (pending) {
      since.current ??= performance.now();
      setHeld(true);
      return;
    }
    const start = since.current;
    since.current = null;
    const visible = start == null ? -1 : performance.now() - start - SHOW_AFTER;
    if (visible < 0 || visible >= MIN_VISIBLE) {
      setHeld(false);
      return;
    }
    const timer = setTimeout(() => setHeld(false), MIN_VISIBLE - visible);
    return () => clearTimeout(timer);
  }, [pending]);
  return pending || held;
}
