const EDGE = 8; // min distance from the viewport edges

export type PlaceOptions = {
  /** Panel width in px; default: the trigger's width (at least `minWidth`). "content" leaves it to CSS. */
  width?: number | "content";
  minWidth?: number;
  /** Height cap in px (the panel scrolls inside). */
  maxHeight?: number;
  /** Natural content height when the panel scrolls in a child (its own scrollHeight is capped then). */
  height?: number;
  /** Which trigger edge the panel lines up with. */
  align?: "start" | "end";
  /** Gap between trigger and panel in px. */
  gap?: number;
};

/**
 * Places a fixed-position popover under its trigger, or above it when there's clearly more
 * room there; keeps it on screen and caps its height to the space available. Also sets
 * `data-side` (entrance direction) and `transform-origin`, so the panel grows out of its trigger.
 * Safe to call from `beforetoggle` (panel still hidden: sizes are estimated) and again after it opens.
 */
export function placeUnder(el: HTMLElement, anchor: HTMLElement, opts: PlaceOptions = {}) {
  // All reads first, then all writes: no forced layout when this runs on every scroll frame.
  const r = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth; // without the scrollbar
  const vh = window.innerHeight;
  const contentWidth = opts.width === "content" ? el.offsetWidth : 0; // 0 while still hidden (beforetoggle)
  const natural = opts.height ?? (el.scrollHeight || 240);
  const gap = opts.gap ?? 6;
  const cap = opts.maxHeight ?? 384;
  const end = opts.align === "end";
  const s = el.style;

  let left: number | null = null;
  let width = contentWidth;
  if (opts.width === "content") {
    if (width) left = clamp(end ? r.right - width : r.left, EDGE, vw - width - EDGE);
    else if (!end) left = clamp(r.left, EDGE, vw - 2 * EDGE);
    s.maxWidth = `${vw - 2 * EDGE}px`;
  } else {
    width = Math.min(opts.width ?? Math.max(r.width, opts.minWidth ?? 0), vw - 2 * EDGE);
    left = clamp(end ? r.right - width : r.left, EDGE, vw - width - EDGE);
    s.width = `${width}px`;
  }
  if (left === null) {
    // Width unknown and end-aligned: pin the right edge, the browser sizes the rest.
    s.left = "auto";
    s.right = `${Math.max(EDGE, vw - r.right)}px`;
  } else {
    s.left = `${left}px`;
    s.right = "auto";
  }

  const below = vh - r.bottom - gap - EDGE;
  const above = r.top - gap - EDGE;
  const up = below < Math.min(cap, natural) && above > below;
  s.maxHeight = `${Math.max(0, Math.min(cap, up ? above : below))}px`;
  s.top = up ? "auto" : `${r.bottom + gap}px`;
  s.bottom = up ? `${vh - r.top + gap}px` : "auto";
  el.dataset.side = up ? "top" : "bottom";

  // Grow out of the trigger's centre (or its aligned edge while the width is still unknown).
  const ox = left !== null && width ? `${clamp(r.left + r.width / 2 - left, 0, width)}px` : end ? "right" : "left";
  s.transformOrigin = `${ox} ${up ? "bottom" : "top"}`;
}

/**
 * Keeps an open panel attached to its trigger while the page scrolls or resizes: passive
 * listeners, at most one re-place per frame, and scrolling inside the panel itself is ignored.
 * Returns the cleanup function (use it as an effect's return value).
 */
export function followAnchor(panel: HTMLElement, place: () => void) {
  let frame = 0;
  const schedule = (e: Event) => {
    if (e.target instanceof Node && panel.contains(e.target)) return;
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); });
  };
  const opts = { passive: true, capture: true } as const;
  window.addEventListener("resize", schedule, opts);
  window.addEventListener("scroll", schedule, opts);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", schedule, opts);
    window.removeEventListener("scroll", schedule, opts);
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
