import { Check } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

/** Toggleable filter chip (aria-pressed). The check mark slides in when selected. */
export function Chip({
  selected, className, children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color] duration-150",
        selected
          ? "border-transparent bg-lapis-soft text-lapis-ink"
          : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "grid overflow-hidden transition-[width,margin,opacity] duration-200 ease-[var(--ease-out-quint)]",
          selected ? "mr-1.5 w-4 opacity-100" : "w-0 opacity-0",
        )}
        aria-hidden="true"
      >
        <Check className="size-4" strokeWidth={2.5} />
      </span>
      {children}
    </button>
  );
}
