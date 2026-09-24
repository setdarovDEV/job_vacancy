import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { RelTime } from "./RelTime";

const tones = {
  lapis: { dot: "bg-lapis", tile: "bg-lapis-soft text-lapis-ink" },
  firuza: { dot: "bg-firuza", tile: "bg-firuza-soft text-firuza-ink" },
  zafaron: { dot: "bg-zafaron", tile: "bg-zafaron-soft text-zafaron-ink" },
  anor: { dot: "bg-anor", tile: "bg-anor-soft text-anor-ink" },
  neutral: { dot: "bg-line-strong", tile: "bg-sunken text-ink-2" },
} as const;

export type TimelineItem = {
  id: string | number;
  title: ReactNode;
  /** Extra detail under the title (a note, a quoted message…). */
  body?: ReactNode;
  /** ISO timestamp, shown as relative time with the absolute date as a tooltip. */
  at?: string;
  tone?: keyof typeof tones;
  /** Small icon in a tinted circle instead of the plain dot. */
  icon?: ReactNode;
};

/** Vertical history (application status changes, moderation log). Order is the caller's. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((it, i) => {
        const tone = tones[it.tone ?? "neutral"];
        const last = i === items.length - 1;
        return (
          <li key={it.id} className={cn("relative flex gap-3", !last && "pb-6")}>
            {/* Rail: from under this marker down to the next one. */}
            {!last && <span aria-hidden="true" className="absolute bottom-0 left-3 top-7 w-px -translate-x-1/2 bg-line" />}
            <span aria-hidden="true" className="relative grid size-6 shrink-0 place-items-center">
              {it.icon ? (
                <span className={cn("grid size-6 place-items-center rounded-full [&_svg]:size-3.5", tone.tile)}>{it.icon}</span>
              ) : (
                <span className={cn("size-2.5 rounded-full ring-4 ring-surface", tone.dot)} />
              )}
            </span>
            <div className="min-w-0 flex-1 break-words pt-0.5">
              <p className="text-md font-medium text-ink">{it.title}</p>
              {it.at && <RelTime iso={it.at} className="mt-0.5 block text-sm text-ink-2" />}
              {it.body && <div className="mt-2 text-sm text-ink-2">{it.body}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
