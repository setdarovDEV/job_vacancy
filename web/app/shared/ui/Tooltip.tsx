import { Slot } from "@radix-ui/react-slot";
import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type FocusEvent, type PointerEvent, type ReactElement, type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/*
 * Tooltip on the HTML Popover API (top layer, no positioning library, ~1 KB): no Radix Tooltip or
 * floating-ui in any bundle. The module-level state below is the shared "provider": only one
 * tooltip is open at a time, and moving between triggers shows the next one without the delay.
 */
let closeOpen: (() => void) | null = null;
let lastClosedAt = 0;

const GAP = 8;
const EDGE = 8;

/**
 * Glass hint for a pointer or keyboard focus. Touch never opens it, so it must never be the only
 * way to get the information: the trigger keeps its own accessible name (e.g. IconButton `label`)
 * and the content is also exposed as its description. `children` must be one element that
 * accepts a ref and pointer/focus handlers (wrap disabled buttons in a <span>).
 */
export function Tooltip({
  content, children, side = "top", delay = 400,
}: { content: ReactNode; children: ReactElement; side?: "top" | "bottom"; delay?: number }) {
  const id = useId();
  const trigger = useRef<HTMLElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  // The tip lives in a portal, which only exists after hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    if (closeOpen === hide) {
      closeOpen = null;
      lastClosedAt = Date.now();
    }
    setOpen(false);
  }, []);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    if (closeOpen && closeOpen !== hide) closeOpen();
    closeOpen = hide;
    setOpen(true);
  }, [hide]);

  const showSoon = () => {
    clearTimeout(timer.current);
    const warm = closeOpen != null || Date.now() - lastClosedAt < 500;
    timer.current = setTimeout(show, warm ? 0 : delay);
  };
  // A short grace period lets the pointer travel onto the tip (WCAG 1.4.13 "hoverable").
  const hideSoon = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(hide, 120);
  };

  useEffect(() => () => {
    clearTimeout(timer.current);
    if (closeOpen === hide) closeOpen = null;
  }, [hide]);

  // Place above (or below when there's no room), centred and kept inside the viewport.
  // Returns false when the trigger has left the viewport.
  const position = useCallback(() => {
    const el = tip.current;
    const a = trigger.current;
    if (!el || !a) return false;
    const r = a.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return false;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    let s = side;
    if (s === "top" && r.top - h - GAP < EDGE) s = "bottom";
    else if (s === "bottom" && r.bottom + h + GAP > window.innerHeight - EDGE) s = "top";
    el.style.top = `${s === "top" ? r.top - h - GAP : r.bottom + GAP}px`;
    el.style.left = `${Math.min(Math.max(EDGE, r.left + r.width / 2 - w / 2), vw - w - EDGE)}px`;
    el.dataset.side = s;
    return true;
  }, [side]);

  useLayoutEffect(() => {
    const el = tip.current;
    if (!open || !el) return;
    try {
      el.showPopover?.();
    } catch {
      /* already open or unsupported: it's still a fixed element */
    }
    position();
    return () => {
      try {
        el.hidePopover?.();
      } catch {
        /* not open */
      }
    };
  }, [open, position]);

  // While open: Escape dismisses the tip first (not the dialog around it). Scrolling (including
  // the scroll-into-view that keyboard focus causes) moves it along, once per frame; it closes
  // only when the trigger leaves the viewport.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      hide();
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!position()) hide();
      });
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, hide, position]);

  if (content == null || content === "" || content === false) return children;

  return (
    <>
      <Slot
        ref={trigger}
        aria-describedby={mounted ? id : undefined}
        // Our tip replaces the native title bubble (IconButton sets one).
        title={undefined}
        onPointerEnter={(e: PointerEvent) => {
          if (e.pointerType !== "touch") showSoon();
        }}
        onPointerLeave={hideSoon}
        onPointerDown={hide}
        onFocus={(e: FocusEvent<HTMLElement>) => {
          // Keyboard focus only: a mouse click already had its hover delay.
          let visible = true;
          try {
            visible = e.currentTarget.matches(":focus-visible");
          } catch {
            /* old engines: show */
          }
          if (visible) show();
        }}
        onBlur={hide}
      >
        {children}
      </Slot>
      {mounted &&
        createPortal(
          // Outer box: top-layer positioning only. Inner: material + entrance, kept on one element so
          // the backdrop blur is never inside an ancestor whose opacity is animating.
          <div
            ref={tip}
            id={id}
            role="tooltip"
            popover="manual"
            hidden={!open}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={hideSoon}
            className="fixed inset-auto z-70 m-0 w-max max-w-[min(18rem,calc(100vw-1rem))] overflow-visible border-0 bg-transparent p-0"
          >
            <div data-state="open" className="anim-pop glass-sheet rounded-control px-3 py-1.5 text-sm text-ink">
              {content}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
