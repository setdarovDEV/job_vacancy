import { cn } from "../lib/cn";

/**
 * The mark is an eight-pointed star made of two rounded squares, with a round opening in
 * the middle — the star that anchors Central Asian girih tilework, reduced to its simplest
 * form so it survives at favicon size.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 text-lapis", className)}>
      <mask id="jv-mark-cut">
        <rect width="32" height="32" fill="white" />
        <circle cx="16" cy="16" r="4.25" fill="black" />
      </mask>
      <g mask="url(#jv-mark-cut)" fill="currentColor">
        <rect x="6.5" y="6.5" width="19" height="19" rx="3.5" />
        <rect x="6.5" y="6.5" width="19" height="19" rx="3.5" transform="rotate(45 16 16)" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="font-display text-lead font-semibold leading-none tracking-heading text-ink">
        Job Vacancy
      </span>
    </span>
  );
}
