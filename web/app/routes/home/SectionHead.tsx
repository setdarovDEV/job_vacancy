import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LocalizedLink } from "~/shared/i18n/hooks";

// Below-the-fold sections: skipped by rendering until near the viewport. Vertical padding (not
// margins) makes the section gap, so paint containment never clips a lifted card's shadow.
export const band = "container-page defer-paint py-6 md:py-10";
/** Placeholder height while a section is skipped (between its phone and desktop heights, leaning
 *  to phones), so the scrollbar doesn't jump as sections render; `auto` then keeps the real one. */
export const est = (rem: number) => ({ containIntrinsicSize: `auto ${rem}rem` });

/** Section title row of the landing: H2 (+ one line) on the left, an optional "see all" on the right. */
export function SectionHead({ id, title, description, action }: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="reveal flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 max-w-2xl">
        <h2 id={id} className="break-words font-display text-xl font-semibold tracking-heading text-ink md:text-2xl">{title}</h2>
        {description && <p className="mt-2 text-md text-ink-2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** "See all" text link with a 44px target; the negative margin keeps the text on the grid edge. */
export function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <LocalizedLink
      to={to}
      prefetch="intent"
      className="-mx-3 inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-md font-medium text-lapis-ink transition-colors hover:bg-lapis-soft"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4" />
    </LocalizedLink>
  );
}
