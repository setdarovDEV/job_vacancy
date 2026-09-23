import { cn } from "../lib/cn";

/** Placeholder block with a soft shimmer (static when reduced motion is on). */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "rounded-md bg-[linear-gradient(90deg,var(--sunken)_25%,var(--line)_50%,var(--sunken)_75%)] bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    />
  );
}
