import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { LocalizedLink } from "~/shared/i18n/hooks";

// Below-the-fold sections: skipped by rendering until near the viewport. Vertical padding (not
// margins) makes the section gap, so paint containment never clips a lifted card's shadow.
export const band = "container-page defer-paint py-6 md:py-10";
/**
 * Placeholder height while a section is skipped: `phone` rem (content box) at a 24rem viewport,
 * easing linearly to `desktop` rem at 64rem (where the grids reach their widest layout), so the
 * page is about as tall before a section renders as after, at every width, and the scrollbar
 * doesn't jump. `auto` then keeps the real height once it has rendered.
 */
export const est = (phone: number, desktop: number) => ({
  containIntrinsicSize: `auto clamp(${desktop}rem, calc(${phone}rem - ${phone - desktop} * (100vw - 24rem) / 40), ${phone}rem)`,
});

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
