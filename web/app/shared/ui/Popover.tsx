import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { followAnchor, placeUnder } from "./anchor";

/** The look every floating list shares (Popover, Menu, Select, MonthPicker): one popover system. */
export const popoverPanel = "glass-sheet rounded-panel p-1.5 text-ink";

/**
 * Row inside a Popover or Menu. Picking one closes the popover (the `popover-item` marker);
 * other buttons inside a popover (steppers, toggles) leave it open. Keyboard focus keeps the
 * global focus outline, drawn inset so the panel's edge never clips it.
 */
export const popoverItem =
  "popover-item flex min-h-10 w-full cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2 text-left text-md text-ink " +
  "transition-colors duration-150 hover:bg-sunken focus-visible:bg-sunken focus-visible:-outline-offset-2 pointer-coarse:min-h-11 " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

// What closes the popover when clicked: links, menu rows and anything marked data-close.
const CLOSES = "a[href], [data-close], .popover-item, [role^='menuitem']";
// What arrow keys move between.
const ITEMS = "a[href], button:not(:disabled), [role^='menuitem']:not([aria-disabled='true'])";

/**
 * Disclosure popover built on the HTML Popover API: the browser handles top-layer stacking,
 * outside-click and Escape dismissal (focus goes back to the trigger), with no JavaScript
 * library. We place it next to its trigger (kept on screen, following scroll), move keyboard
 * users onto the first item, and close it after a choice. Arrow keys / Home / End move
 * between links and buttons inside.
 */
export function Popover({
  trigger, children, className, label, align = "end", onOpenChange,
}: {
  trigger: (props: { popoverTarget: string; "aria-label": string }) => ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
  /** Which trigger edge the panel lines up with (default "end": right edge in LTR). */
  align?: "start" | "end";
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const invoker = useCallback(() => document.querySelector<HTMLElement>(`[popovertarget="${id}"]`), [id]);
  const place = useCallback(() => {
    const el = ref.current;
    const btn = invoker();
    if (el && btn) placeUnder(el, btn, { width: "content", align, gap: 8, maxHeight: 520 });
  }, [align, invoker]);

  useEffect(() => (open && ref.current ? followAnchor(ref.current, place) : undefined), [open, place]);

  const onToggle = (e: React.ToggleEvent<HTMLDivElement>) => {
    const isOpen = e.newState === "open";
    setOpen(isOpen);
    onOpenChange?.(isOpen);
    if (!isOpen) return;
    place(); // exact placement now that the size is known
    // Keyboard users (focus ring on the trigger) land on the first item; pointer users stay put.
    if (invoker()?.matches(":focus-visible")) ref.current?.querySelector<HTMLElement>(ITEMS)?.focus({ preventScroll: true });
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Arrow keys on native radios fire clicks without a pointer (detail 0): moving through
    // choices must not close the popover.
    if (target instanceof HTMLInputElement && e.detail === 0) return;
    if (target.closest(CLOSES)) ref.current?.hidePopover();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (target.matches("input, textarea, select, [contenteditable='true']")) return; // radios/fields keep their own keys
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(target);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1
      : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      {trigger({ popoverTarget: id, "aria-label": label })}
      <div
        ref={ref}
        id={id}
        popover="auto"
        onBeforeToggle={(e) => e.newState === "open" && place()}
        onToggle={onToggle}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          "popover-panel fixed inset-auto m-0 min-w-52 overflow-y-auto overscroll-contain",
          popoverPanel,
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
