import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** Settings-style block: title and explanation on the left, controls on the right. */
export function Section({ title, description, children, className, id }: {
  title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={cn("grid gap-4 border-b border-line py-8 first:pt-0 last:border-0 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10", className)}>
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Page title row for signed-in areas. */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
