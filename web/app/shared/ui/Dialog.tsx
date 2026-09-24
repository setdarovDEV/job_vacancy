import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { cn } from "../lib/cn";

export const DialogRoot = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Element to focus on open. Default: the first field or button on desktop; the panel itself on touch screens. */
  initialFocus?: RefObject<HTMLElement | null>;
};

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const;

type DialogProps = ContentProps & {
  /** sm 24rem (confirmations), md 32rem (default), lg 42rem (larger forms). */
  size?: keyof typeof sizes;
  /** "alertdialog" for confirmations that interrupt the flow (ConfirmDialog uses it). */
  role?: "dialog" | "alertdialog";
  /** false while an action runs: Escape, outside clicks and the close button don't dismiss. */
  dismissible?: boolean;
};

/**
 * Centered glass modal for short, focused tasks (confirmations, small forms). The body scrolls
 * inside when it's taller than the screen; the footer stacks full-width on phones (primary last,
 * nearest the thumb) and sits right-aligned from `sm` up.
 */
export function DialogContent({
  title, description, closeLabel, children, footer, className, initialFocus, size = "md", role, dismissible = true,
}: DialogProps) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <D.Portal>
      <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-overlay" />
      <D.Content
        ref={content}
        // Spread only when set: an explicit undefined would drop Radix's own role="dialog".
        {...(role ? { role } : {})}
        {...overlayGuards(content, initialFocus, dismissible)}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "glass-sheet anim-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col rounded-sheet py-6 md:py-7",
          // Centred with `transform` (not the translate property): anim-dialog's keyframes include the centring.
          "[transform:translate(-50%,-50%)]",
          sizes[size],
          className,
        )}
      >
        <div className="shrink-0 px-6 md:px-7">
          {/* pr-10 keeps the title clear of the close button; the description may run under it. */}
          <D.Title className="break-words pr-10 font-display text-xl font-semibold tracking-heading text-ink">{title}</D.Title>
          {description && <D.Description className="mt-1.5 break-words text-md text-ink-2">{description}</D.Description>}
        </div>
        {children != null && children !== false && (
          // pt/pb keep focus rings of the first and last field inside the scroll clip.
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-1 pt-5 md:px-7">{children}</div>
        )}
        {footer && (
          <div className="flex shrink-0 flex-col gap-2 px-6 pt-6 sm:flex-row sm:flex-wrap sm:justify-end md:px-7 [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
        {/* Last in DOM so initial focus lands on the content, first visually (top-right corner). */}
        <CloseButton label={closeLabel} disabled={!dismissible} className="absolute right-3 top-3.5 md:right-4 md:top-5" />
      </D.Content>
    </D.Portal>
  );
}

/**
 * Side panel: a bottom sheet on phones (grab handle, swipe down to close, max 88dvh, content
 * scrolls inside, footer pinned above the home indicator) and a 26rem panel from the right on
 * larger screens.
 */
export function SheetContent({ title, description, closeLabel, children, footer, className, initialFocus }: ContentProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const setContent = useCallback((el: HTMLDivElement | null) => {
    content.current = el;
    setNode(el);
  }, []);
  useSwipeToClose(node, scroller, overlay, closeBtn);

  return (
    <D.Portal>
      <D.Overlay ref={overlay} className="anim-overlay fixed inset-0 z-50 bg-overlay" />
      <D.Content
        ref={setContent}
        {...overlayGuards(content, initialFocus, true)}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "glass-sheet fixed z-50 flex flex-col",
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-sheet anim-sheet-up",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-none md:rounded-l-sheet md:anim-sheet-right",
          className,
        )}
      >
        {/* Drag zone on phones: the handle and the header always drag the sheet. */}
        <div className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing md:cursor-auto md:touch-auto md:select-auto">
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-pill bg-line-strong md:hidden" aria-hidden="true" />
          <div className="px-5 pb-3 pt-3 md:px-6 md:pb-4 md:pt-6">
            <D.Title className="break-words pr-10 font-display text-lg font-semibold tracking-heading text-ink md:text-xl">{title}</D.Title>
            {description && <D.Description className="mt-1 break-words text-md text-ink-2">{description}</D.Description>}
          </div>
        </div>
        <div
          ref={scroller}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 md:px-6",
            footer ? "pb-5" : "pb-[max(env(safe-area-inset-bottom),1.25rem)] md:pb-6",
          )}
        >
          {children}
        </div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-line px-5 pb-safe pt-3 md:px-6 md:pb-6 md:pt-4">{footer}</div>}
        <CloseButton ref={closeBtn} label={closeLabel} className="absolute right-3 top-4.5 md:right-4" />
      </D.Content>
    </D.Portal>
  );
}

const CloseButton = forwardRef<HTMLButtonElement, { label: string; className?: string; disabled?: boolean }>(
  function CloseButton({ label, className, disabled }, ref) {
    return (
      <D.Close
        ref={ref}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={cn(
          "grid size-11 place-items-center rounded-pill text-ink-3 transition-[background-color,color,scale] duration-150 ease-spring",
          "hover:bg-sunken hover:text-ink active:scale-[0.94] disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        <X className="size-5" aria-hidden="true" />
      </D.Close>
    );
  },
);

/** Radix handlers shared by dialogs and sheets: initial focus, nested popovers, toasts, busy state. */
function overlayGuards(content: RefObject<HTMLElement | null>, initialFocus: RefObject<HTMLElement | null> | undefined, dismissible: boolean) {
  return {
    onOpenAutoFocus(e: Event) {
      const target = initialFocus?.current;
      if (target) {
        e.preventDefault();
        target.focus({ preventScroll: true });
      } else if (window.matchMedia("(pointer: coarse)").matches) {
        // Touch: focusing a field would pop the on-screen keyboard over the panel.
        e.preventDefault();
        content.current?.focus({ preventScroll: true });
      }
    },
    onEscapeKeyDown(e: KeyboardEvent) {
      // Escape in an open Select / MonthPicker / Popover inside closes only that popover. Radix
      // hands us the native event, so preventing it also stops the browser's own popover close:
      // close it here instead (focus goes back to its trigger).
      const popover = openPopover(content.current);
      if (!dismissible || popover) e.preventDefault();
      popover?.hidePopover();
    },
    onInteractOutside(e: CustomEvent<{ originalEvent: Event }>) {
      const target = e.detail.originalEvent.target;
      // Toasts float above dialogs: tapping or swiping one must not dismiss the dialog underneath.
      if (!dismissible || (target instanceof Element && target.closest("[data-toast-viewport]"))) e.preventDefault();
    },
  };
}

function openPopover(root: HTMLElement | null) {
  try {
    const all = root?.querySelectorAll<HTMLElement>(":popover-open");
    return all?.length ? all[all.length - 1] : null; // the innermost / latest one
  } catch {
    return null; // no Popover API: nothing can be open
  }
}

/**
 * Swipe down to close the phone bottom sheet, with pointer events. The sheet follows the finger
 * (transform only), closes past 30% of its height or on a downward flick, and springs back
 * otherwise. Inside the content a drag only starts while it's scrolled to the top, so scrolling
 * keeps working; the handle and header always drag. Escape and the close button remain the
 * keyboard path.
 */
function useSwipeToClose(
  node: HTMLElement | null,
  scroller: RefObject<HTMLElement | null>,
  overlay: RefObject<HTMLElement | null>,
  closeBtn: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!node) return;
    const phone = window.matchMedia("(width < 48rem)"); // the md breakpoint turns it into a side panel
    type Drag = { id: number; x: number; y: number; h: number; dy: number; lastY: number; lastT: number; v: number; active: boolean };
    let drag: Drag | null = null;

    const follow = (dy: number, h: number, settle: boolean) => {
      node.style.transition = settle ? "transform var(--dur-3) var(--ease-spring)" : "none";
      node.style.transform = dy > 0 ? `translate3d(0, ${dy}px, 0)` : "";
      const o = overlay.current;
      if (o) {
        o.style.transition = settle ? "opacity var(--dur-3) var(--ease-out-quint)" : "none";
        o.style.opacity = dy > 0 ? String(Math.max(0, 1 - dy / h)) : "";
      }
    };

    const onDown = (e: PointerEvent) => {
      if (!phone.matches || !e.isPrimary || e.button !== 0) return;
      const target = e.target as Element;
      const body = scroller.current;
      if (body?.contains(target) && (e.pointerType === "mouse" || body.scrollTop > 0)) return;
      if (target.closest("input, textarea, select, [contenteditable='true'], [data-no-drag]")) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, h: node.offsetHeight, dy: 0, lastY: e.clientY, lastT: e.timeStamp, v: 0, active: false };
    };

    const onMove = (e: PointerEvent) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.active) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dy <= 0 || Math.abs(dx) > dy) { drag = null; return; } // up or sideways: a scroll, not a close
        d.active = true;
        node.setPointerCapture(e.pointerId);
      }
      const dt = e.timeStamp - d.lastT;
      if (dt > 0) d.v = 0.7 * ((e.clientY - d.lastY) / dt) + 0.3 * d.v; // px/ms, smoothed
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      d.dy = Math.max(0, dy);
      follow(d.dy, d.h, false);
    };

    const onEnd = (e: PointerEvent) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      drag = null;
      if (!d.active) return;
      if (e.type === "pointerup" && (d.dy > d.h * 0.3 || (d.v > 0.5 && d.dy > 24))) {
        // Radix closes it; the exit animation continues from where the finger let go. If the
        // owner keeps it open (controlled state), spring back instead of staying half-way down.
        closeBtn.current?.click();
        requestAnimationFrame(() => {
          if (node.dataset.state === "open") follow(0, d.h, true);
        });
      } else {
        follow(0, d.h, true);
      }
    };

    // Without this, a downward drag at the top of the content starts a native (over)scroll, which
    // cancels the pointer stream. The one listener here that has to be non-passive.
    const onTouchMove = (e: TouchEvent) => {
      const d = drag;
      const touch = e.touches[0];
      if (!d || !touch || !e.cancelable) return;
      const dy = touch.clientY - d.y;
      if (d.active || (dy > 0 && dy >= Math.abs(touch.clientX - d.x))) e.preventDefault();
    };

    node.addEventListener("pointerdown", onDown);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerup", onEnd);
    node.addEventListener("pointercancel", onEnd);
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      node.removeEventListener("pointerdown", onDown);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerup", onEnd);
      node.removeEventListener("pointercancel", onEnd);
      node.removeEventListener("touchmove", onTouchMove);
    };
  }, [node, scroller, overlay, closeBtn]);
}
