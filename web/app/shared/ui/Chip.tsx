import { Check } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

/**
 * Toggleable filter chip (aria-pressed when `selected` is given). The check mark grows in with a
 * spring when selected; only transform/opacity animate. 36px tall, 44px hit area on touch.
 */
export function Chip({
  selected, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative inline-flex h-9 select-none items-center whitespace-nowrap rounded-pill border px-3 text-sm font-medium",
        "transition-[background-color,border-color,color,scale] duration-150 ease-spring active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.25",
        selected
          ? "border-lapis bg-lapis-soft text-lapis-ink"
          : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid place-items-center",
          // Spring in on select; leave instantly (its box collapses at once, so a fade would overlap the label).
          selected ? "-ml-0.5 mr-1.5 scale-100 opacity-100 transition-[opacity,scale] duration-200 ease-spring" : "w-0 scale-50 opacity-0",
        )}
      >
        <Check className="size-4 shrink-0" strokeWidth={2.5} />
      </span>
      {children}
    </button>
  );
}
