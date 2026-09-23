import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** For empty lists and dead ends: say what's missing and offer the next step. */
export function EmptyState({
  icon, title, body, action, className,
}: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-lapis-soft text-lapis-ink">{icon}</div>}
      <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
