import { cn } from "../lib/cn";

// {8/3} star polygon: join every third vertex of an octagon in one continuous stroke.
function octagram(cx: number, cy: number, r: number): string {
  const order = [0, 3, 6, 1, 4, 7, 2, 5];
  return (
    order
      .map((k, i) => {
        const a = (Math.PI / 4) * k - Math.PI / 8;
        return `${i ? "L" : "M"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

const TILE = 72;
const path = [
  octagram(TILE / 2, TILE / 2, 22),
  // quarter stars at the corners interlock with the neighbouring tiles
  octagram(0, 0, 13), octagram(TILE, 0, 13), octagram(0, TILE, 13), octagram(TILE, TILE, 13),
].join(" ");

/**
 * Tilework backdrop for the hero. The pattern itself is static; one CSS mask sweeps
 * across it once on load, so the "reveal" costs a single composited animation.
 */
export function GirihPattern({
  className,
  reveal = true,
  focus = "ellipse 70% 65% at 50% 45%",
}: {
  className?: string;
  reveal?: boolean;
  /** Where the pattern is densest; it fades out towards the edges. */
  focus?: string;
}) {
  const mask = `radial-gradient(${focus}, black 25%, transparent 72%)`;
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <svg className={cn("absolute inset-0 size-full", reveal && "girih-reveal")}>
        <defs>
          <pattern id="girih" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            <path d={path} fill="none" stroke="var(--pattern)" strokeWidth="1.25" strokeLinejoin="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#girih)" />
      </svg>
    </div>
  );
}
