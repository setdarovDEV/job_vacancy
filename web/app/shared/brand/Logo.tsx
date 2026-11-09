import { cn } from "../lib/cn";

/**
 * The mark is a briefcase: a rounded body with a handle on top and a seam cut across the
 * middle. Solid shapes only, so it survives at favicon size.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 text-lapis", className)}>
      <mask id="jv-mark-cut">
        <rect width="32" height="32" fill="white" />
        <rect x="4" y="16" width="24" height="2.25" fill="black" />
        <rect x="13.5" y="14.5" width="5" height="5.25" rx="1.25" fill="black" />
      </mask>
      <g fill="currentColor">
        <path d="M11.5 10V8.5a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3V10h-2.5V8.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V10z" />
        <rect x="4" y="10" width="24" height="17" rx="4" mask="url(#jv-mark-cut)" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-7" />
      <span className="font-display text-[1.0625rem] font-semibold leading-none tracking-[-0.02em] text-ink">
        Job Vacancy
      </span>
    </span>
  );
}
