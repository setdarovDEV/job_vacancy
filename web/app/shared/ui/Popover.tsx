import { useId, useRef, type ReactNode } from "react";

import { cn } from "../lib/cn";

/**
 * Disclosure popover built on the HTML Popover API: the browser handles top-layer
 * stacking, outside-click and Escape dismissal, with no JavaScript library. We only place
 * it under its trigger (right-aligned, kept on screen) and close it after a choice.
 */
export function Popover({
  trigger, children, className, label,
}: {
  trigger: (props: { popoverTarget: string; "aria-label": string }) => ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);

  const place = (e: React.ToggleEvent<HTMLDivElement>) => {
    if (e.newState !== "open") return;
    const el = e.currentTarget;
    const btn = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`);
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = el.offsetWidth;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    el.style.top = `${r.bottom + 8}px`;
    el.style.left = `${left}px`;
  };

  return (
    <>
      {trigger({ popoverTarget: id, "aria-label": label })}
      <div
        ref={ref}
        id={id}
        popover="auto"
        onToggle={place}
        // Picking an item (link or option) closes the popover.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button,[role=radio] input")) ref.current?.hidePopover();
        }}
        className={cn(
          "popover-panel fixed inset-auto m-0 min-w-52 rounded-panel border border-line bg-surface p-1.5 text-ink shadow-pop",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

export const popoverItem =
  "flex h-10 w-full cursor-pointer select-none items-center gap-2.5 rounded-[0.625rem] px-2.5 text-sm text-ink outline-none hover:bg-sunken focus-visible:bg-sunken";
