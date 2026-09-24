import type { ReactNode } from "react";

import { cn } from "../lib/cn";

const sizes = {
  sm: { box: "px-4 py-8", tile: "mb-3 size-11 rounded-control [&_svg]:size-5", title: "text-md font-semibold text-ink", body: "mt-1 text-sm", actions: "mt-4" },
  md: { box: "px-6 py-12 md:py-14", tile: "mb-4 size-14 rounded-panel [&_svg]:size-6", title: "text-lead font-semibold tracking-snug text-ink", body: "mt-1.5 text-md", actions: "mt-6" },
} as const;

/**
 * For empty lists and dead ends: say what's missing (and why) and offer the next step.
 * Use a different title/body for "nothing here yet" and "no results for these filters".
 */
export function EmptyState({
  icon, title, body, action, secondaryAction, size = "md", headingAs: Heading = "h3", className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** The one primary next step (a Button, usually). */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** "sm" for panels and asides. */
  size?: keyof typeof sizes;
  /** Heading level that fits the page outline. */
  headingAs?: "h2" | "h3" | "p";
  className?: string;
}) {
  const s = sizes[size];
  return (
    <div className={cn("anim-fade flex flex-col items-center text-center", s.box, className)}>
      {icon && (
        <div aria-hidden="true" className={cn("grid place-items-center bg-lapis-soft text-lapis", s.tile)}>
          {icon}
        </div>
      )}
      {/* Plain template strings: tailwind-merge would drop text-lead next to a text color. */}
      <Heading className={`max-w-md break-words ${s.title}`}>{title}</Heading>
      {body && <p className={`max-w-sm break-words text-ink-2 ${s.body}`}>{body}</p>}
      {(action || secondaryAction) && (
        <div className={`flex flex-wrap items-center justify-center gap-2 ${s.actions}`}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
