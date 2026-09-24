import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "../lib/cn";
import { groupDigits } from "../lib/format";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Shown as a tabular number pill after the label. */
  count?: number;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name of the group (aria-label). */
  label: string;
  size?: "sm" | "md";
  /** Stretch to the container with equal segments (the thumb then moves in pure CSS). */
  fullWidth?: boolean;
  /**
   * Tabs mode: role=tablist/tab, tab ids `${idPrefix}-tab-${value}`, aria-controls
   * `${idPrefix}-panel-${value}`. Render panels with `segmentedPanelProps(idPrefix, value)`.
   */
  tabs?: { idPrefix: string };
  className?: string;
};

/** Props for the panel that belongs to a SegmentedControl in tabs mode. */
export function segmentedPanelProps(idPrefix: string, value: string) {
  return {
    role: "tabpanel",
    id: `${idPrefix}-panel-${value}`,
    "aria-labelledby": `${idPrefix}-tab-${value}`,
    tabIndex: 0,
  } as const;
}

// sm is a dense desktop size: on touch it grows to the md height (with the track: 44px).
const sizes = {
  sm: "h-7 gap-1.5 px-3 text-sm [&_svg]:size-3.5 pointer-coarse:h-9",
  md: "h-9 gap-2 px-4 text-md [&_svg]:size-4",
} as const;

// Same material for the sliding thumb and the static pre-measure highlight (SSR, first paint).
const thumbLook = "bg-raised shadow-1 ring-1 ring-line";

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let spring: string | null = null;
function springEasing() {
  spring ??= getComputedStyle(document.documentElement).getPropertyValue("--ease-spring").trim() || "ease";
  return spring;
}

/**
 * FLIP: the thumb already sits at its new box; play it from the old box expressed as a
 * transform of the new one, so only `transform` animates (no width/left animation).
 */
function flip(el: HTMLElement, from: { x: number; w: number }, x: number, w: number) {
  if (typeof el.animate !== "function") return;
  const frames = [
    { transform: `translateX(${from.x}px) scaleX(${from.w / w})` },
    { transform: `translateX(${x}px) scaleX(1)` },
  ];
  try {
    el.animate(frames, { duration: 320, easing: springEasing() }); // --dur-3
  } catch {
    // Engines without linear() easing.
    el.animate(frames, { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }
}

/**
 * Pill segmented control (list views, theme, kanban column switcher). Radio-group semantics by
 * default: one tab stop, arrows / Home / End move the selection. Content-sized segments are
 * measured once per change and the thumb glides with a transform; `fullWidth` segments are equal
 * and need no measuring at all. Too many segments scroll inside the track, never the page.
 */
export function SegmentedControl<T extends string>({
  value, onChange, options, label, size = "md", fullWidth, tabs, className,
}: SegmentedControlProps<T>) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<{ x: number; w: number } | null>(null);
  const activeRef = useRef(-1);
  const [measured, setMeasured] = useState(false);
  // fullWidth: the CSS thumb only glides once the user has touched the control, so a value
  // corrected right after hydration (e.g. the glass tier the boot script chose) doesn't slide
  // across the track on load.
  const [live, setLive] = useState(false);
  const wake = fullWidth && !live ? () => setLive(true) : undefined;

  const n = options.length;
  const active = options.findIndex((o) => o.value === value);
  const enabled = options.flatMap((o, i) => (o.disabled ? [] : [i]));
  const tabStop = active >= 0 && !options[active].disabled ? active : (enabled[0] ?? -1);

  // Content-sized mode: put the thumb on the active segment (reads first, then writes).
  const place = (animate: boolean) => {
    const el = track.current;
    const th = thumb.current;
    if (!el || !th) return;
    const btn = items.current[activeRef.current];
    if (!btn) {
      box.current = null;
      return;
    }
    const x = btn.offsetLeft;
    const w = btn.offsetWidth;
    const prev = box.current;
    if (prev && prev.x === x && prev.w === w) return;
    let from: { x: number; w: number } | null = null;
    if (animate && prev && w > 0 && !reducedMotion()) {
      // Start from where the thumb is drawn right now, even mid-animation.
      const a = th.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      from = { x: a.left - b.left - el.clientLeft + el.scrollLeft, w: a.width };
    }
    th.getAnimations?.().forEach((anim) => anim.cancel());
    th.style.width = `${w}px`;
    th.style.transform = `translateX(${x}px)`;
    box.current = { x, w };
    if (from) flip(th, from, x, w);
  };

  useLayoutEffect(() => {
    activeRef.current = active;
    if (fullWidth) return;
    place(box.current != null);
    setMeasured(true);
    // Keep the chosen segment visible when the track scrolls (many segments on a phone).
    const el = track.current;
    const btn = items.current[active];
    if (el && btn && el.scrollWidth > el.clientWidth) {
      const left = btn.offsetLeft;
      const right = left + btn.offsetWidth;
      if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
        el.scrollTo({
          left: left - (el.clientWidth - btn.offsetWidth) / 2,
          behavior: measured && !reducedMotion() ? "smooth" : "auto",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-place only when the selection moves
  }, [active, fullWidth]);

  // Labels, counts, fonts or the viewport changed a segment's size: snap the thumb (no animation).
  useLayoutEffect(() => {
    if (fullWidth || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place(false));
    if (track.current) ro.observe(track.current);
    for (const b of items.current) if (b) ro.observe(b);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place() only reads refs
  }, [fullWidth, n]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!enabled.length) return;
    const pos = enabled.indexOf(i);
    const forward = e.key === "ArrowRight" || (!tabs && e.key === "ArrowDown");
    const back = e.key === "ArrowLeft" || (!tabs && e.key === "ArrowUp");
    let next: number;
    if (forward) next = enabled[(pos + 1) % enabled.length];
    else if (back) next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") next = enabled[0];
    else if (e.key === "End") next = enabled[enabled.length - 1];
    else return;
    e.preventDefault();
    items.current[next]?.focus();
    if (options[next].value !== value) onChange(options[next].value);
  };

  return (
    <div
      ref={track}
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={label}
      onPointerDown={wake}
      onKeyDown={wake}
      className={cn(
        "relative isolate rounded-pill bg-sunken p-1",
        fullWidth
          ? "grid w-full auto-cols-[minmax(0,1fr)] grid-flow-col"
          : "inline-flex max-w-full items-center overflow-x-auto align-middle scrollbar-none",
        className,
      )}
    >
      <span
        ref={thumb}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-1 rounded-pill",
          thumbLook,
          fullWidth ? cn("left-1", live && "transition-transform duration-(--dur-3) ease-spring") : "left-0 origin-left",
          (active < 0 || (!fullWidth && !measured)) && "opacity-0",
        )}
        // Equal segments: the thumb is one segment wide, so translateX(i × 100%) lands exactly.
        style={fullWidth && n > 0 ? { width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${Math.max(active, 0) * 100}%)` } : undefined}
      />
      {options.map((o, i) => {
        const on = i === active;
        return (
          <button
            key={o.value}
            ref={(el) => {
              items.current[i] = el;
            }}
            type="button"
            role={tabs ? "tab" : "radio"}
            id={tabs ? `${tabs.idPrefix}-tab-${o.value}` : undefined}
            aria-controls={tabs ? `${tabs.idPrefix}-panel-${o.value}` : undefined}
            aria-selected={tabs ? on : undefined}
            aria-checked={tabs ? undefined : on}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={o.disabled}
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative inline-flex cursor-pointer select-none items-center justify-center whitespace-nowrap rounded-pill font-medium",
              "transition-[color,scale] duration-150 ease-spring active:scale-[0.97]",
              "disabled:pointer-events-none disabled:opacity-50",
              // Invisible 44px hit area on touch (the track's padding makes up the difference).
              "pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1",
              sizes[size],
              fullWidth ? "min-w-0" : "shrink-0",
              on ? "text-ink" : "text-ink-2 hover:text-ink",
              on && !fullWidth && !measured && thumbLook,
            )}
          >
            {o.icon != null && <span aria-hidden="true" className="grid shrink-0 place-items-center">{o.icon}</span>}
            <span className="min-w-0 truncate">{o.label}</span>
            {o.count != null && (
              <span
                className={cn(
                  "num shrink-0 rounded-pill px-1.5 text-xs font-semibold",
                  on ? "bg-lapis-soft text-lapis-ink" : "text-ink-3",
                )}
              >
                {groupDigits(o.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
