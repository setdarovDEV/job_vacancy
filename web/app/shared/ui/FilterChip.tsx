import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * An applied filter with a remove button ("Toshkent ×"). `removeLabel` is the button's accessible
 * name, e.g. t("controls.removeFilter", { name }). On touch the 24px button gets a 44px hit area.
 */
export function FilterChip({
  children, onRemove, removeLabel, className,
}: { children: ReactNode; onRemove: () => void; removeLabel: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-full shrink-0 items-center gap-1 rounded-pill bg-lapis-soft pl-3 pr-1 text-sm font-medium text-lapis-ink",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className={cn(
          "relative grid size-6 shrink-0 place-items-center rounded-pill",
          "transition-[background-color,scale] duration-150 ease-spring hover:bg-lapis/15 active:scale-90",
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5",
        )}
      >
        <X className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </span>
  );
}
