import type { ReactNode } from "react";

import { cn } from "../lib/cn";

/** Settings-style block: title and explanation on the left, controls on the right. */
export function Section({ title, description, children, className, id }: {
  title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn(
        "grid gap-4 border-b border-line py-8 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id ? `${id}-title` : undefined} className="break-words text-lead font-semibold tracking-snug text-ink">{title}</h2>
        {description && <p className="mt-1 break-words text-sm text-ink-2">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/**
 * Page title row for app pages: H1 + description, actions on the right (on phones they wrap
 * below). `breadcrumbs` renders above the title (Breadcrumbs or BackLink).
 */
export function PageHeader({ title, description, actions, breadcrumbs, className }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 md:mb-8", className)}>
      {breadcrumbs && <div className="mb-3">{breadcrumbs}</div>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1 basis-72">
          <h1 className="break-words font-display text-2xl font-semibold tracking-heading text-ink md:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl break-words text-md text-ink-2 md:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div>}
      </div>
    </header>
  );
}
