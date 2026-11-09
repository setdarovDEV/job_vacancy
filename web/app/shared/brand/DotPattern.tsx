import { cn } from "../lib/cn";

const TILE = 22;
const DOT = 1.4;

/**
 * Dot-grid backdrop for hero sections. The grid itself is static; one CSS mask sweeps
 * across it once on load, so the "reveal" costs a single composited animation.
 */
export function DotPattern({
  className,
  reveal = true,
  focus = "ellipse 70% 65% at 50% 45%",
}: {
  className?: string;
  reveal?: boolean;
  /** Where the grid is densest; it fades out towards the edges. */
  focus?: string;
}) {
  const mask = `radial-gradient(${focus}, black 25%, transparent 72%)`;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <svg className={cn("absolute inset-0 size-full", reveal && "pattern-reveal")}>
        <defs>
          <pattern id="dot-grid" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <circle cx={TILE / 2} cy={TILE / 2} r={DOT} fill="var(--pattern)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>
    </div>
  );
}
