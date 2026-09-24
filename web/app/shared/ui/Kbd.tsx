import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** Keyboard key hint (⌘K, Esc, ↑↓). Pair with visible text; hide it on touch where it means nothing. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pill border border-line-strong bg-surface px-1.5",
        "font-sans text-2xs font-medium leading-none text-ink-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
