import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject,
} from "react";

import { useTranslation } from "../i18n/i18n";
import { cn } from "../lib/cn";
import { dismissToast, type ToastItem } from "./toast-store";

const tones = {
  success: { Icon: CircleCheck, className: "text-firuza" },
  error: { Icon: CircleAlert, className: "text-anor" },
  info: { Icon: Info, className: "text-lapis" },
} as const;

// Where F8 came from, so keyboard users get back there when they're done with the toasts.
let returnTo: HTMLElement | null = null;

/**
 * The visible toast stack (lazy chunk, see Toast.tsx). Glass cards, newest at the bottom: centred
 * above the mobile tab bar and sticky bars on phones, bottom-right from md. Plain CSS motion (no
 * animation library): spring entrance, quick exit, FLIP reflow when a card leaves, and a sideways
 * swipe to dismiss on touch. Hover or focus pauses every countdown; F8 jumps to the newest toast,
 * Escape dismisses the focused one.
 */
export default function ToastViewport({ items, closeLabel }: { items: ToastItem[]; closeLabel: string }) {
  const { t } = useTranslation();
  const list = useRef<HTMLOListElement>(null);
  const { pause, resume } = useCountdowns(items);
  useFlip(list, items);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "F8" || e.defaultPrevented) return;
      const newest = [...(list.current?.children ?? [])].reverse().find((c) => (c as HTMLElement).dataset.state === "open");
      const target = newest?.querySelector<HTMLElement>("button");
      if (!target) return;
      e.preventDefault();
      if (!list.current?.contains(document.activeElement)) returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      target.focus();
    };
    const onVisibility = () => (document.hidden ? pause("hidden") : resume("hidden"));
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pause, resume]);

  // Dismissing the focused toast from the keyboard hands focus to the next one, or back to
  // where F8 was pressed; after a click the focus just goes away (so the countdowns resume).
  const dismiss = (li: HTMLElement, id: number, byKeyboard: boolean) => {
    if (li.contains(document.activeElement)) {
      const next = byKeyboard
        ? [...(list.current?.children ?? [])].reverse().find((c) => c !== li && (c as HTMLElement).dataset.state === "open")
        : undefined;
      const target = next?.querySelector<HTMLElement>("button") ?? (byKeyboard && returnTo?.isConnected ? returnTo : null);
      if (target) target.focus();
      else (document.activeElement as HTMLElement | null)?.blur();
    }
    dismissToast(id);
  };

  return (
    <section
      data-toast-viewport=""
      aria-label={t("overlay.notifications")}
      onFocus={() => pause("focus")}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume("focus");
      }}
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4",
        // Phones: above the floating tab bar; a page with a sticky bottom bar adds its height via --toast-lift.
        "bottom-[calc(var(--tabbar-space)+var(--toast-lift,0px)+0.5rem)]",
        "md:bottom-6 md:left-auto md:right-6 md:justify-end md:px-0",
      )}
    >
      <ol
        ref={list}
        className="flex w-full max-w-sm flex-col gap-2"
        onPointerEnter={(e) => e.pointerType === "mouse" && pause("hover")}
        onPointerLeave={(e) => e.pointerType === "mouse" && resume("hover")}
      >
        {items.map((item) => (
          <Toast key={item.id} item={item} closeLabel={closeLabel} onDismiss={dismiss} pause={pause} resume={resume} />
        ))}
      </ol>
    </section>
  );
}

type Drag = { id: number; x: number; y: number; w: number; dx: number; v: number; lastT: number; active: boolean };

type Pause = (reason: string) => void;

function Toast({
  item, closeLabel, onDismiss, pause, resume,
}: {
  item: ToastItem;
  closeLabel: string;
  onDismiss: (li: HTMLElement, id: number, byKeyboard: boolean) => void;
  pause: Pause;
  resume: Pause;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const drag = useRef<Drag | null>(null);
  const [flung, setFlung] = useState(false);
  const { Icon, className: tone } = tones[item.tone];
  const dragReason = `drag-${item.id}`;

  useEffect(() => () => resume(dragReason), [dragReason, resume]);

  const close = (e: MouseEvent | KeyboardEvent) => {
    // Clicks from Enter/Space have detail 0.
    if (ref.current) onDismiss(ref.current, item.id, e.type === "keydown" || (e as MouseEvent).detail === 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Escape") close(e);
  };

  // Swipe sideways to dismiss (touch and pen; mouse users have the close button). touch-action
  // pan-y leaves vertical page scrolling to the browser, so sideways drags reach us uninterrupted.
  const onPointerDown = (e: PointerEvent<HTMLLIElement>) => {
    if (e.pointerType === "mouse" || !e.isPrimary || item.state !== "open") return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, w: e.currentTarget.offsetWidth, dx: 0, v: 0, lastT: e.timeStamp, active: false };
    pause(dragReason);
  };

  const onPointerMove = (e: PointerEvent<HTMLLIElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.active) {
      if (Math.abs(dx) < 8) {
        if (Math.abs(e.clientY - d.y) >= 8) end(); // vertical: the page scrolls instead
        return;
      }
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = 0.7 * ((dx - d.dx) / dt) + 0.3 * d.v; // px/ms, smoothed
    d.dx = dx;
    d.lastT = e.timeStamp;
    const s = e.currentTarget.style;
    s.transition = "none";
    s.transform = `translate3d(${dx}px, 0, 0)`;
    s.opacity = String(1 - Math.min(0.85, Math.abs(dx) / d.w));
  };

  const end = () => {
    drag.current = null;
    resume(dragReason);
  };

  const onPointerUp = (e: PointerEvent<HTMLLIElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    end();
    if (!d.active) return;
    const s = e.currentTarget.style;
    const flick = Math.abs(d.v) > 0.45 && Math.abs(d.dx) > 24 && Math.sign(d.v) === Math.sign(d.dx);
    if (e.type === "pointerup" && (Math.abs(d.dx) > d.w * 0.4 || flick)) {
      // Fly out the way it was thrown; the regular exit animation is skipped (data-state "flung").
      setFlung(true);
      s.transition = "transform var(--dur-2) var(--ease-out-quint), opacity var(--dur-2) ease-out";
      s.transform = `translate3d(${Math.sign(d.dx) * (d.w + 48)}px, 0, 0)`;
      s.opacity = "0";
      dismissToast(item.id);
    } else {
      s.transition = "transform var(--dur-3) var(--ease-spring), opacity var(--dur-2) ease-out";
      s.transform = "";
      s.opacity = "";
    }
  };

  return (
    <li
      ref={ref}
      data-id={item.id}
      data-state={flung ? "flung" : item.state}
      inert={item.state === "closed"}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="glass-sheet anim-toast pointer-events-auto flex touch-pan-y items-start gap-3 rounded-panel py-3 pl-4 pr-2 pointer-coarse:select-none"
    >
      <Icon className={cn("mt-px size-5 shrink-0", tone)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-md font-medium text-ink">{item.title}</p>
        {item.body && <p className="mt-0.5 break-words text-sm text-ink-2">{item.body}</p>}
      </div>
      <div className="-my-1.5 flex shrink-0 items-center gap-0.5 pointer-coarse:-my-2.5">
        {item.action && (
          <button
            type="button"
            onClick={(e) => {
              item.action?.onClick();
              close(e);
            }}
            className="h-9 rounded-pill px-3 text-sm font-semibold text-lapis-ink transition-[background-color,scale] duration-150 ease-spring hover:bg-lapis-soft active:scale-[0.97] pointer-coarse:h-11"
          >
            {item.action.label}
          </button>
        )}
        <button
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={close}
          className="grid size-9 place-items-center rounded-pill text-ink-3 transition-[background-color,color,scale] duration-150 ease-spring hover:bg-sunken hover:text-ink active:scale-[0.94] pointer-coarse:size-11"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/**
 * One countdown per open toast (its `ms`). Any pause reason (hover, focus, a drag, a hidden tab)
 * stops them all; on resume each keeps its remaining time, with at least a second to read.
 */
function useCountdowns(items: ToastItem[]) {
  const timers = useRef(new Map<number, { left: number; since: number; handle?: number }>());
  const pauses = useRef(new Set<string>());

  const start = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t || t.handle !== undefined || pauses.current.size) return;
    t.since = Date.now();
    t.handle = window.setTimeout(() => dismissToast(id), t.left);
  }, []);

  useEffect(() => {
    const map = timers.current;
    for (const i of items) {
      if (i.state !== "open" || map.has(i.id)) continue;
      map.set(i.id, { left: i.ms, since: 0 });
      start(i.id);
    }
    for (const [id, t] of map) {
      if (items.some((i) => i.id === id && i.state === "open")) continue;
      clearTimeout(t.handle);
      map.delete(id);
    }
  }, [items, start]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t.handle));
  }, []);

  const pause = useCallback((reason: string) => {
    const p = pauses.current;
    if (p.has(reason)) return;
    p.add(reason);
    if (p.size > 1) return;
    const now = Date.now();
    for (const t of timers.current.values()) {
      if (t.handle === undefined) continue;
      clearTimeout(t.handle);
      t.handle = undefined;
      t.left = Math.max(1000, t.left - (now - t.since));
    }
  }, []);

  const resume = useCallback((reason: string) => {
    if (!pauses.current.delete(reason) || pauses.current.size) return;
    for (const id of timers.current.keys()) start(id);
  }, [start]);

  return { pause, resume };
}

let spring: string | undefined;
function springEasing() {
  if (spring === undefined) {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--ease-spring").trim();
    spring = v && CSS.supports("transition-timing-function", v) ? v : "cubic-bezier(0.22, 1, 0.36, 1)";
  }
  return spring;
}

/**
 * FLIP: when a card arrives or leaves, the others glide to their new place instead of jumping.
 * Layout positions (offsetTop, unaffected by running transforms) are read once per change;
 * only transform is animated, added on top of any entrance or swipe transform.
 */
function useFlip(list: RefObject<HTMLOListElement | null>, items: ToastItem[]) {
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, number>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const id = child.dataset.id ?? "";
      const top = child.offsetTop;
      next.set(id, top);
      const before = tops.current.get(id);
      if (still || before === undefined || before === top) continue;
      child.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
        duration: 320, easing: springEasing(), composite: "add",
      });
    }
    tops.current = next;
  }, [list, items]);
}
